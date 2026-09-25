import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getCart, setCart, clearCart } from "../db.js";
import { byId } from "../catalog.js";
import { ValidationError } from "../lib/validate.js";

const router = Router();
router.use(requireAuth);

function validateItems(items) {
  if (!Array.isArray(items)) throw new ValidationError("items must be an array");
  const out = [];
  const counts = new Map();
  for (const it of items) {
    const pid = String(it?.id || "");
    const p = byId(pid);
    if (!p) throw new ValidationError(`Unknown product: ${pid}`);
    const qty = Number(it?.qty || 0);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new ValidationError("Invalid quantity");
    const key = `${pid}`;
    counts.set(key, (counts.get(key) || 0) + qty);
  }
  for (const [pid, qty] of counts) {
    const p = byId(pid);
    out.push({ id: p.id, qty, price: p.salePrice, name: p.name, size: p.size || "Signature" });
  }
  return out;
}

router.get("/", (req, res, next) => {
  try {
    res.json({ items: getCart(req.user.sub) });
  } catch (e) { next(e); }
});

router.put("/", (req, res, next) => {
  try {
    const items = validateItems(req.body?.items);
    setCart(req.user.sub, items);
    res.json({ items: getCart(req.user.sub) });
  } catch (e) { next(e); }
});

router.delete("/", (req, res, next) => {
  try {
    clearCart(req.user.sub);
    res.json({ items: [] });
  } catch (e) { next(e); }
});

export default router;