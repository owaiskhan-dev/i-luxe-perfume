import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { signToken } from "../lib/jwt.js";
import { sendOtpEmail } from "../lib/mail.js";
import {
  getOtp, setOtp, invalidateOtp, bumpOtpAttempts,
  getUserByEmail, createUser, updateUserProfile, getUserById,
} from "../db.js";
import {
  isEmail, cleanString, isPhone, ValidationError,
} from "../lib/validate.js";
import {
  OTP_TTL_SECONDS, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS,
} from "../lib/config.js";

const router = Router();

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

router.post("/otp/send", async (req, res, next) => {
  try {
    const email = cleanString(req.body?.email, 200);
    if (!isEmail(email)) throw new ValidationError("A valid email is required");

    const existing = getOtp(email);
    const now = Math.floor(Date.now() / 1000);
    if (existing && now - (existing.sent_at || 0) < OTP_RESEND_SECONDS) {
      return res.status(429).json({ error: `Wait ${OTP_RESEND_SECONDS}s before requesting another code` });
    }

    const otp = generateOtp();
    const expiresAt = now + OTP_TTL_SECONDS;
    setOtp({ email, code_hash: hashCode(otp), expires_at: expiresAt });

    // The code is only usable once the provider has actually accepted the
    // message. Any failure invalidates the stored code so a code that was never
    // emailed can never be verified, and the reason is reported to the client
    // instead of being swallowed into a generic 500.
    try {
      const result = await sendOtpEmail({ to: email, otp });
      if (!result?.delivered) {
        invalidateOtp(email);
        return res.status(502).json({ error: "Email service did not confirm delivery of the code.", code: "MAIL_SEND_FAILED" });
      }
      return res.json({ ok: true, delivered: true });
    } catch (e) {
      invalidateOtp(email);
      const code = e?.code?.startsWith("MAIL_") ? e.code : "MAIL_SEND_FAILED";
      console.error(`[auth] OTP email not delivered (${code}) for a customer address`);
      return res.status(code === "MAIL_NOT_CONFIGURED" ? 503 : 502).json({ error: e.message, code });
    }
  } catch (e) {
    next(e);
  }
});

router.post("/otp/verify", async (req, res, next) => {
  try {
    const email = cleanString(req.body?.email, 200);
    const code = cleanString(req.body?.code, 10);
    if (!isEmail(email) || !code) throw new ValidationError("Email and code are required");

    const row = getOtp(email);
    if (!row) return res.status(400).json({ error: "No code found for this email" });

    const now = Math.floor(Date.now() / 1000);
    if (now > (row.expires_at || 0)) {
      invalidateOtp(email);
      return res.status(400).json({ error: "Code expired — request a new one" });
    }
    if ((row.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      invalidateOtp(email);
      return res.status(400).json({ error: "Too many attempts — request a new code" });
    }
    if (crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hashCode(code)))) {
      invalidateOtp(email);
      const user = getUserByEmail(email) || createUser(email);
      const token = signToken({ sub: user.id, email: user.email, role: user.role }, "7d");
      return res.json({ token, user });
    }

    bumpOtpAttempts(email);
    const remaining = OTP_MAX_ATTEMPTS - 1 - (getOtp(email)?.attempts || 0);
    return res.status(401).json({ error: "Incorrect code", remaining: Math.max(remaining, 0) });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = getUserById(req.user.sub);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (e) {
    next(e);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const full_name = cleanString(b.full_name, 100);
    const phone = cleanString(b.phone, 20);
    if (phone && !isPhone(phone)) throw new ValidationError("Invalid phone number");
    const user = updateUserProfile(req.user.sub, {
      full_name,
      phone,
      city: cleanString(b.city, 60),
      address: cleanString(b.address, 200),
      note: cleanString(b.note, 500),
    });
    return res.json({ user });
  } catch (e) {
    next(e);
  }
});

export default router;
