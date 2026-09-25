import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, "iluxe.sqlite");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  create table if not exists admin_setup (
    key text primary key,
    value text
  );
  create table if not exists users (
    id integer primary key autoincrement,
    email text unique not null,
    full_name text default '',
    phone text default '',
    city text default '',
    address text default '',
    note text default '',
    role text not null default 'customer',
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  );
  create table if not exists saved_addresses (
    id integer primary key autoincrement,
    user_id integer not null references users(id) on delete cascade,
    label text default '',
    name text not null,
    phone text not null,
    city text not null,
    address text not null,
    notes text default '',
    is_default integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  );
  create table if not exists otp_codes (
    email text primary key,
    code_hash text not null,
    expires_at integer not null,
    attempts integer not null default 0,
    sent_at integer not null
  );
  create table if not exists orders (
    id text primary key,
    user_id integer references users(id),
    customer_name text not null,
    customer_phone text not null,
    customer_email text,
    customer_city text not null,
    customer_address text not null,
    customer_note text default '',
    items text not null,
    subtotal integer not null,
    delivery_fee integer not null,
    total integer not null,
    payment_method text not null check (payment_method in ('cod','bank_transfer','jazzcash')),
    payment_status text not null default 'pending',
    order_status text not null default 'pending',
    status_history text not null default '[]',
    payment_status_history text not null default '[]',
    stock_released integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    confirmed_at text,
    processing_at text,
    shipped_at text,
    delivered_at text,
    cancelled_at text,
    paid_at text,
    refunded_at text
  );
  create index if not exists orders_user_idx on orders (user_id);
  create index if not exists orders_created_idx on orders (created_at desc);
  create index if not exists orders_status_idx on orders (order_status);
  create index if not exists orders_payment_idx on orders (payment_status);

  create table if not exists payments (
    id integer primary key autoincrement,
    order_id text not null references orders(id) on delete cascade,
    method text not null,
    amount integer not null,
    status text not null default 'pending',
    transaction_ref text default '',
    sender_name text default '',
    notes text default '',
    meta text not null default '{}',
    submitted_at text,
    verified_at text,
    verified_by text default '',
    refunded_at text
  );

  create table if not exists order_requests (
    id integer primary key autoincrement,
    order_id text not null references orders(id),
    type text not null check (type in ('cancel','return','refund')),
    reason text default '',
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    created_at text not null default (datetime('now')),
    decided_at text,
    decided_by text default '',
    admin_note text default ''
  );

  create table if not exists order_items (
    id integer primary key autoincrement,
    order_id text not null references orders(id) on delete cascade,
    product_id text not null,
    name text not null,
    size text default '',
    qty integer not null,
    price integer not null
  );
  create index if not exists order_items_order_idx on order_items (order_id);

  create table if not exists carts (
    user_id integer primary key references users(id) on delete cascade,
    items text not null default '[]',
    updated_at text not null default (datetime('now'))
  );

  create table if not exists payment_transactions (
    id integer primary key autoincrement,
    payment_id integer not null references payments(id) on delete cascade,
    gateway text not null default 'manual',
    transaction_ref text not null,
    raw_status text default '',
    provider_payload text not null default '{}',
    initiated_at text,
    completed_at text,
    created_at text not null default (datetime('now'))
  );
  create index if not exists payment_tx_payment_idx on payment_transactions (payment_id);

  create table if not exists order_emails (
    id integer primary key autoincrement,
    order_id text not null references orders(id) on delete cascade,
    channel text not null,
    recipient text not null,
    status text not null default 'pending',
    error text default '',
    sent_at text,
    created_at text not null default (datetime('now'))
  );
  create index if not exists order_emails_order_idx on order_emails (order_id);

  create table if not exists reviews (
    id integer primary key autoincrement,
    user_id integer references users(id) on delete set null,
    product_id text default '',
    product_name text default '',
    name text not null,
    email text default '',
    rating integer not null check (rating between 1 and 5),
    comment text not null,
    status text not null default 'pending' check (status in ('pending','approved','rejected')),
    admin_note text default '',
    created_at text not null default (datetime('now')),
    decided_at text,
    decided_by text default ''
  );
  create index if not exists reviews_status_idx on reviews (status);
  create index if not exists reviews_product_idx on reviews (product_id);
  create index if not exists reviews_user_idx on reviews (user_id);

  create table if not exists subscriptions (
    id integer primary key autoincrement,
    email text not null,
    active integer not null default 1,
    source text default '',
    created_at text not null default (datetime('now'))
  );
  create unique index if not exists subscriptions_email_idx on subscriptions (lower(email));

  create table if not exists contact_messages (
    id integer primary key autoincrement,
    name text not null,
    email text not null,
    phone text default '',
    subject text default '',
    message text not null,
    status text not null default 'new' check (status in ('new','replied','archived')),
    created_at text not null default (datetime('now')),
    replied_at text
  );

  create table if not exists outbox (
    id integer primary key autoincrement,
    purpose text not null,
    recipient text not null,
    status text not null default 'pending',
    error text default '',
    created_at text not null default (datetime('now')),
    sent_at text
  );

  create table if not exists stock_reserved (
    product_id text primary key,
    qty integer not null default 0
  );

  create table if not exists admin_setup (key text primary key, value text);
  create table if not exists admin_attempts (
    key text primary key,
    count integer not null default 0,
    first_at integer not null,
    locked_until integer not null default 0
  );
`);
// ---- Users ------------------------------------------------------------------

export function getUserByEmail(email) {
  return db.prepare("select * from users where lower(email) = lower(?)").get(email) || null;
}

export function getUserById(id) {
  return db.prepare("select * from users where id = ?").get(id) || null;
}

export function createUser(email) {
  const info = db.prepare("insert into users (email) values (?)").run(String(email).toLowerCase());
  return getUserById(info.lastInsertRowid);
}

export function updateUserProfile(userId, { full_name, phone, city, address, note }) {
  db.prepare(`
    update users set full_name = ?, phone = ?, city = ?, address = ?, note = ?,
      updated_at = datetime('now')
    where id = ?
  `).run(full_name || "", phone || "", city || "", address || "", note || "", userId);
  return getUserById(userId);
}

export function isProfileComplete(user) {
  return !!(user && user.full_name && user.phone && user.city && user.address);
}

// ---- Saved addresses ---------------------------------------------------------

export function listAddresses(userId) {
  return db
    .prepare("select * from saved_addresses where user_id = ? order by is_default desc, id desc")
    .all(userId);
}

export function getAddress(id, userId) {
  return (
    db.prepare("select * from saved_addresses where id = ? and user_id = ?").get(id, userId) || null
  );
}

export function createAddress(userId, a) {
  const { label, name, phone, city, address, notes, is_default } = a;
  if (is_default) {
    db.prepare("update saved_addresses set is_default = 0 where user_id = ?").run(userId);
  }
  const info = db
    .prepare(`
      insert into saved_addresses (user_id, label, name, phone, city, address, notes, is_default)
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(userId, label || "", name, phone, city, address, notes || "", is_default ? 1 : 0);
  return getAddress(info.lastInsertRowid, userId);
}

export function updateAddress(id, userId, a) {
  const existing = getAddress(id, userId);
  if (!existing) return null;
  const { label, name, phone, city, address, notes, is_default } = a;
  if (is_default) {
    db.prepare("update saved_addresses set is_default = 0 where user_id = ?").run(userId);
  }
  db.prepare(`
    update saved_addresses set label = ?, name = ?, phone = ?, city = ?, address = ?, notes = ?, is_default = ?,
      updated_at = datetime('now')
    where id = ? and user_id = ?
  `).run(label || "", name, phone, city, address, notes || "", is_default ? 1 : 0, id, userId);
  return getAddress(id, userId);
}

export function deleteAddress(id, userId) {
  const info = db.prepare("delete from saved_addresses where id = ? and user_id = ?").run(id, userId);
  return info.changes > 0;
}

// ---- OTP ---------------------------------------------------------------------

export function getOtp(email) {
  return db.prepare("select * from otp_codes where lower(email) = lower(?)").get(email) || null;
}

export function setOtp({ email, code_hash, expires_at }) {
  db.prepare(`
    insert into otp_codes (email, code_hash, expires_at, attempts, sent_at)
    values (?, ?, ?, 0, strftime('%s','now'))
    on conflict(email) do update set
      code_hash = excluded.code_hash,
      expires_at = excluded.expires_at,
      attempts = 0,
      sent_at = excluded.sent_at
  `).run(String(email).toLowerCase(), code_hash, expires_at);
}

export function invalidateOtp(email) {
  db.prepare("delete from otp_codes where lower(email) = lower(?)").run(email);
}

export function bumpOtpAttempts(email) {
  db.prepare("update otp_codes set attempts = attempts + 1 where lower(email) = lower(?)").run(email);
  return getOtp(email);
}

// ---- Carts (server-side) -----------------------------------------------------

export function getCart(userId) {
  const row = db.prepare("select * from carts where user_id = ?").get(userId);
  if (!row) return [];
  try { return JSON.parse(row.items || "[]"); } catch { return []; }
}

export function setCart(userId, items) {
  const list = Array.isArray(items) ? items : [];
  db.prepare(`
    insert into carts (user_id, items, updated_at) values (?, ?, datetime('now'))
    on conflict(user_id) do update set items = excluded.items, updated_at = datetime('now')
  `).run(userId, JSON.stringify(list));
  return getCart(userId);
}

export function clearCart(userId) {
  db.prepare("delete from carts where user_id = ?").run(userId);
}

// ---- Order items & stock -----------------------------------------------------

export function insertOrderItems(orderId, items) {
  const stmt = db.prepare(`
    insert into order_items (order_id, product_id, name, size, qty, price) values (?, ?, ?, ?, ?, ?)
  `);
  for (const it of items) {
    stmt.run(orderId, it.id, it.name, it.size || "", it.qty, it.price);
  }
  return listOrderItems(orderId);
}

export function listOrderItems(orderId) {
  return db.prepare("select * from order_items where order_id = ? order by id asc").all(orderId);
}

export function reserveStock(items) {
  for (const it of items) {
    const row = db.prepare("select qty from stock_reserved where product_id = ?").get(it.id);
    db.prepare(`
      insert into stock_reserved (product_id, qty) values (?, ?)
      on conflict(product_id) do update set qty = qty + ?
    `).run(it.id, it.qty, it.qty);
    const _unused = row;
  }
}

export function releaseStock(items) {
  for (const it of items) {
    db.prepare(`
      insert into stock_reserved (product_id, qty) values (?, ?)
      on conflict(product_id) do update set qty = max(qty - ?, 0)
    `).run(it.id, 0, it.qty);
  }
}

export function availableStock(productId, totalStock) {
  const row = db.prepare("select qty from stock_reserved where product_id = ?").get(productId);
  return Math.max(0, totalStock - (row ? row.qty : 0));
}

// ---- Order status history ----------------------------------------------------

export function appendStatusHistory(orderId, { order_status, payment_status, note }) {
  const order = getOrder(orderId);
  if (!order) return;
  const now = new Date().toISOString();
  let sh = [];
  try { sh = JSON.parse(order.status_history || "[]"); } catch { sh = []; }
  sh.push({ status: order_status || order.order_status, at: now, note: note || "" });
  let ph = [];
  try { ph = JSON.parse(order.payment_status_history || "[]"); } catch { ph = []; }
  if (payment_status && payment_status !== order.payment_status) {
    ph.push({ status: payment_status, at: now, note: note || "" });
  }
  const patch = {
    status_history: JSON.stringify(sh),
    payment_status_history: JSON.stringify(ph),
  };
  if (order_status && order_status !== order.order_status) patch.order_status = order_status;
  if (payment_status && payment_status !== order.payment_status) patch.payment_status = payment_status;
  if (payment_status === "paid") patch.paid_at = now;
  updateOrder(orderId, patch);
}

// ---- Payment transactions ----------------------------------------------------

export function insertPaymentTransaction({ payment_id, gateway, transaction_ref, raw_status, provider_payload }) {
  const info = db.prepare(`
    insert into payment_transactions (payment_id, gateway, transaction_ref, raw_status, provider_payload, initiated_at)
    values (?, ?, ?, ?, ?, strftime('%s','now'))
  `).run(payment_id, gateway || "manual", transaction_ref || "", raw_status || "", JSON.stringify(provider_payload || {}));
  return getPaymentTransaction(info.lastInsertRowid);
}

export function getPaymentTransaction(id) {
  return db.prepare("select * from payment_transactions where id = ?").get(id) || null;
}

export function getPaymentTransactionByRef(ref) {
  return db.prepare("select * from payment_transactions where transaction_ref = ? order by id desc limit 1").get(ref) || null;
}

export function getPaymentTransactions(paymentId) {
  return db.prepare("select * from payment_transactions where payment_id = ? order by id desc").all(paymentId);
}

export function listTransactionsForOrder(orderId) {
  const payment = getPaymentByOrder(orderId);
  if (!payment) return [];
  return getPaymentTransactions(payment.id);
}

// ---- Order emails (never faked) ----------------------------------------------

export function logOrderEmail({ order_id, channel, recipient, status, error }) {
  const info = db.prepare(`
    insert into order_emails (order_id, channel, recipient, status, error, sent_at)
    values (?, ?, ?, ?, ?, ?)
  `).run(order_id, channel, recipient, status, error || "", status === "sent" ? new Date().toISOString() : null);
  return getOrderEmail(info.lastInsertRowid);
}

export function getOrderEmail(id) {
  return db.prepare("select * from order_emails where id = ?").get(id) || null;
}

export function listOrderEmails(orderId) {
  return db.prepare("select * from order_emails where order_id = ? order by id desc").all(orderId);
}

// ---- Orders ------------------------------------------------------------------

export function getOrder(id) {
  return db.prepare("select * from orders where id = ?").get(id) || null;
}

export function insertOrder(o) {
  const info = db
    .prepare(`
      insert into orders (
        id, user_id, items, subtotal, delivery_fee, total, payment_method, order_status, payment_status,
        customer_name, customer_phone, customer_email, customer_city, customer_address, customer_note,
        created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    .run(
      o.id, o.user_id ?? null, JSON.stringify(o.items), o.subtotal, o.delivery_fee, o.total, o.payment_method,
      o.order_status || "pending", o.payment_status || "pending", o.customer_name, o.customer_phone, o.customer_email ?? null, o.customer_city, o.customer_address, o.customer_note ?? null
    );
  return getOrder(o.id);
}

export function updateOrder(id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return getOrder(id);
  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`update orders set ${set}, updated_at = datetime('now') where id = ?`).run(...keys.map((k) => patch[k]), id);
  return getOrder(id);
}

export function listOrdersForUser(userId) {
  return db.prepare("select * from orders where user_id = ? order by created_at desc").all(userId);
}

export function listOrders({ status, payment, paymentStatus, q, limit = 100, offset = 0 }) {
  const where = [];
  const params = [];
  if (status && status !== "all") { where.push("order_status = ?"); params.push(status); }
  if (payment && payment !== "all") { where.push("payment_method = ?"); params.push(payment); }
  if (paymentStatus && paymentStatus !== "all") { where.push("payment_status = ?"); params.push(paymentStatus); }
  if (q && q.trim()) {
    where.push("(id like ? or customer_name like ? or customer_phone like ? or customer_email like ?)");
    const like = `%${q.trim()}%`;
    params.push(like, like, like, like);
  }
  const clause = where.length ? `where ${where.join(" and ")}` : "";
  return db.prepare(`select * from orders ${clause} order by created_at desc limit ? offset ?`).all(...params, limit, offset);
}

export function countOrders({ status, payment, paymentStatus, q }) {
  const where = [];
  const params = [];
  if (status && status !== "all") { where.push("order_status = ?"); params.push(status); }
  if (payment && payment !== "all") { where.push("payment_method = ?"); params.push(payment); }
  if (paymentStatus && paymentStatus !== "all") { where.push("payment_status = ?"); params.push(paymentStatus); }
  if (q && q.trim()) {
    where.push("(id like ? or customer_name like ? or customer_phone like ? or customer_email like ?)");
    const like = `%${q.trim()}%`;
    params.push(like, like, like, like);
  }
  const clause = where.length ? `where ${where.join(" and ")}` : "";
  const row = db.prepare(`select count(*) as c from orders ${clause}`).get(...params);
  return row ? row.c : 0;
}

export function getOrderByPaymentRef(orderId) {
  return db.prepare("select * from payments where order_id = ?").get(orderId) || null;
}

// ---- Order requests ----------------------------------------------------------

export function createOrderRequest(orderId, type, reason) {
  const info = db
    .prepare("insert into order_requests (order_id, type, reason) values (?, ?, ?)")
    .run(orderId, type, reason || "");
  return getOrderRequest(info.lastInsertRowid);
}

export function getOrderRequest(id) {
  return db.prepare("select * from order_requests where id = ?").get(id) || null;
}

export function listOrderRequests(orderId) {
  return db.prepare("select * from order_requests where order_id = ? order by id desc").all(orderId);
}

export function listAllOrderRequests() {
  return db.prepare("select * from order_requests order by id desc").all();
}

export function decideOrderRequest(id, { status, admin_note, decided_by }) {
  db.prepare(`
    update order_requests set status = ?, admin_note = ?, decided_by = ?, decided_at = datetime('now')
    where id = ?
  `).run(status, admin_note || "", decided_by || "", id);
  return getOrderRequest(id);
}

// ---- Payments ----------------------------------------------------------------

export function insertPayment(p) {
  const info = db
    .prepare(`
      insert into payments (order_id, method, amount, status, transaction_ref, sender_name, notes, meta, submitted_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
    `)
    .run(p.order_id, p.method, p.amount, p.status || "submitted", p.transaction_ref || "", p.sender_name || "", p.notes || "", p.meta || "{}");
  return getPayment(info.lastInsertRowid);
}

export function getPayment(id) {
  return db.prepare("select * from payments where id = ?").get(id) || null;
}

export function getPaymentByOrder(orderId) {
  return db.prepare("select * from payments where order_id = ? order by id desc limit 1").get(orderId) || null;
}

export function updatePayment(id, patch, opts = {}) {
  const keys = Object.keys(patch);
  if (!keys.length) return getPayment(id);
  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`update payments set ${set} where id = ?`).run(...keys.map((k) => patch[k]), id);
  if (opts.touchVerifiedAt) {
    db.prepare(`update payments set verified_at = datetime('now') where id = ?`).run(id);
  }
  if (patch.status === "refunded") {
    db.prepare(`update payments set refunded_at = datetime('now') where id = ?`).run(id);
  }
  return getPayment(id);
}

export function listPaymentsForOrder(orderId) {
  return db.prepare("select * from payments where order_id = ? order by id desc").all(orderId);
}

// ---- Admin setup / auth ------------------------------------------------------

export function getAdminSetup(key) {
  return db.prepare("select value from admin_setup where key = ?").get(key) || null;
}

export function setAdminSetup(key, value) {
  db.prepare(`
    insert into admin_setup (key, value) values (?, ?)
    on conflict(key) do update set value = excluded.value
  `).run(key, value);
  return getAdminSetup(key);
}

export function getAdminAttempts(key) {
  return db.prepare("select * from admin_attempts where key = ?").get(key) || null;
}

export function recordAdminAttempt(key) {
  db.prepare(`
    insert into admin_attempts (key, count, first_at, locked_until) values (?, 1, strftime('%s','now'), 0)
    on conflict(key) do update set count = count + 1
  `).run(key);
  return getAdminAttempts(key);
}

export function resetAdminAttempts(key) {
  db.prepare("delete from admin_attempts where key = ?").run(key);
}

export function lockAdminAttempts(key, until) {
  db.prepare("update admin_attempts set locked_until = ? where key = ?").run(until, key);
  return getAdminAttempts(key);
}

export function clearExpiredAdminAttempt(key, windowSec) {
  const row = getAdminAttempts(key);
  if (row) {
    const now = Math.floor(Date.now() / 1000);
    if (now - (row.first_at || now) > windowSec) {
      db.prepare("delete from admin_attempts where key = ?").run(key);
      return null;
    }
  }
  return row;
}

// ---- Stats -------------------------------------------------------------------

export function getDashboardStats() {
  const total = db.prepare("select count(*) as c from orders").get().c;
  const revenue = db.prepare(`
    select coalesce(sum(total), 0) as s from orders where order_status in ('delivered','confirmed','processing','shipped','pending')
  `).get().s;
  const pending = db.prepare("select count(*) as c from orders where order_status = 'pending'").get().c;
  const paid = db.prepare("select count(*) as c from payments where status = 'paid'").get().c;
  const awaitingProof = db.prepare(`
    select count(*) as c from orders where payment_method != 'cod' and payment_status in ('pending','verification_required') and order_status != 'cancelled'
  `).get().c;
  const codPending = db.prepare("select count(*) as c from orders where payment_method = 'cod' and order_status in ('pending','confirmed','processing','shipped')").get().c;
  const needsAction = db.prepare(`
    select count(*) as c from orders where (payment_method != 'cod' and payment_status in ('pending','verification_required') and order_status != 'cancelled')
      or order_status in ('return_requested','refund_pending')
  `).get().c;
  const pendingReviews = db.prepare("select count(*) as c from reviews where status = 'pending'").get().c;
  const newContact = db.prepare("select count(*) as c from contact_messages where status = 'new'").get().c;
  const subscribers = db.prepare("select count(*) as c from subscriptions where active = 1").get().c;
  return { total, revenue, pending, paid, awaitingProof, codPending, needsAction, pendingReviews, newContact, subscribers };
}

// ---- Reviews -----------------------------------------------------------------

export function insertReview({ user_id, product_id, product_name, name, email, rating, comment }) {
  const info = db
    .prepare(`
      insert into reviews (user_id, product_id, product_name, name, email, rating, comment)
      values (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(user_id ?? null, product_id || "", product_name || "", name, email || "", rating, comment);
  return getReview(info.lastInsertRowid);
}

export function getReview(id) {
  return db.prepare("select * from reviews where id = ?").get(id) || null;
}

export function listReviews({ status, productId, limit = 200, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status && status !== "all") { where.push("status = ?"); params.push(status); }
  if (productId && productId !== "all") { where.push("product_id = ?"); params.push(productId); }
  const clause = where.length ? `where ${where.join(" and ")}` : "";
  return db
    .prepare(`select * from reviews ${clause} order by case status when 'approved' then 0 when 'pending' then 1 else 2 end, id desc limit ? offset ?`)
    .all(...params, limit, offset);
}

export function reviewCounts() {
  return db
    .prepare("select status, count(*) as c from reviews group by status")
    .all()
    .reduce((acc, r) => { acc[r.status] = r.c; return acc; }, {});
}

export function pendingReviewCount() {
  return db.prepare("select count(*) as c from reviews where status = 'pending'").get().c;
}

export function updateReviewStatus(id, status, { decided_by, admin_note } = {}) {
  db.prepare(`
    update reviews set status = ?, decided_by = ?, admin_note = ?, decided_at = datetime('now')
    where id = ?
  `).run(status, decided_by || "", admin_note || "", id);
  return getReview(id);
}

export function reviewExistsForUser(userId, productId) {
  const row = db
    .prepare("select id from reviews where user_id = ? and status != 'rejected' and (product_id = ? or product_id = '') and (? = '' or product_id = '') limit 1")
    .get(userId, productId || "", productId || "");
  return !!row;
}

// ---- Subscriptions -----------------------------------------------------------

export function getSubscriptionByEmail(email) {
  return db.prepare("select * from subscriptions where lower(email) = lower(?)").get(email) || null;
}

export function addSubscription({ email, source }) {
  const existing = getSubscriptionByEmail(email);
  if (existing) {
    if (!existing.active) {
      db.prepare("update subscriptions set active = 1 where id = ?").run(existing.id);
      return getSubscriptionById(existing.id);
    }
    return existing;
  }
  const info = db
    .prepare("insert into subscriptions (email, active, source) values (?, 1, ?)")
    .run(email, source || "");
  return getSubscriptionById(info.lastInsertRowid);
}

export function getSubscriptionById(id) {
  return db.prepare("select * from subscriptions where id = ?").get(id) || null;
}

export function listSubscriptions() {
  return db.prepare("select * from subscriptions order by id desc").all();
}

// ---- Contact messages --------------------------------------------------------

export function insertContactMessage({ name, email, phone, subject, message }) {
  const info = db
    .prepare("insert into contact_messages (name, email, phone, subject, message) values (?, ?, ?, ?, ?)")
    .run(name, email, phone || "", subject || "", message);
  return getContactMessage(info.lastInsertRowid);
}

export function getContactMessage(id) {
  return db.prepare("select * from contact_messages where id = ?").get(id) || null;
}

export function listContactMessages({ status, limit = 200, offset = 0 } = {}) {
  if (status && status !== "all") {
    return db.prepare("select * from contact_messages where status = ? order by id desc limit ? offset ?").all(status, limit, offset);
  }
  return db.prepare("select * from contact_messages order by id desc limit ? offset ?").all(limit, offset);
}

export function countContactMessages({ status } = {}) {
  if (status && status !== "all") {
    return db.prepare("select count(*) as c from contact_messages where status = ?").get(status).c;
  }
  return db.prepare("select count(*) as c from contact_messages").get().c;
}

export function updateContactMessageStatus(id, status) {
  db.prepare(`
    update contact_messages set status = ?, replied_at = case when ? = 'replied' then datetime('now') else replied_at end
    where id = ?
  `).run(status, status, id);
  return getContactMessage(id);
}

// ---- Outbox (non-order email log — honest) -----------------------------------

export function insertOutbox({ purpose, recipient, status, error }) {
  const info = db
    .prepare("insert into outbox (purpose, recipient, status, error, sent_at) values (?, ?, ?, ?, ?)")
    .run(purpose, recipient, status, error || "", status === "sent" ? new Date().toISOString() : null);
  return getOutboxRow(info.lastInsertRowid);
}

export function getOutboxRow(id) {
  return db.prepare("select * from outbox where id = ?").get(id) || null;
}

export function listOutbox({ purpose, limit = 200, offset = 0 } = {}) {
  if (purpose) {
    return db.prepare("select * from outbox where purpose = ? order by id desc limit ? offset ?").all(purpose, limit, offset);
  }
  return db.prepare("select * from outbox order by id desc limit ? offset ?").all(limit, offset);
}

export const _db = db;

export function listAllPayments({ status, limit = 100, offset = 0 } = {}) {
  if (status) {
    return db.prepare("select * from payments where status = ? order by id desc limit ? offset ?").all(status, limit, offset);
  }
  return db.prepare("select * from payments order by id desc limit ? offset ?").all(limit, offset);
}
