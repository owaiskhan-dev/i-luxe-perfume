const API_URL = import.meta.env.VITE_API_URL || "/api";

// Legacy persisted admin token from the old build — must not survive reloads,
// because the admin must re-authenticate on every dashboard visit.
try { localStorage.removeItem("iluxe_admin_token"); } catch { /* noop */ }

const CUSTOMER_TOKEN_KEY = "iluxe_customer_token";
const USER_KEY = "iluxe_customer_user";

// Admin token lives in memory only: a page reload clears it, so the admin
// secret-code + password screen is required again on every dashboard visit.
let adminToken = "";

export function getAdminToken() {
  return adminToken;
}

export function setAdminToken(token) {
  adminToken = token || "";
}

export function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
}

export function setCustomerToken(token) {
  if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  else localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export function getCustomerUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCustomerUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function isCustomerAuthenticated() {
  return !!getCustomerToken();
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = options.token || getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = options.body !== undefined && typeof options.body !== "string"
    ? JSON.stringify(options.body)
    : options.body;
  const res = await fetch(`${API_URL}${path}`, { ...options, body, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- Catalog / config (authoritative server values) --------------------------

let catalogCache = null;

export async function getCatalog(force = false) {
  if (catalogCache && !force) return catalogCache;
  const data = await request("/catalog");
  catalogCache = data;
  return data;
}

// ---- Customer auth (real backend + OTP email verification) -------------------

export async function sendOtp(email) {
  return request("/auth/otp/send", { method: "POST", body: { email } });
}

export async function verifyOtp({ email, code }) {
  const data = await request("/auth/otp/verify", { method: "POST", body: { email, code } });
  if (data?.token) {
    setCustomerToken(data.token);
    setCustomerUser(data.user || null);
  }
  return data;
}

export async function fetchMe() {
  const token = getCustomerToken();
  const data = await request("/auth/me", { method: "GET", token });
  setCustomerUser(data.user || null);
  return data.user || null;
}

export async function updateMyProfile(profile) {
  const token = getCustomerToken();
  const data = await request("/auth/me", { method: "PATCH", token, body: profile });
  setCustomerUser(data.user || null);
  return data.user || null;
}

export function customerLogout() {
  setCustomerToken(null);
  setCustomerUser(null);
}

// ---- Server cart -------------------------------------------------------------

export async function getServerCart() {
  const token = getCustomerToken();
  if (!token) return [];
  const data = await request("/cart", { token });
  return data.items || [];
}

export async function syncServerCart(items) {
  const token = getCustomerToken();
  if (!token) return null;
  try {
    const data = await request("/cart", { method: "PUT", token, body: { items } });
    return data.items || [];
  } catch (err) {
    console.error("Cart sync error:", err);
    return null;
  }
}

export async function clearServerCart() {
  const token = getCustomerToken();
  if (!token) return;
  try {
    await request("/cart", { method: "DELETE", token });
  } catch {
    /* noop */
  }
}

// ---- Orders (customer) -------------------------------------------------------

export async function placeOrder(payload) {
  const token = getCustomerToken();
  const data = await request("/orders", { method: "POST", token, body: payload });
  clearServerCart();
  return data.order || null;
}

export async function getMyOrders() {
  const token = getCustomerToken();
  const data = await request("/orders/mine", { token });
  return data.orders || [];
}

export async function getOrderById(orderId) {
  const token = getCustomerToken();
  return request(`/orders/${orderId}`, { token });
}

export async function submitPaymentReference(orderId, payload) {
  const token = getCustomerToken();
  return request(`/orders/${orderId}/payment/reference`, { method: "POST", token, body: payload });
}

export async function createOrderRequest(orderId, type, reason) {
  const token = getCustomerToken();
  return request(`/orders/${orderId}/requests`, { method: "POST", token, body: { type, reason } });
}

export async function initiateJazzCash(orderId) {
  const token = getCustomerToken();
  return request(`/payments/jazzcash/${orderId}/initiate`, { method: "POST", token });
}

// ---- Admin -------------------------------------------------------------------

export async function adminLogin({ code, password }) {
  const data = await request("/admin/login", { method: "POST", body: { code, password } });
  setAdminToken(data.token);
  return data;
}

export function adminLogout() {
  setAdminToken(null);
}

export function isAdminAuthenticated() {
  return !!getAdminToken();
}

export async function adminStats() {
  const token = getAdminToken();
  return request("/admin/stats", { token });
}

export const getAdminStats = adminStats;

export async function getAdminOrders(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.payment) qs.set("payment", params.payment);
  if (params.payment_status) qs.set("payment_status", params.payment_status);
  if (params.q) qs.set("q", params.q);
  if (params.limit) qs.set("limit", params.limit);
  if (params.offset) qs.set("offset", params.offset);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/orders${suffix}`);
}

export async function updateOrderStatus(orderId, status) {
  const token = getAdminToken();
  return request(`/orders/${orderId}/status`, { method: "PATCH", token, body: { status } });
}

export async function getAdminPayments(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/admin/payments${suffix}`);
}

export async function verifyPayment(paymentId, status, note) {
  const token = getAdminToken();
  return request(`/admin/payments/${paymentId}/verify`, { method: "POST", token, body: { status, note } });
}

export async function getAdminRequests() {
  const token = getAdminToken();
  return request("/admin/requests", { token });
}

export async function decideRequest(requestId, status, admin_note) {
  const token = getAdminToken();
  return request(`/admin/requests/${requestId}/decide`, { method: "POST", token, body: { status, admin_note } });
}

export async function getAdminConfig() {
  const token = getAdminToken();
  return request("/admin/config", { token });
}

// ---- Reviews (public + authenticated customer) -------------------------------

export async function getPublicReviews(params = {}) {
  const qs = new URLSearchParams();
  if (params.product_id) qs.set("product_id", params.product_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/reviews${suffix}`);
}

export async function submitReview(payload) {
  const token = getCustomerToken();
  return request("/reviews", { method: "POST", token, body: payload });
}

// ---- Newsletter + contact ----------------------------------------------------

export async function subscribeNewsletter(email) {
  return request("/subscribe", { method: "POST", body: { email } });
}

export async function sendContactMessage(payload) {
  return request("/contact", { method: "POST", body: payload });
}

// ---- Admin: reviews, subscriptions, contact ----------------------------------

export async function getAdminReviews(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/admin/reviews${suffix}`);
}

export async function decideReview(reviewId, status, note) {
  const token = getAdminToken();
  return request(`/admin/reviews/${reviewId}`, { method: "PATCH", token, body: { status, note } });
}

export async function getAdminSubscriptions() {
  const token = getAdminToken();
  return request("/admin/subscriptions", { token });
}

export async function getAdminContact(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/admin/contact${suffix}`);
}

export async function updateContactMessage(id, status) {
  const token = getAdminToken();
  return request(`/admin/contact/${id}`, { method: "PATCH", token, body: { status } });
}