// Server-side product catalog — single source of truth for order pricing,
// availability and stock. Prices intentionally mirror src/data/products.js
// (webstore display prices) so the server never trusts client-sent totals.

export const DELIVERY_FEE = (() => {
  const v = Number(process.env.DELIVERY_FEE || process.env.VITE_DELIVERY_FEE);
  return Number.isFinite(v) && v > 0 ? v : 300;
})();

export const PRODUCTS = [
  { id: "controlle", name: "Controlle", family: "Controlle", size: null, type: "bottle", originalPrice: 1800, salePrice: 1350, stock: 50 },
  { id: "falcon-one", name: "Falcon One", family: "Falcon One", size: null, type: "bottle", originalPrice: 1500, salePrice: 1250, stock: 50 },
  { id: "masarai", name: "Masarai", family: "Masarai", size: null, type: "bottle", originalPrice: 1800, salePrice: 1300, stock: 50 },
  { id: "meadows", name: "Meadows", family: "Meadows", size: null, type: "bottle", originalPrice: 1800, salePrice: 1300, stock: 50 },
  { id: "luxe-reverie", name: "Luxe Reverie", family: "Luxe Reverie", size: null, type: "bottle", originalPrice: 1800, salePrice: 1300, stock: 50 },
  { id: "tester-controlle", name: "Controlle", family: "Controlle", size: "Tester", type: "tester", originalPrice: null, salePrice: 300, stock: 25 },
  { id: "tester-falcon-one", name: "Falcon One", family: "Falcon One", size: "Tester", type: "tester", originalPrice: null, salePrice: 300, stock: 25 },
  { id: "tester-masarai", name: "Masarai", family: "Masarai", size: "Tester", type: "tester", originalPrice: null, salePrice: 300, stock: 25 },
  { id: "tester-meadows", name: "Meadows", family: "Meadows", size: "Tester", type: "tester", originalPrice: null, salePrice: 300, stock: 25 },
  { id: "tester-luxe-reverie", name: "Luxe Reverie", family: "Luxe Reverie", size: "Tester", type: "tester", originalPrice: null, salePrice: 300, stock: 25 },
];

export const byId = (id) => PRODUCTS.find((p) => p.id === id);

export const PAYMENT_METHODS = [
  { id: "cod", label: "Cash on Delivery" },
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "jazzcash", label: "JazzCash" },
];

// Full lifecycle states. Transitions are enforced server-side.
export const ORDER_STATUSES = [
  "pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered",
  "return_requested", "returned", "refund_pending", "refunded",
  "cancelled",
];

// Allowed forward transitions for the current order state.
export const ORDER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["return_requested"],
  return_requested: ["returned", "refund_pending"],
  refund_pending: ["refunded"],
  refunded: [],
  returned: [],
  cancelled: [],
};

export function canTransition(from, to) {
  return from === to || (ORDER_TRANSITIONS[from] || []).includes(to);
}

// Which order states still permit a customer cancel request.
export const CANCELLABLE_STATES = ["pending", "confirmed", "processing"];

export const RETURNABLE_STATES = ["delivered"];

export const PAYMENT_STATUSES = [
  "pending", "submitted", "verification_required", "cod_pending", "paid", "failed", "refunded",
];

// Maps an order status to the order timestamp column kept in sync.
export const STATUS_TIMESTAMP_FIELD = {
  confirmed: "confirmed_at",
  processing: "processing_at",
  shipped: "shipped_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
  returned: "refunded_at",
};