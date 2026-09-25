import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { PORT, SITE_URL, BANK_TRANSFER, JAZZCASH_WALLET, jazzcashConfigured } from "./lib/config.js";
import { mailConfigured, mailStartupReport } from "./lib/mail.js";
import authRoutes from "./routes/auth.js";
import addressRoutes from "./routes/addresses.js";
import orderRoutes from "./routes/orders.js";
import adminRoutes from "./routes/admin.js";
import cartRoutes from "./routes/carts.js";
import jazzcashRoutes from "./routes/jazzcash.js";
import reviewRoutes from "./routes/reviews.js";
import publicRoutes from "./routes/public.js";
import { ValidationError } from "./lib/validate.js";
import { byId, PRODUCTS, DELIVERY_FEE, PAYMENT_METHODS, ORDER_STATUSES, PAYMENT_STATUSES, CANCELLABLE_STATES, RETURNABLE_STATES, ORDER_TRANSITIONS } from "./catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Allowed browser origins, as a comma-separated list. A single fixed origin
// meant every other origin got back an Access-Control-Allow-Origin that did not
// match, which the browser reports as "Failed to fetch" — that happens for
// 127.0.0.1 vs localhost, for a Vite port other than 5173, and for the deployed
// site. The matched origin is echoed back so the preflight always matches.
const CORS_ORIGINS = (process.env.CORS_ORIGIN || SITE_URL)
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // No Origin header: same-origin navigation, curl, or server-to-server.
    if (!origin) return cb(null, true);
    cb(null, CORS_ORIGINS.includes(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get("/api/catalog", (_req, res) => {
  res.json({
    delivery_fee: DELIVERY_FEE,
    products: PRODUCTS.map(({ id, name, family, size, type, originalPrice, salePrice, stock }) => ({
      id, name, family, size, type, originalPrice, salePrice, stock,
    })),
    payment_methods: PAYMENT_METHODS,
    order_statuses: ORDER_STATUSES,
    payment_statuses: PAYMENT_STATUSES,
    order_transitions: ORDER_TRANSITIONS,
    cancellable_states: CANCELLABLE_STATES,
    returnable_states: RETURNABLE_STATES,
    bank_transfer: BANK_TRANSFER,
    jazzcash: {
      wallet: JAZZCASH_WALLET,
      gateway_configured: jazzcashConfigured(),
    },
    jazzcash_configured: jazzcashConfigured(),
    mail_configured: mailConfigured(),
  });
});

app.get("/api/catalog/:id", (req, res) => {
  const p = byId(req.params.id);
  if (!p) return res.status(404).json({ error: "Product not found" });
  res.json({ product: p });
});

app.use("/api/auth", authRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments/jazzcash", jazzcashRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api", publicRoutes);

const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.status(404).send("Not found");
});

app.use((err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  console.error("[server]", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[i.luxe] API listening on http://localhost:${PORT}`);

  // Secret-free startup check: surfaces a broken mail configuration in the
  // server log instead of letting every OTP fail silently at send time.
  const mail = mailStartupReport();
  if (!mail.configured) {
    console.warn("[i.luxe] Email disabled: RESEND_API_KEY is not set. Login codes and order emails will not be sent.");
  } else if (mail.issue) {
    console.warn(`[i.luxe] Email misconfigured (${mail.issue.code}): ${mail.issue.message}`);
  } else {
    console.log(`[i.luxe] Email ready via ${mail.host}:${mail.port} (secure=${mail.secure}) from "${mail.from}"`);
  }
});
