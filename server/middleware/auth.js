import { verifyToken } from "../lib/jwt.js";

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = payload;
  next();
}

export function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  req.user = payload;
  next();
}

export function optionalUser(req, _res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  req.user = payload || null;
  next();
}
