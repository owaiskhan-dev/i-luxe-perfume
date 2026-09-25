import { Router } from "express";
import crypto from "node:crypto";
import { requireAdmin } from "../middleware/auth.js";
import { signToken } from "../lib/jwt.js";
import {
  getAdminSetup, setAdminSetup, recordAdminAttempt, resetAdminAttempts,
  lockAdminAttempts, clearExpiredAdminAttempt, getDashboardStats,
  getOrderRequest, decideOrderRequest, getOrder, updateOrder,
  listAllOrderRequests, getPayment, updatePayment, listAllPayments,
  getPaymentByOrder, listOrderEmails, appendStatusHistory,
  releaseStock, listReviews, getReview, updateReviewStatus, reviewCounts,
  listSubscriptions, listContactMessages, getContactMessage, updateContactMessageStatus,
  countContactMessages, logOrderEmail,
} from "../db.js";
import { cleanString, ValidationError } from "../lib/validate.js";
import { ADMIN_CODE, ADMIN_PASSWORD, ADMIN_MAX_ATTEMPTS, ADMIN_LOCK_SECONDS, BANK_TRANSFER, JAZZCASH_WALLET, JAZZCASH, jazzcashConfigured, IS_PROD } from "../lib/config.js";
import { mailConfigured, sendPaymentApprovedEmail, sendOrderStatusEmail } from "../lib/mail.js";
import { canTransition, ORDER_STATUSES, ORDER_TRANSITIONS, PAYMENT_STATUSES } from "../catalog.js";

const router = Router();

function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

function jsonItems(order) {
  try { return JSON.parse(order?.items || "[]"); } catch { return []; }
}

function adminConfigured() {
  const envOk = !!(ADMIN_CODE && ADMIN_PASSWORD);
  const dbOk = !!(getAdminSetup("admin_code_hash")?.value && getAdminSetup("admin_password_hash")?.value);
  return { envOk, dbOk, configured: envOk || dbOk };
}

router.get("/status", (_req, res) => {
  const { configured } = adminConfigured();
  res.json({ setup_required: !configured, configured });
});

router.post("/setup", (req, res, next) => {
  try {
    // Production is env-only: never let a public endpoint rewrite the owner's
    // admin credentials over an env-managed or existing setup.
    if (IS_PROD && adminConfigured().configured) {
      return res.status(403).json({ error: "Admin credentials are managed by the server environment in production" });
    }
    const { code, password } = req.body || {};
    if (typeof code !== "string" || code.length < 4) throw new ValidationError("Secret code must be at least 4 characters");
    if (typeof password !== "string" || password.length < 4) throw new ValidationError("Password must be at least 4 characters");
    setAdminSetup("admin_code_hash", sha256(code));
    setAdminSetup("admin_password_hash", sha256(password));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

function adminLockCheck(key) {
  const row = clearExpiredAdminAttempt(key, 3600);
  const now = Math.floor(Date.now() / 1000);
  if (row && row.locked_until > now) {
    return { locked: true, seconds: row.locked_until - now };
  }
  return { locked: false };
}

// Env credentials are authoritative when both are present; otherwise fall back
// to a hash stored via /setup (dev only). No credentials at all => refuse.
function storedCreds() {
  if (ADMIN_CODE && ADMIN_PASSWORD) {
    return { codeHash: sha256(ADMIN_CODE), passHash: sha256(ADMIN_PASSWORD) };
  }
  const codeHash = getAdminSetup("admin_code_hash")?.value || "";
  const passHash = getAdminSetup("admin_password_hash")?.value || "";
  return { codeHash, passHash };
}

router.post("/login", (req, res, next) => {
  try {
    const n = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `admin:${n}`;

    const { codeHash, passHash } = storedCreds();
    if (!codeHash || !passHash) {
      return res.status(503).json({ error: "Admin credentials are not configured. Set ADMIN_CODE and ADMIN_PASSWORD in the server environment." });
    }

    const lock = adminLockCheck(key);
    if (lock.locked) {
      return res.status(429).json({ error: `Too many attempts. Retry in ${lock.seconds}s`, retry_in: lock.seconds });
    }

    const code = cleanString(req.body?.code, 100);
    const password = req.body?.password == null ? "" : String(req.body.password);

    if (sha256(code) === codeHash && sha256(password) === passHash) {
      resetAdminAttempts(key);
      const token = signToken({ sub: "admin", role: "admin", email: "admin" }, "12h");
      return res.json({ token });
    }

    const row = recordAdminAttempt(key);
    if ((row.count || 0) >= ADMIN_MAX_ATTEMPTS) {
      lockAdminAttempts(key, Math.floor(Date.now() / 1000) + ADMIN_LOCK_SECONDS);
      return res.status(429).json({ error: `Too many attempts. Retry in ${ADMIN_LOCK_SECONDS}s`, retry_in: ADMIN_LOCK_SECONDS });
    }
    res.status(401).json({ error: "Incorrect code or password", remaining: ADMIN_MAX_ATTEMPTS - (row.count || 0) });
  } catch (e) { next(e); }
});

// Server-side configuration the admin may need (never includes secrets).
router.get("/config", requireAdmin, (_req, res) => {
  res.json({
    bank_transfer: BANK_TRANSFER,
    jazzcash: { wallet: JAZZCASH_WALLET, gateway_configured: jazzcashConfigured(), sandbox: JAZZCASH.sandbox },
    jazzcash_configured: jazzcashConfigured(),
    mail_configured: mailConfigured(),
    order_statuses: ORDER_STATUSES,
    order_transitions: ORDER_TRANSITIONS,
    payment_statuses: PAYMENT_STATUSES,
  });
});

router.get("/stats", requireAdmin, (req, res, next) => {
  try {
    res.json({ stats: getDashboardStats() });
  } catch (e) { next(e); }
});

router.get("/requests", requireAdmin, (req, res, next) => {
  try {
    res.json({ requests: listAllOrderRequests() });
  } catch (e) { next(e); }
});

// Approve/reject cancel, return or refund requests. State transitions enforced.
router.post("/requests/:id/decide", requireAdmin, async (req, res, next) => {
  try {
    const request = getOrderRequest(Number(req.params.id));
    if (!request) return res.status(404).json({ error: "Request not found" });
    const status = cleanString(req.body.status, 20);
    if (!["approved", "rejected"].includes(status)) throw new ValidationError("Invalid decision");
    const order = getOrder(request.order_id);
    if (!order) throw new ValidationError("Order not found");

    if (status === "approved") {
      const nextStatus =
        request.type === "cancel" ? "cancelled"
        : request.type === "return" ? "return_requested"
        : "refund_pending";
      if (!canTransition(order.order_status, nextStatus)) {
        throw new ValidationError(`Cannot apply "${request.type}" to this order state`);
      }
    }

    const decided = decideOrderRequest(request.id, {
      status,
      admin_note: cleanString(req.body.admin_note, 500),
      decided_by: "admin",
    });

    if (status === "approved") {
      const nextStatus =
        request.type === "cancel" ? "cancelled"
        : request.type === "return" ? "return_requested"
        : "refund_pending";
      const patch = { order_status: nextStatus };
      if (nextStatus === "cancelled") patch.cancelled_at = new Date().toISOString();
      updateOrder(order.id, patch);
      appendStatusHistory(order.id, {
        order_status: nextStatus,
        note: `${request.type} request approved`,
      });
      if (["cancelled", "returned", "refunded", "return_requested", "refund_pending"].includes(nextStatus)) {
        releaseStock(jsonItems(order));
      }
      if (order.payment_status === "paid") {
        const payment = getPaymentByOrder(order.id);
        if (payment) updatePayment(payment.id, { status: "refunded" });
      }
      // Notify the customer that their request was approved (honest logging).
      (async () => {
        try {
          await sendOrderStatusEmail({ order: { ...order, order_status: nextStatus, items: jsonItems(order) } });
          logOrderEmail({ order_id: order.id, channel: `status_${nextStatus}`, recipient: order.customer_email || "", status: "sent", error: "" });
        } catch (err) {
          const logStatus = err.code === "MAIL_NOT_CONFIGURED" ? "not_configured" : "failed";
          logOrderEmail({ order_id: order.id, channel: `status_${nextStatus}`, recipient: order.customer_email || "", status: logStatus, error: err.message || "" });
        }
      })();
    }
    res.json({ request: decided });
  } catch (e) { next(e); }
});

router.get("/payments", requireAdmin, (req, res, next) => {
  try {
    const payments = listAllPayments({
      status: req.query.status === "all" ? null : req.query.status,
      limit: Math.min(Number(req.query.limit) || 100, 500),
      offset: Math.max(Number(req.query.offset) || 0, 0),
    });
    res.json({ payments });
  } catch (e) { next(e); }
});

// Admin verifies (paid) or rejects (failed) a submitted bank/JazzCash payment,
// or marks it refunded. The order's payment status follows the real record.
router.post("/payments/:id/verify", requireAdmin, async (req, res, next) => {
  try {
    const payment = getPayment(Number(req.params.id));
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    const status = cleanString(req.body.status, 20);
    if (!["paid", "failed", "refunded", "verification_required"].includes(status)) throw new ValidationError("Invalid payment status");
    const note = cleanString(req.body.note, 300);
    const verifiedBy = req.user?.sub || "admin";

    updatePayment(payment.id, { status, verified_by: verifiedBy }, { touchVerifiedAt: status === "paid" });

    const order = getOrder(payment.order_id);
    if (order) {
      if (status === "paid") {
        const newOrderStatus = canTransition(order.order_status, "confirmed") ? "confirmed" : order.order_status;
        updateOrder(order.id, {
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          order_status: newOrderStatus,
          confirmed_at: order.confirmed_at || new Date().toISOString(),
        });
        appendStatusHistory(order.id, {
          order_status: newOrderStatus,
          payment_status: "paid",
          note: `Payment verified by admin (${verifiedBy})${note ? ` (${note})` : ""}`,
        });
        // Notify the customer that their payment cleared (honest logging).
        try {
          await sendPaymentApprovedEmail({ order: { ...order, items: jsonItems(order), payment: { transaction_ref: payment.transaction_ref } } });
          logOrderEmail({ order_id: order.id, channel: "customer_payment_approved", recipient: order.customer_email || "", status: "sent", error: "" });
        } catch (err) {
          const logStatus = err.code === "MAIL_NOT_CONFIGURED" ? "not_configured" : "failed";
          logOrderEmail({ order_id: order.id, channel: "customer_payment_approved", recipient: order.customer_email || "", status: logStatus, error: err.message || "" });
        }
      } else if (status === "failed") {
        updateOrder(order.id, { payment_status: "failed" });
        appendStatusHistory(order.id, { payment_status: "failed", note: `Payment rejected by admin${note ? ` (${note})` : ""}` });
      } else if (status === "refunded") {
        updateOrder(order.id, { payment_status: "refunded", refunded_at: new Date().toISOString() });
        appendStatusHistory(order.id, { payment_status: "refunded", note: `Payment refunded${note ? ` (${note})` : ""}` });
      } else {
        updateOrder(order.id, { payment_status: "verification_required" });
      }
    }

    // record the decision in status payload is handled by consumers via api; here reflect on payment
    res.json({
      payment: getPayment(payment.id),
      note,
    });
  } catch (e) { next(e); }
});

router.get("/orders/:id/emails", requireAdmin, (req, res, next) => {
  try {
    res.json({ emails: listOrderEmails(req.params.id) });
  } catch (e) { next(e); }
});

// ---- Review moderation --------------------------------------------------------

router.get("/reviews", requireAdmin, (req, res, next) => {
  try {
    const reviews = listReviews({
      status: cleanString(req.query.status, 20) || "all",
      limit: Math.min(Number(req.query.limit) || 200, 500),
    });
    res.json({ reviews, counts: reviewCounts() });
  } catch (e) { next(e); }
});

router.patch("/reviews/:id", requireAdmin, (req, res, next) => {
  try {
    const review = getReview(Number(req.params.id));
    if (!review) return res.status(404).json({ error: "Review not found" });
    const status = cleanString(req.body?.status, 20);
    if (!["approved", "rejected"].includes(status)) throw new ValidationError("Invalid review decision");
    const updated = updateReviewStatus(review.id, status, {
      decided_by: req.user?.sub || "admin",
      admin_note: cleanString(req.body?.note, 500),
    });
    res.json({ review: updated });
  } catch (e) { next(e); }
});

// ---- Newsletters & contact inbox ----------------------------------------------

router.get("/subscriptions", requireAdmin, (req, res, next) => {
  try {
    res.json({ subscriptions: listSubscriptions() });
  } catch (e) { next(e); }
});

router.get("/contact", requireAdmin, (req, res, next) => {
  try {
    const status = cleanString(req.query.status, 20) || "all";
    res.json({
      messages: listContactMessages({ status, limit: Math.min(Number(req.query.limit) || 200, 500) }),
      total: countContactMessages({ status }),
    });
  } catch (e) { next(e); }
});

router.patch("/contact/:id", requireAdmin, (req, res, next) => {
  try {
    const message = getContactMessage(Number(req.params.id));
    if (!message) return res.status(404).json({ error: "Message not found" });
    const status = cleanString(req.body?.status, 20);
    if (!["new", "replied", "archived"].includes(status)) throw new ValidationError("Invalid message status");
    res.json({ message: updateContactMessageStatus(message.id, status) });
  } catch (e) { next(e); }
});

export default router;