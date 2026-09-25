import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listAddresses, getAddress, createAddress, updateAddress, deleteAddress,
} from "../db.js";
import { cleanString, isPhone, ValidationError } from "../lib/validate.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res, next) => {
  try {
    res.json({ addresses: listAddresses(req.user.sub) });
  } catch (e) {
    next(e);
  }
});

router.post("/", (req, res, next) => {
  try {
    const b = req.body || {};
    const name = cleanString(b.name, 100);
    const phone = cleanString(b.phone, 20);
    const city = cleanString(b.city, 60);
    const address = cleanString(b.address, 200);
    if (!name) throw new ValidationError("Name is required");
    if (!phone || !isPhone(phone)) throw new ValidationError("A valid phone is required");
    if (!city) throw new ValidationError("City is required");
    if (!address || address.length < 8) throw new ValidationError("Address must be at least 8 characters");
    const addr = createAddress(req.user.sub, {
      label: cleanString(b.label, 40),
      name, phone, city, address,
      notes: cleanString(b.notes, 300),
      is_default: !!b.is_default,
    });
    res.status(201).json({ address: addr });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const updated = updateAddress(id, req.user.sub, {
      label: cleanString(b.label, 40),
      name: cleanString(b.name, 100),
      phone: cleanString(b.phone, 20),
      city: cleanString(b.city, 60),
      address: cleanString(b.address, 200),
      notes: cleanString(b.notes, 300),
      is_default: !!b.is_default,
    });
    if (!updated) return res.status(404).json({ error: "Address not found" });
    res.json({ address: updated });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = deleteAddress(id, req.user.sub);
    if (!ok) return res.status(404).json({ error: "Address not found" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
