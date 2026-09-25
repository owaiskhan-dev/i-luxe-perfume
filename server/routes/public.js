import { Router } from "express";
import {
  addSubscription, getSubscriptionByEmail, listSubscriptions,
  insertContactMessage, listContactMessages, getContactMessage, countContactMessages, updateContactMessageStatus,
  insertOutbox,
} from "../db.js";
import { isEmail, isPhone, cleanString, ValidationError } from "../lib/validate.js";
import { sendSubscriptionNoticeEmail, sendContactNoticeEmail } from "../lib/mail.js";

const router = Router();

// POST /api/subscribe — store real subscriptions (deduped) and notify the owner.
router.post("/subscribe", async (req, res, next) => {
  try {
    const email = cleanString(req.body?.email, 200).toLowerCase();
    if (!isEmail(email)) throw new ValidationError("A valid email address is required");

    const sub = addSubscription({ email, source: cleanString(req.body?.source, 60) || "website" });

    let emailStatus = "not_configured";
    let emailError = "Mail is not configured (RESEND_API_KEY missing)";
    try {
      await sendSubscriptionNoticeEmail({ email });
      emailStatus = "sent";
      emailError = "";
    } catch (err) {
      if (err.code !== "MAIL_NOT_CONFIGURED") {
        emailStatus = "failed";
        emailError = err.message;
      }
    }
    insertOutbox({ purpose: "subscription", recipient: email, status: emailStatus, error: emailError });

    res.status(201).json({
      ok: true,
      subscribed: !!(sub.active),
      email,
      owner_notified: emailStatus === "sent",
    });
  } catch (e) { next(e); }
});

// POST /api/contact — store real messages and email the owner (reply-to the visitor).
router.post("/contact", async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = cleanString(b.name, 100);
    const email = cleanString(b.email, 200).toLowerCase();
    const message = cleanString(b.message, 2000);
    if (name.length < 2) throw new ValidationError("Full name is required");
    if (!isEmail(email)) throw new ValidationError("A valid email address is required");
    if (message.length < 10) throw new ValidationError("Please write a few words in your message");

    const phone = cleanString(b.phone, 20);
    if (phone && !isPhone(phone)) throw new ValidationError("Invalid phone number");

    const msg = insertContactMessage({
      name,
      email,
      phone,
      subject: cleanString(b.subject, 200),
      message,
    });

    let emailStatus = "not_configured";
    let emailError = "Mail is not configured (RESEND_API_KEY missing)";
    try {
      await sendContactNoticeEmail({ message: msg });
      emailStatus = "sent";
      emailError = "";
    } catch (err) {
      if (err.code !== "MAIL_NOT_CONFIGURED") {
        emailStatus = "failed";
        emailError = err.message;
      }
    }
    insertOutbox({ purpose: "contact", recipient: email, status: emailStatus, error: emailError });

    res.status(201).json({
      ok: true,
      message_id: msg.id,
      owner_notified: emailStatus === "sent",
    });
  } catch (e) { next(e); }
});

export default router;