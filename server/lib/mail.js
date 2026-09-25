import nodemailer from "nodemailer";
import { ADMIN_EMAIL, IS_PROD } from "./config.js";

let transporter = null;

// Errors raised here are intentionally *sanitized*: the raw SMTP/nodemailer
// error is never forwarded to the client or the generic server logger, so an
// API key or auth handshake can never end up in a response body or a log line.
// Only a stable `code` plus a human-readable, actionable `message` escapes.
const MAIL_MESSAGES = {
  MAIL_NOT_CONFIGURED: "Email service is not configured. Set RESEND_API_KEY in the server environment.",
  MAIL_SENDER_RESTRICTED:
    "Email service rejected the sender. The from address is Resend's testing address (onboarding@resend.dev), which can only send to the Resend account owner's own email. Verify a sending domain at resend.com/domains and set MAIL_FROM to an address on that verified domain.",
  MAIL_SENDER_UNVERIFIED:
    "Email service rejected the sender. The from address is not on a verified domain. Verify the sending domain at resend.com/domains and set MAIL_FROM to an address on it.",
  MAIL_AUTH_FAILED: "Email service rejected the API credentials. Check RESEND_API_KEY in the server environment.",
  MAIL_TRANSPORT_FAILED: "Could not reach the email service. Check SMTP_HOST / SMTP_PORT / SMTP_SECURE and network access.",
  MAIL_SEND_FAILED: "Email service refused to send the message. Please try again in a moment.",
};

function mailError(code, cause) {
  const err = new Error(MAIL_MESSAGES[code] || MAIL_MESSAGES.MAIL_SEND_FAILED);
  err.code = code;
  err.cause = cause;
  return err;
}

// Map a raw nodemailer/SMTP failure onto one of the codes above. The provider
// response text is only inspected to pick a code — it is never returned or
// logged verbatim.
function classifyMailError(err) {
  if (err?.code && MAIL_MESSAGES[err.code]) return err;
  if (!mailConfigured()) return mailError("MAIL_NOT_CONFIGURED", err);

  const response = String(err?.response || "");
  const responseCode = Number(err?.responseCode || 0);

  if (/only send testing emails to your own email address/i.test(response)) {
    return mailError("MAIL_SENDER_RESTRICTED", err);
  }
  if (responseCode === 550 || responseCode === 553 || /unverified|sender .* not verified|not allowed to send/i.test(response)) {
    return mailError("MAIL_SENDER_UNVERIFIED", err);
  }
  if (responseCode === 401 || responseCode === 403 || /invalid api key|authentication/i.test(response)) {
    return mailError("MAIL_AUTH_FAILED", err);
  }
  if (["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "EAI_AGAIN"].includes(err?.code)) {
    return mailError("MAIL_TRANSPORT_FAILED", err);
  }
  return mailError("MAIL_SEND_FAILED", err);
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.resend.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) !== "false",
    auth: { user: process.env.SMTP_USER || "resend", pass: process.env.RESEND_API_KEY || "" },
  });
  return transporter;
}

export function mailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

function requireMail() {
  if (!mailConfigured()) throw mailError("MAIL_NOT_CONFIGURED");
}

function fromAddress() {
  return process.env.MAIL_FROM || "i.luxe Perfume <noreply@iluxe.dev>";
}

// Resend's `onboarding@resend.dev` / `noreply@resend.dev` senders are test-only:
// the provider accepts them but refuses delivery to any address other than the
// Resend account owner's. Detecting it at boot turns a silent delivery failure
// into a visible startup warning.
export function mailSenderIssue() {
  const from = fromAddress();
  if (!mailConfigured()) return { code: "MAIL_NOT_CONFIGURED", message: MAIL_MESSAGES.MAIL_NOT_CONFIGURED };
  if (/@resend\.dev>?$/i.test(from.trim())) {
    return { code: "MAIL_SENDER_RESTRICTED", message: MAIL_MESSAGES.MAIL_SENDER_RESTRICTED };
  }
  return null;
}

// Boot-time, secret-free summary of the mail configuration.
export function mailStartupReport() {
  return {
    configured: mailConfigured(),
    from: fromAddress(),
    host: process.env.SMTP_HOST || "smtp.resend.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) !== "false",
    issue: mailSenderIssue(),
  };
}

// Every send goes through here so a provider failure always becomes a
// classified MailError instead of an opaque nodemailer exception.
async function send(payload) {
  requireMail();
  try {
    const info = await getTransporter().sendMail({ from: fromAddress(), ...payload });
    return { delivered: true, messageId: info?.messageId || "" };
  } catch (err) {
    throw classifyMailError(err);
  }
}

function money(n) {
  return `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso || "") : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function orderItemsHtml(items) {
  return (items || [])
    .map(
      (i) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${i.name}${i.size ? ` (${i.size})` : ""}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(i.price)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(i.price * i.qty)}</td>
        </tr>`
    )
    .join("");
}

function paymentLabel(method) {
  return method === "cod" ? "Cash on Delivery"
    : method === "bank_transfer" ? "Bank Transfer"
    : method === "jazzcash" ? "JazzCash" : method;
}

export function paymentStatusLabel(s) {
  return s === "cod_pending" ? "COD Pending"
    : s === "verification_required" ? "Awaiting Verification"
    : s === "submitted" ? "Submitted"
    : String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function shell({ title, preHeader, body }) {
  return `<!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#111;margin:0;background:#f6f6f6;">
    <div style="max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#0a132f;color:#fff;padding:28px 32px;">
        <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c7ccd8;">I. Luxe Perfume</div>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;">${title}</h1>
      </div>
      <div style="padding:32px;">${body}</div>
      <div style="padding:20px 32px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#888;">
        i.luxe Perfume — Luxury fragrances delivered across Karachi
      </div>
    </div>
  </body>
  </html>`;
}

function totalBlock(subtotal, deliveryFee, total) {
  return `
    <div style="background:#fafafa;padding:16px;border-radius:8px;margin:20px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#666;">Subtotal</td><td style="text-align:right;">${money(subtotal)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Delivery Fee</td><td style="text-align:right;">${money(deliveryFee)}</td></tr>
        <tr style="border-top:1px solid #e5e5e5;">
          <td style="padding:10px 0 6px;font-weight:600;font-size:16px;">Total</td>
          <td style="text-align:right;font-weight:600;font-size:16px;">${money(total)}</td>
        </tr>
      </table>
    </div>`;
}

export async function sendOtpEmail({ to, otp }) {
  return send({
    to,
    subject: "Your i.luxe login code",
    text: `Your login code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: shell({
      title: "Your verification code",
      body: `
        <p>Hello,</p>
        <p>Your i.luxe Perfume verification code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0a132f;text-align:center;padding:12px;background:#fafafa;border:1px solid #eee;border-radius:8px;">${otp}</p>
        <p>This code expires in 10 minutes. If you did not request a login, please ignore this email.</p>`,
    }),
  });
}

export async function sendOrderOwnerEmail({ order }) {
  requireMail();
  const items = order.items || [];
  const customerEmail = order.customer_email || "not provided";
  const html = shell({
    title: `New order ${order.id}`,
    preHeader: `PKR ${order.total.toLocaleString()} — ${paymentLabel(order.payment_method)}`,
    body: `
      <p style="color:#666;">A new order has been placed. Details below.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#666;width:140px;">Order ID</td><td style="font-weight:600;">${order.id}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Date/time</td><td>${order.created_at ? fmtDate(order.created_at + (order.created_at.includes("T") ? "" : "Z")) : ""}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Customer</td><td>${order.customer_name}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Email</td><td>${customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Phone</td><td>${order.customer_phone}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Address</td><td>${order.customer_address}, ${order.customer_city}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Payment method</td><td>${paymentLabel(order.payment_method)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Payment status</td><td>${paymentStatusLabel(order.payment_status)}</td></tr>
      </table>
      <h2 style="font-size:16px;margin:24px 0 12px;">Ordered products</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#fafafa;"><th style="padding:8px;text-align:left;">Product</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${orderItemsHtml(items)}</tbody>
      </table>
      ${totalBlock(order.subtotal, order.delivery_fee, order.total)}
      <p><a href="${process.env.SITE_URL || "http://localhost:5173"}/admin" style="display:inline-block;padding:12px 24px;background:#0a132f;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">Open Admin Dashboard</a></p>`,
  });
  await send({
    to: ADMIN_EMAIL,
    replyTo: order.customer_email || ADMIN_EMAIL,
    subject: `New Order ${order.id} — ${money(order.total)} (${paymentLabel(order.payment_method)})`,
    text: `New order ${order.id} from ${order.customer_name} (${order.phone ?? order.customer_phone}). Total ${money(order.total)} via ${paymentLabel(order.payment_method)}.`,
    html,
  });
  return { delivered: true };
}

async function deliver({ to, replyTo, subject, text, html }) {
  return send({ to, replyTo: replyTo || ADMIN_EMAIL, subject, text, html });
}

export async function sendCustomerOrderConfirmationEmail({ order }) {
  requireMail();
  const items = order.items || [];
  const statusText = order.payment_method === "cod"
    ? "Your order is confirmed for Cash on Delivery. Please keep the exact amount ready for the rider."
    : `Your payment is being verified. You will be notified as soon as it is confirmed.`;
  const html = shell({
    title: `Order ${order.id} received`,
    preHeader: `Total ${money(order.total)}`,
    body: `
      <p>Hi ${order.customer_name},</p>
      <p>Thank you for shopping with i.luxe Perfume. We've received your order:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#666;width:140px;">Order ID</td><td style="font-weight:600;">${order.id}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Date/time</td><td>${order.created_at ? fmtDate(order.created_at + (order.created_at.includes("T") ? "" : "Z")) : ""}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Delivering to</td><td>${order.customer_address}, ${order.customer_city}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Payment method</td><td>${paymentLabel(order.payment_method)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Payment status</td><td>${paymentStatusLabel(order.payment_status)}</td></tr>
      </table>
      <h2 style="font-size:16px;margin:24px 0 12px;">Order items</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#fafafa;"><th style="padding:8px;text-align:left;">Product</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${orderItemsHtml(items)}</tbody>
      </table>
      ${totalBlock(order.subtotal, order.delivery_fee, order.total)}
      <p>${statusText}</p>
      <p>You can track this order in your account area at any time.</p>`,
  });
  await send({
    to: order.customer_email,
    replyTo: ADMIN_EMAIL,
    subject: `Your i.luxe order ${order.id} is confirmed`,
    text: `Order ${order.id} received. Total ${money(order.total)} via ${paymentLabel(order.payment_method)}. You can track it from your account.`,
    html,
  });
  return { delivered: true };
}

// Notification to the owner when a bank/JazzCash reference needs verification.
export async function sendVerificationRequiredOwnerEmail({ order }) {
  return deliver({
    to: ADMIN_EMAIL,
    subject: `Payment verification required — ${order.id}`,
    text: `Customer ${order.customer_name} submitted a payment reference for order ${order.id} (${money(order.total)} via ${paymentLabel(order.payment_method)}). Open the admin dashboard to verify it.`,
    html: shell({
      title: `Verify payment — ${order.id}`,
      body: `
        <p>A customer has submitted a payment reference that needs your confirmation.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:140px;">Order ID</td><td style="font-weight:600;">${order.id}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Customer</td><td>${order.customer_name} (${order.customer_phone})</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Total</td><td>${money(order.total)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Method</td><td>${paymentLabel(order.payment_method)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Reference</td><td>${order.payment?.transaction_ref || order.transaction_ref || "—"}</td></tr>
        </table>
        <p><a href="${process.env.SITE_URL || "http://localhost:5173"}/admin" style="display:inline-block;padding:12px 24px;background:#0a132f;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">Open Admin Dashboard</a></p>`,
    }),
  });
}

// Customer notification once their non-COD payment is verified as paid.
export async function sendPaymentApprovedEmail({ order }) {
  return deliver({
    to: order.customer_email,
    subject: `Payment confirmed — order ${order.id}`,
    text: `Your payment of ${money(order.total)} for order ${order.id} has been verified. Your order is confirmed and will be shipped soon.`,
    html: shell({
      title: `Payment confirmed — ${order.id}`,
      body: `
        <p>Hi ${order.customer_name},</p>
        <p>Your payment of <strong>${money(order.total)}</strong> (${paymentLabel(order.payment_method)}, ref ${order.payment?.transaction_ref || "—"}) has been verified and your order is now <strong>confirmed</strong>.</p>
        <p>We will ship it to ${order.customer_address}, ${order.customer_city} as soon as possible. Track it from your account any time.</p>`,
    }),
  });
}

// Customer status-update email (confirmed / processing / shipped / out for delivery / delivered / cancelled).
export async function sendOrderStatusEmail({ order }) {
  const labels = {
    pending: "received",
    confirmed: "confirmed",
    processing: "being prepared",
    shipped: "shipped",
    out_for_delivery: "out for delivery",
    delivered: "delivered",
    cancelled: "cancelled",
    returned: "returned",
    refunded: "refunded",
    refund_pending: "refund in progress",
    return_requested: "return requested",
  };
  const label = labels[order.order_status] || order.order_status;
  const headline = order.order_status === "cancelled" ? "Your order was cancelled"
    : order.order_status === "delivered" ? "Your order has been delivered"
    : order.order_status === "out_for_delivery" ? "Your order is out for delivery"
    : order.order_status === "shipped" ? "Your order has shipped"
    : order.order_status === "processing" ? "Your order is being prepared"
    : `Order ${order.id} — ${label}`;
  return deliver({
    to: order.customer_email,
    subject: `Your i.luxe order ${order.id} is ${label}`,
    text: `Your order ${order.id} is now ${label}. Total ${money(order.total)}.`,
    html: shell({
      title: headline,
      body: `
        <p>Hi ${order.customer_name},</p>
        <p>Your order <strong>${order.id}</strong> is now <strong>${label}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:140px;">Order ID</td><td style="font-weight:600;">${order.id}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Status</td><td>${label.toUpperCase()}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Total</td><td>${money(order.total)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Delivering to</td><td>${order.customer_address}, ${order.customer_city}</td></tr>
        </table>
        <p>You can track this order from your account at any time.</p>`,
    }),
  });
}

// Owner notification for a new newsletter subscription.
export async function sendSubscriptionNoticeEmail({ email }) {
  return deliver({
    to: ADMIN_EMAIL,
    subject: `New newsletter subscriber`,
    text: `${email} subscribed to the i.luxe newsletter.`,
    html: shell({
      title: "New newsletter subscriber",
      body: `<p>A new guest subscribed to the i.luxe newsletter:</p>
        <p style="font-size:18px;font-weight:600;color:#0a132f;">${email}</p>`,
    }),
  });
}

// Owner notification for a contact form message. Reply-To is the visitor.
export async function sendContactNoticeEmail({ message }) {
  return deliver({
    to: ADMIN_EMAIL,
    replyTo: message.email,
    subject: `Website message from ${message.name}`,
    text: `${message.name} (${message.email}) wrote:\n\n${message.message}`,
    html: shell({
      title: `Message from ${message.name}`,
      body: `
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:120px;">Name</td><td>${message.name}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Email</td><td>${message.email}</td></tr>
          ${message.phone ? `<tr><td style="padding:6px 0;color:#666;">Phone</td><td>${message.phone}</td></tr>` : ""}
          ${message.subject ? `<tr><td style="padding:6px 0;color:#666;">Subject</td><td>${message.subject}</td></tr>` : ""}
        </table>
        <div style="background:#fafafa;padding:16px;border-radius:8px;margin:16px 0;white-space:pre-wrap;">${message.message.split("\n").join("<br>")}</div>
        <p>Reply to this email to contact the visitor directly.</p>`,
    }),
  });
}

export { IS_PROD };