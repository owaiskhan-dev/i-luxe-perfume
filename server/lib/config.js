import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

export const PORT = Number(process.env.PORT || 3001);
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "iqraanum1995@gmail.com";
// Admin credentials are server/env-only. There are intentionally no weak
// defaults: without ADMIN_CODE + ADMIN_PASSWORD (or a prior /setup hash in the
// database) the admin login refuses to work with a clear setup_required error.
export const ADMIN_CODE = process.env.ADMIN_CODE || "";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
export const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-change-me";
export const SITE_URL = process.env.SITE_URL || "http://localhost:5173";
export const IS_PROD = process.env.NODE_ENV === "production";
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 30;
export const ADMIN_LOCK_SECONDS = 15 * 60;
export const ADMIN_MAX_ATTEMPTS = 5;

// ---- Bank transfer (authoritative server-side config) ------------------------
export const BANK_TRANSFER = {
  bankName: process.env.BANK_NAME || process.env.VITE_BANK_NAME || "Allied Bank",
  accountName: process.env.BANK_ACCOUNT_NAME || process.env.VITE_BANK_ACCOUNT_NAME || "Sidra Anum",
  accountNumber: process.env.BANK_ACCOUNT_NUMBER || process.env.VITE_BANK_ACCOUNT_NUMBER || "0010159652950014",
  iban: process.env.BANK_IBAN || process.env.VITE_BANK_IBAN || "PK00ALLA000000100159652950014",
  branch: process.env.BANK_BRANCH || process.env.VITE_BANK_BRANCH || "Main Branch, Karachi",
};

// ---- JazzCash wallet (authoritative server-side config) -----------------------
export const JAZZCASH_WALLET = {
  accountName: process.env.JAZZCASH_ACCOUNT_NAME || process.env.VITE_JAZZCASH_ACCOUNT_NAME || "Iqra Anum",
  number: process.env.JAZZCASH_NUMBER || process.env.VITE_JAZZCASH_NUMBER || "03222629284",
};

// ---- JazzCash Merchant API (server-side ONLY — never expose to the browser) ---
// A valid merchant account is required for the gateway flow. When these are
// not set, JazzCash uses the honest wallet-transfer/reference flow and the
// payment stays PENDING / VERIFICATION_REQUIRED until the admin verifies it.
export const JAZZCASH = {
  merchantId: process.env.JAZZCASH_MERCHANT_ID || "",
  password: process.env.JAZZCASH_PASSWORD || "",
  integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || "",
  returnUrl: process.env.JAZZCASH_RETURN_URL || `${SITE_URL}/account`,
  apiUrl: process.env.JAZZCASH_API_URL || "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction",
  sandbox: process.env.JAZZCASH_SANDBOX === "true" || !process.env.JAZZCASH_MERCHANT_ID,
};

export function jazzcashConfigured() {
  return !!(JAZZCASH.merchantId && JAZZCASH.password && JAZZCASH.integritySalt);
}