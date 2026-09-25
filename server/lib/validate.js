export function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function isPhone(v) {
  return typeof v === "string" && /^[0-9+\-\s]{7,20}$/.test(v.trim());
}

export function cleanString(v, max = 500) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = "VALIDATION_ERROR";
  }
}
