import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth, optionalUser, requireAdmin } from "../middleware/auth.js";
import {
  insertOrder, getOrder, updateOrder, listOrders, countOrders, listOrdersForUser,
  createOrderRequest, listOrderRequests, decideOrderRequest, getOrderRequest,
  insertPayment, getPaymentByOrder, updatePayment, listPaymentsForOrder,
  insertOrderItems, listOrderItems, reserveStock, releaseStock, availableStock,
  appendStatusHistory, insertPaymentTransaction, getPaymentTransactions,
  listTransactionsForOrder, listOrderEmails, logOrderEmail,
  getUserById, clearCart,
} from "../db.js";
import { cleanString, isPhone, ValidationError } from "../lib/validate.js";
import { byId, DELIVERY_FEE, PAYMENT_METHODS, canTransition, CANCELLABLE_STATES, RETURNABLE_STATES, ORDER_STATUSES } from "../catalog.js";
import { sendOrderOwnerEmail, sendCustomerOrderConfirmationEmail, sendVerificationRequiredOwnerEmail, sendOrderStatusEmail } from "../lib/mail.js";
import { ADMIN_EMAIL } from "../lib/config.js";

const router = Router();

function buildItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError("Cart is empty");
  const counts = new Map();
  for (const it of items) {
    const product = byId(it.id);
    if (!product) throw new ValidationError(`Unknown product: ${it.id}`);
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new ValidationError("Invalid quantity");
    const key = `${it.id}|${it.size || "Signature"}`;
    counts.set(key, (counts.get(key) || 0) + qty);
  }
  let subtotal = 0;
  const resolved = [];
  for (const [key, qty] of counts) {
    const [id, size] = key.split("|");
    const p = byId(id);
    const avail = availableStock(id, p.stock);
    if (qty > avail) throw new ValidationError(`Only ${avail} of ${p.name} left in stock`);
    const price = p.salePrice;
    subtotal += price * qty;
    resolved.push({ id, name: p.name, size: size === "Tester" ? "Tester" : "Signature", qty, price });
  }
  return { items: resolved, subtotal };
}

function newOrderId() {
  return `ILX-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function parseJson(v, fallback) {
  try { return JSON.parse(v || "null") ?? fallback; } catch { return fallback; }
}

function serializeOrder(o, extras = {}) {
  if (!o) return null;
  const items = parseJson(o.items, []);
  return {
    id: o.id,
    created_at: o.created_at,
    updated_at: o.updated_at,
    items,
    order_items: extras.order_items || [],
    subtotal: o.subtotal,
    delivery_fee: o.delivery_fee,
    total: o.total,
    payment: o.payment_method,
    payment_status: o.payment_status,
    status: o.order_status,
    status_history: parseJson(o.status_history, []),
    payment_status_history: parseJson(o.payment_status_history, []),
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    customer_email: o.customer_email,
    customer_city: o.customer_city,
    customer_address: o.customer_address,
    customer_note: o.customer_note,
    confirmed_at: o.confirmed_at,
    delivered_at: o.delivered_at,
    cancelled_at: o.cancelled_at,
    paid_at: o.paid_at,
    payments: extras.payments || [],
    transactions: extras.transactions || [],
    ...extras.additional,
  };
}

function enrich(orders) {
  const list = Array.isArray(orders) ? orders : [orders];
  return list.map((o) => {
    if (!o) return null;
    return serializeOrder(o, {
      order_items: listOrderItems(o.id),
      payments: listPaymentsForOrder(o.id),
      transactions: listTransactionsForOrder(o.id),
    });
  });
}

const emailNotification = async (order) => {
  const plain = { ...order, items: parseJson(order.items, []) };
  const results = [];
  const ownerAwait = sendOrderOwnerEmail({ order: plain }).then(
    () => ({ channel: "owner", ok: true, error: "" }),
    (err) => ({ channel: "owner", ok: false, error: err.message, code: err.code })
  );
  const customerAwait = plain.customer_email
    ? sendCustomerOrderConfirmationEmail({ order: plain }).then(
        () => ({ channel: "customer", ok: true, error: "" }),
        (err) => ({ channel: "customer", ok: false, error: err.message, code: err.code })
      )
    : Promise.resolve({ channel: "customer", ok: false, error: "No customer email", code: "NO_EMAIL" });

  const settled = await Promise.allSettled([ownerAwait, customerAwait]);
  for (const r of settled) {
    const res = r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message || "unknown" };
    const recipient = res.channel === "owner" ? ADMIN_EMAIL : plain.customer_email;
    // "not_configured" = the email provider has no credentials; never faked as sent.
    const status = res.ok ? "sent" : res.code === "MAIL_NOT_CONFIGURED" ? "not_configured" : "failed";
    logOrderEmail({
      order_id: plain.id,
      channel: res.channel,
      recipient: recipient || "",
      status,
      error: !res.ok ? (res.error || "") : "",
    });
    results.push(res);
  }
  return results;
};

// Honest single-purpose email for order lifecycle events (status changes,
// payment verification). Records sent / not_configured / failed in order_emails.
const notifyOrderTransform = async (orderId, channel, recipient, fn) => {
  const row = getOrder(orderId);
  if (!row) return;
  const plain = { ...row, items: parseJson(row.items, []) };
  try {
    await fn({ order: plain });
    logOrderEmail({ order_id: orderId, channel, recipient: recipient || "", status: "sent", error: "" });
  } catch (err) {
    const status = err.code === "MAIL_NOT_CONFIGURED" ? "not_configured" : "failed";
    logOrderEmail({ order_id: orderId, channel, recipient: recipient || "", status, error: err.message || "" });
  }
};

// POST /api/orders — authenticated checkout. Prices, totals, identity and stock
// are validated/determined server-side; the client never supplies the order id.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const user = getUserById(req.user.sub);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const b = req.body || {};
    const name = cleanString(b.customer_name, 100) || user.full_name;
    const phone = cleanString(b.customer_phone, 20) || user.phone;
    const city = cleanString(b.customer_city, 60);
    const address = cleanString(b.customer_address, 200);
    if (!name || name.length < 2) throw new ValidationError("Full name is required");
    if (!phone || !isPhone(phone)) throw new ValidationError("A valid phone is required");
    if (!city || city.length < 2) throw new ValidationError("City is required");
    if (!address || address.length < 8) throw new ValidationError("Address must be at least 8 characters");

    const { items, subtotal } = buildItems(b.items);
    const deliveryFee = DELIVERY_FEE;
    const total = subtotal + deliveryFee;
    const paymentMethod = cleanString(b.payment, 20);
    if (!PAYMENT_METHODS.some((m) => m.id === paymentMethod)) throw new ValidationError("Invalid payment method");

    let orderId = newOrderId();
    while (getOrder(orderId)) orderId = newOrderId();

    const paymentStatus =
      paymentMethod === "cod" ? "cod_pending"
      : paymentMethod === "bank_transfer" ? "verification_required"
      : "pending";

    const orderStatus = paymentMethod === "cod" ? "pending" : "pending";

    insertOrder({
      id: orderId,
      user_id: user.id,
      items,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      order_status: orderStatus,
      customer_name: name,
      customer_phone: phone,
      customer_email: user.email,
      customer_city: city,
      customer_address: address,
      customer_note: b.customer_note ? cleanString(b.customer_note, 500) : null,
    });

    insertOrderItems(orderId, items);
    reserveStock(items);

    const payment = insertPayment({
      order_id: orderId,
      method: paymentMethod,
      amount: total,
      status: paymentStatus,
    });

    appendStatusHistory(orderId, {
      order_status: orderStatus,
      payment_status: paymentStatus,
      note: `Order placed via ${paymentMethod}`,
    });

    clearCart(user.id);

    const order = getOrder(orderId);
    await emailNotification(order);

    res.status(201).json({
      order: serializeOrder(order, {
        order_items: listOrderItems(orderId),
        payments: listPaymentsForOrder(orderId),
        transactions: listTransactionsForOrder(orderId),
      }),
      payment: { id: payment.id, status: payment.status, method: payment.method },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/mine — authenticated customer's real orders
router.get("/mine", requireAuth, (req, res, next) => {
  try {
    res.json({ orders: enrich(listOrdersForUser(req.user.sub)).filter(Boolean) });
  } catch (e) { next(e); }
});

// GET /api/orders — admin list
router.get("/", requireAdmin, (req, res, next) => {
  try {
    const status = req.query.status === "all" ? null : req.query.status;
    const payment = req.query.payment === "all" ? null : req.query.payment;
    const paymentStatus = req.query.payment_status === "all" ? null : req.query.payment_status;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const q = cleanString(req.query.q, 200);
    const orders = listOrders({ status, payment, paymentStatus, q, limit, offset });
    const total = countOrders({ status, payment, paymentStatus, q });
    res.json({ orders: enrich(orders).filter(Boolean), total, limit, offset });
  } catch (e) { next(e); }
});

function allowOrder(req, order) {
  if (req.user?.role === "admin") return true;
  if (req.user && order && Number(order.user_id) === Number(req.user.sub)) return true;
  return false;
}

// GET /api/orders/:id — owner or admin only (security fix)
router.get("/:id", optionalUser, (req, res, next) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!allowOrder(req, order)) return res.status(403).json({ error: "Forbidden" });
    res.json({ order: enrich([order])[0] });
  } catch (e) { next(e); }
});

// PATCH /api/orders/:id/status — admin, transitions enforced server-side
router.patch("/:id/status", requireAdmin, (req, res, next) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const status = cleanString(req.body.status, 30);
    if (!status) throw new ValidationError("status is required");
    if (!ORDER_STATUSES.includes(status)) throw new ValidationError("Invalid status");
    if (!canTransition(order.order_status, status)) {
      throw new ValidationError(`Cannot move order from "${order.order_status}" to "${status}"`);
    }
    const patch = { order_status: status };
    const field = ({ confirmed: "confirmed_at", processing: "processing_at", shipped: "shipped_at", delivered: "delivered_at", cancelled: "cancelled_at" })[status];
    if (field) patch[field] = new Date().toISOString();

    if (["cancelled", "returned", "refunded"].includes(status)) {
      releaseStock(parseJson(order.items, []));
      if (order.payment_status === "paid") {
        updatePaymentByOrder(order.id, { status: "refunded" });
      }
    }
    updateOrder(order.id, patch);
    appendStatusHistory(order.id, { order_status: status, note: `Admin set status to ${status}` });

    notifyOrderTransform(order.id, `status_${status}`, order.customer_email, sendOrderStatusEmail);

    const updated = enrich([getOrder(order.id)])[0];
    res.json({ order: updated });
  } catch (e) { next(e); }
});

function updatePaymentByOrder(orderId, patch) {
  const payment = getPaymentByOrder(orderId);
  if (payment) updatePayment(payment.id, patch);
}

// POST /api/orders/:id/payment/reference — customer submits bank/JazzCash payment reference
router.post("/:id/payment/reference", requireAuth, (req, res, next) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!allowOrder(req, order)) return res.status(403).json({ error: "Forbidden" });
    if (order.payment_method === "cod") throw new ValidationError("COD orders do not require a payment reference");
    if (order.payment_status === "paid") throw new ValidationError("Payment already verified");

    const b = req.body || {};
    const senderName = cleanString(b.sender_name, 100);
    const txRef = cleanString(b.transaction_ref, 120);
    const notes = cleanString(b.notes, 500);
    if (!txRef) throw new ValidationError("Transaction/reference ID is required");

    let payment = getPaymentByOrder(order.id);
    if (!payment) {
      payment = insertPayment({ order_id: order.id, method: order.payment_method, amount: order.total, status: "submitted" });
    }

    const targetStatus = "verification_required";
    updatePayment(payment.id, {
      status: targetStatus,
      transaction_ref: txRef,
      sender_name: senderName,
      notes,
    });
    insertPaymentTransaction({
      payment_id: payment.id,
      gateway: order.payment_method,
      transaction_ref: txRef,
      raw_status: targetStatus,
      provider_payload: { sender_name: senderName, notes },
    });
    if (order.payment_status !== targetStatus) {
      appendStatusHistory(order.id, {
        order_status: order.order_status,
        payment_status: targetStatus,
        note: `Customer submitted reference ${txRef}`,
      });
    }

    notifyOrderTransform(order.id, "owner_payment_verify", ADMIN_EMAIL, (o) =>
      sendVerificationRequiredOwnerEmail({ order: { ...o.order, payment: { transaction_ref: txRef } } })
    );

    res.json({
      payment: {
        id: payment.id,
        status: targetStatus,
        transaction_ref: txRef,
      },
      order: enrich([getOrder(order.id)])[0],
    });
  } catch (e) { next(e); }
});

// POST /api/orders/:id/requests — authenticated owner only
router.post("/:id/requests", requireAuth, (req, res, next) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!allowOrder(req, order)) return res.status(403).json({ error: "Forbidden" });
    const type = cleanString(req.body.type, 20);
    if (!["cancel", "return", "refund"].includes(type)) throw new ValidationError("Invalid request type");
    if (type === "cancel" && !CANCELLABLE_STATES.includes(order.order_status)) {
      throw new ValidationError("This order can no longer be cancelled");
    }
    if ((type === "return" || type === "refund") && !RETURNABLE_STATES.includes(order.order_status)) {
      throw new ValidationError("Returns are only available after delivery");
    }
    const request = createOrderRequest(order.id, type, cleanString(req.body.reason, 500));
    res.status(201).json({ request });
  } catch (e) { next(e); }
});

const orderOr403 = (req, res, next) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!allowOrder(req, order)) return res.status(403).json({ error: "Forbidden" });
  req._order = order;
  next();
};

// GET /api/orders/:id/requests — owner or admin
router.get("/:id/requests", optionalUser, orderOr403, (req, res, next) => {
  try {
    res.json({ requests: listOrderRequests(req.params.id) });
  } catch (e) { next(e); }
});

// GET /api/orders/:id/payments — owner or admin
router.get("/:id/payments", optionalUser, orderOr403, (req, res, next) => {
  try {
    res.json({
      payments: listPaymentsForOrder(req.params.id),
      transactions: listTransactionsForOrder(req.params.id),
    });
  } catch (e) { next(e); }
});

// GET /api/orders/:id/emails — owner or admin
router.get("/:id/emails", optionalUser, orderOr403, (req, res, next) => {
  try {
    res.json({ emails: listOrderEmails(req.params.id) });
  } catch (e) { next(e); }
});

export default router;