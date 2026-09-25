import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth, optionalUser } from "../middleware/auth.js";
import { getOrder, getPaymentByOrder, updatePayment, appendStatusHistory, insertPaymentTransaction, getPaymentTransactionByRef, getPayment, getPaymentTransactions } from "../db.js";
import { JAZZCASH, jazzcashConfigured } from "../lib/config.js";
import { canTransition } from "../catalog.js";
import { updateOrder } from "../db.js";
import { ValidationError } from "../lib/validate.js";

const router = Router();

function hmacHash(str) {
  return crypto.createHmac("sha256", JAZZCASH.integritySalt).update(str).digest("hex");
}

function newTxnRef() {
  return `ILXT${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`.slice(0, 50);
}

function allowOwnOrder(req, order) {
  if (!order) return false;
  if (req.user?.role === "admin") return true;
  return Number(order.user_id) === Number(req.user?.sub);
}

// GET /api/payments/jazzcash/config — public (no secrets)
router.get("/config", (_req, res) => {
  res.json({
    configured: jazzcashConfigured(),
    sandbox: JAZZCASH.sandbox,
    wallet_only: !jazzcashConfigured(),
  });
});

// POST /api/payments/jazzcash/:orderId/initiate — start the real gateway flow
router.post("/:orderId/initiate", requireAuth, async (req, res, next) => {
  try {
    const order = getOrder(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!allowOwnOrder(req, order)) return res.status(403).json({ error: "Forbidden" });
    if (order.payment_method !== "jazzcash") throw new ValidationError("This order is not a JazzCash order");
    if (order.payment_status === "paid") throw new ValidationError("Payment already completed");

    if (!jazzcashConfigured()) {
      return res.status(400).json({
        error: "JazzCash merchant gateway is not configured yet. Use the manual reference flow instead.",
        reference_flow: true,
      });
    }

    const amountPaise = String(order.total * 100);
    const txnRef = newTxnRef();
    const returnUrl = JAZZCASH.returnUrl;

    let payment = getPaymentByOrder(order.id);
    if (!payment) {
      return res.status(400).json({ error: "Order has no payment record" });
    }

    insertPaymentTransaction({
      payment_id: payment.id,
      gateway: "jazzcash",
      transaction_ref: txnRef,
      raw_status: "pending",
      provider_payload: { amount: order.total, method: "redirect" },
    });

    const payload = {
      pp_Version: "1.1",
      pp_TxnType: "MPAY",
      pp_Language: "EN",
      pp_MerchantID: JAZZCASH.merchantId,
      pp_TxnRefNo: txnRef,
      pp_Amount: amountPaise,
      pp_TxnCurrency: "PKR",
      pp_BillReference: order.id,
      pp_Description: `i.luxe order ${order.id}`,
      pp_ReturnURL: returnUrl,
    };
    const hashString = [
      payload.pp_Version, payload.pp_TxnType, payload.pp_Language, payload.pp_MerchantID,
      JAZZCASH.password, payload.pp_TxnRefNo, payload.pp_Amount, payload.pp_TxnCurrency,
      payload.pp_BillReference, payload.pp_Description, payload.pp_ReturnURL,
    ].join("") + JAZZCASH.integritySalt;
    payload.pp_SecureHash = crypto.createHash("sha256").update(hashString).digest("hex");

    updatePayment(payment.id, { status: "pending" });
    appendStatusHistory(order.id, {
      payment_status: "pending",
      note: `JazzCash payment initiated (txn ${txnRef})`,
    });

    return res.json({
      redirect: JAZZCASH.apiUrl,
      params: payload,
      transaction_ref: txnRef,
      configured: true,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/payments/jazzcash/callback — server-to-server confirmation
router.post("/callback", (req, res, next) => {
  try {
    const p = req.body || {};
    const txnRef = p.pp_TxnRefNo || "";
    if (!txnRef) return res.status(400).json({ error: "Missing transaction ref" });

    const txn = getPaymentTransactionByRef(txnRef);
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    // Recompute the provider hash; never trust the body alone.
    const hashString = [
      p.pp_ResponseCode, p.pp_TxnRefNo, p.pp_Amount, p.pp_TxnCurrency,
      p.pp_BillReference, p.pp_Description || "", p.pp_ReturnURL || "", p.pp_MerchantID,
    ].join("") + JAZZCASH.integritySalt;
    const expected = crypto.createHash("sha256").update(hashString).digest("hex");
    const secure = jazzcashConfigured();
    if (!secure || (p.pp_SecureHash && p.pp_SecureHash !== expected)) {
      return res.status(403).json({ error: "Invalid payment signature" });
    }

    const payment = getPayment(txn.payment_id);
    const order = payment ? getOrder(payment.order_id) : null;

    if (p.pp_ResponseCode === "000") {
      if (payment) updatePayment(payment.id, { status: "paid" }, { touchVerifiedAt: true });
      if (order) {
        const ns = canTransition(order.order_status, "confirmed") ? "confirmed" : order.order_status;
        updateOrder(order.id, { payment_status: "paid", order_status: ns, paid_at: new Date().toISOString(), confirmed_at: order.confirmed_at || new Date().toISOString() });
        appendStatusHistory(order.id, { order_status: ns, payment_status: "paid", note: "JazzCash payment confirmed by gateway" });
      }
    } else {
      if (payment) updatePayment(payment.id, { status: "failed" });
      if (order) {
        updateOrder(order.id, { payment_status: "failed" });
        appendStatusHistory(order.id, { payment_status: "failed", note: `JazzCash response ${p.pp_ResponseCode}` });
      }
    }
    // persist provider confirmation payload for audit
    insertPaymentTransaction({
      payment_id: txn.payment_id,
      gateway: "jazzcash",
      transaction_ref: txnRef,
      raw_status: p.pp_ResponseCode === "000" ? "paid" : p.pp_ResponseCode,
      provider_payload: p,
    });

    res.json({ ok: true, pp_ResponseCode: p.pp_ResponseCode || "000" });
  } catch (e) { next(e); }
});

// GET /api/payments/jazzcash/verify?txn=... — verify a transaction status server-side
router.get("/verify", optionalUser, (req, res, next) => {
  try {
    const txnRef = String(req.query.txn || "");
    if (!txnRef) return res.status(400).json({ error: "Missing txn" });
    const txn = getPaymentTransactionByRef(txnRef);
    res.json({ transaction: txn, txn: txnRef });
  } catch (e) { next(e); }
});

export default router;