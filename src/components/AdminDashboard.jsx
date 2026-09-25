import { useEffect, useState } from "react";
import {
  getAdminOrders,
  getAdminPayments,
  getAdminRequests,
  updateOrderStatus,
  verifyPayment,
  decideRequest,
  adminLogout,
  isAdminAuthenticated,
  getAdminConfig,
  getAdminStats,
  getAdminReviews,
  decideReview,
  getAdminSubscriptions,
  getAdminContact,
  updateContactMessage,
} from "../lib/api";
import { formatPrice } from "../data/products";
import Reveal from "./Reveal";

const statusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  return_requested: "Return Requested",
  returned: "Returned",
  refund_pending: "Refund Pending",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const statusColors = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  processing: "status-confirmed",
  shipped: "status-processing",
  out_for_delivery: "status-processing",
  delivered: "status-delivered",
  return_requested: "status-awaiting-proof",
  returned: "status-cancelled",
  refund_pending: "status-awaiting-proof",
  refunded: "status-cancelled",
  cancelled: "status-cancelled",
};

const paymentMethodLabels = {
  cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer",
  card: "Credit / Debit Card",
  jazzcash: "JazzCash",
};

const paymentStatusLabels = {
  pending: "Awaiting payment",
  submitted: "Submitted",
  verification_required: "Awaiting verification",
  cod_pending: "Pay on delivery",
  paid: "Paid",
  failed: "Rejected / Failed",
  refunded: "Refunded",
};

const paymentStatusClass = (s) =>
  s === "paid"
    ? "pay-paid"
    : s === "failed" || s === "refunded"
    ? "pay-rejected"
    : s === "verification_required" || s === "pending" || s === "submitted"
    ? "pay-pending"
    : "pay-pending";

const requestTypeLabels = { cancel: "Cancellation", return: "Return", refund: "Refund" };

const TAB_ORDERS = "orders";
const TAB_PAYMENTS = "payments";
const TAB_REQUESTS = "requests";
const TAB_REVIEWS = "reviews";
const TAB_INBOX = "inbox";

export default function AdminDashboard({ onLogout, isAuthenticated }) {
  const [tab, setTab] = useState(TAB_ORDERS);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewCounts, setReviewCounts] = useState({});
  const [subscriptions, setSubscriptions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [payStatusFilter, setPayStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmPayment, setConfirmPayment] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [verifyNote, setVerifyNote] = useState("");

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      setLoading(false);
      return;
    }
    getAdminConfig().then((c) => setConfig(c)).catch(() => {});
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, tab]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === TAB_ORDERS) {
        const data = await getAdminOrders({ status: statusFilter, payment: paymentFilter, payment_status: payStatusFilter, q: searchQuery });
        setOrders(data.orders || []);
      } else if (tab === TAB_PAYMENTS) {
        const data = await getAdminPayments();
        setPayments(data.payments || []);
      } else if (tab === TAB_REQUESTS) {
        const data = await getAdminRequests();
        setRequests(data.requests || []);
      } else if (tab === TAB_REVIEWS) {
        const data = await getAdminReviews({ status: "all" });
        setReviews(data.reviews || []);
        setReviewCounts(data.counts || {});
      } else {
        const [subs, msgs] = await Promise.all([
          getAdminSubscriptions(),
          getAdminContact({ status: "all" }),
        ]);
        setSubscriptions(subs.subscriptions || []);
        setMessages(msgs.messages || []);
        setNewMessageCount((msgs.messages || []).filter((m) => m.status === "new").length);
      }
      const st = await getAdminStats().catch(() => null);
      setStats(st?.stats || null);
    } catch (err) {
      console.error("Admin refresh error:", err);
      setError("Failed to load data from the server");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdminAuthenticated() && (tab === TAB_ORDERS || tab === TAB_REVIEWS || tab === TAB_INBOX)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, paymentFilter, payStatusFilter, searchQuery]);

  const handleLogout = () => {
    adminLogout();
    onLogout?.();
  };

  const changeStatus = async (orderId, newStatus) => {
    setUpdatingStatus(orderId);
    try {
      const res = await updateOrderStatus(orderId, newStatus);
      const order = res.order;
      setOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
      if (selectedOrder?.id === orderId) setSelectedOrder(order);
    } catch (err) {
      alert(err.message || "Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const doVerifyPayment = async (paymentId, status) => {
    setError("");
    try {
      await verifyPayment(paymentId, status, verifyNote);
      setConfirmPayment(null);
      setVerifyNote("");
      await refresh();
    } catch (err) {
      alert(err.message || "Failed to update payment status");
    }
  };

  const actDecideRequest = async (id, status) => {
    try {
      await decideRequest(id, status, "Handled from dashboard");
      await refresh();
    } catch (err) {
      alert(err.message || "Failed to decide request");
    }
  };

  const actDecideReview = async (id, status) => {
    try {
      await decideReview(id, status, "");
      await refresh();
    } catch (err) {
      alert(err.message || "Failed to update review");
    }
  };

  const actMessageStatus = async (id, status) => {
    try {
      await updateContactMessage(id, status);
      await refresh();
    } catch (err) {
      alert(err.message || "Failed to update message");
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(`${iso}${String(iso).includes("T") ? "" : "Z"}`);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const allowedTransitions = (order) => {
    const t = config?.order_transitions;
    if (!t) return [];
    const next = t[order.status] || [];
    return next.filter((s) => s !== order.status);
  };

  if (!isAdminAuthenticated()) {
    return (
      <section className="admin-section section">
        <div className="container">
          <div className="admin-card" style={{ maxWidth: "400px", margin: "0 auto" }}>
            <Reveal as="h2" className="section-title" style={{ textAlign: "center", marginBottom: "24px" }}>Admin Dashboard</Reveal>
            <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: "24px" }}>Please use the hidden admin access via the logo to sign in.</p>
            <button className="btn btn-gold btn-block" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section section">
      <div className="container">
        <div className="admin-header">
          <div>
            <Reveal as="h2" className="section-title">Orders Dashboard</Reveal>
            <p className="admin-subtitle">Real orders, payments and requests from customers.</p>
          </div>
          <button className="btn btn-outline" onClick={handleLogout}>Sign Out</button>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === TAB_ORDERS ? "active" : ""}`} onClick={() => setTab(TAB_ORDERS)}>
            Orders {stats?.total != null ? `(${stats.total})` : ""}
          </button>
          <button className={`admin-tab ${tab === TAB_PAYMENTS ? "active" : ""}`} onClick={() => setTab(TAB_PAYMENTS)}>
            Payments {stats?.awaitingProof ? `(${stats.awaitingProof})` : ""}
          </button>
          <button className={`admin-tab ${tab === TAB_REQUESTS ? "active" : ""}`} onClick={() => setTab(TAB_REQUESTS)}>
            Requests {stats?.needsAction ? `(${stats.needsAction})` : ""}
          </button>
          <button className={`admin-tab ${tab === TAB_REVIEWS ? "active" : ""}`} onClick={() => setTab(TAB_REVIEWS)}>
            Reviews {reviewCounts?.pending ? `(${reviewCounts.pending})` : ""}
          </button>
          <button className={`admin-tab ${tab === TAB_INBOX ? "active" : ""}`} onClick={() => setTab(TAB_INBOX)}>
            Inbox {newMessageCount > 0 ? `(${newMessageCount})` : ""}
          </button>
        </div>

        {stats && (
          <div className="admin-stat-grid">
            <div className="admin-stat-card"><span>Total Orders</span><strong>{stats.total}</strong></div>
            <div className="admin-stat-card"><span>Pending</span><strong>{stats.pending}</strong></div>
            <div className="admin-stat-card"><span>Awaiting Verification</span><strong>{stats.awaitingProof}</strong></div>
            <div className="admin-stat-card"><span>COD Due</span><strong>{stats.codPending}</strong></div>
            <div className="admin-stat-card"><span>Paid</span><strong>{stats.paid}</strong></div>
            <div className="admin-stat-card"><span>Revenue (active)</span><strong>{formatPrice(stats.revenue)}</strong></div>
          </div>
        )}

        {error && <div className="admin-error">{error}</div>}

        {/* ---------------- ORDERS ---------------- */}
        {tab === TAB_ORDERS && (
          <>
            <div className="admin-toolbar">
              <div className="admin-filter">
                <label htmlFor="statusFilter" className="visually-hidden">Filter by status</label>
                <select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-select">
                  <option value="all">All Statuses</option>
                  {Object.keys(statusLabels).map((s) => (
                    <option key={s} value={s}>{statusLabels[s]}</option>
                  ))}
                </select>
              </div>
              <div className="admin-filter">
                <label htmlFor="paymentFilter" className="visually-hidden">Filter by payment method</label>
                <select id="paymentFilter" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="admin-select">
                  <option value="all">All Payment Methods</option>
                  <option value="cod">Cash on Delivery</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>
              <div className="admin-filter">
                <label htmlFor="payStatusFilter" className="visually-hidden">Filter by payment status</label>
                <select id="payStatusFilter" value={payStatusFilter} onChange={(e) => setPayStatusFilter(e.target.value)} className="admin-select">
                  <option value="all">All Payment Statuses</option>
                  <option value="pending">Awaiting payment</option>
                  <option value="verification_required">Awaiting verification</option>
                  <option value="cod_pending">Pay on delivery</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Rejected / Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="admin-card admin-loading"><div className="spinner"></div><p>Loading orders...</p></div>
            ) : orders.length === 0 ? (
              <div className="admin-card admin-empty">
                <h3>No Orders Found</h3>
              </div>
            ) : (
              <div className="admin-card admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{ cursor: "pointer" }}>
                        <td className="order-id">{order.id}</td>
                        <td>{formatDate(order.created_at)}</td>
                        <td>
                          <div className="customer-name">{order.customer_name}</div>
                          <div className="customer-phone">{order.customer_phone}</div>
                          {order.customer_email && <div className="customer-email">{order.customer_email}</div>}
                          <div className="customer-address">{order.customer_address}, {order.customer_city}</div>
                        </td>
                        <td>
                          <div className="order-items-preview">
                            {(order.items || []).slice(0, 2).map((item, i) => (
                              <div key={i} className="order-item-preview">
                                <span>{item.name} ({item.size}) × {item.qty}</span>
                                <span>{formatPrice(item.price * item.qty)}</span>
                              </div>
                            ))}
                            {(order.items || []).length > 2 && (
                              <div className="order-items-more">+{(order.items || []).length - 2} more</div>
                            )}
                          </div>
                        </td>
                        <td className="order-total">{formatPrice(order.total)}</td>
                        <td>
                          <span className="payment-badge">{paymentMethodLabels[order.payment] || order.payment}</span>
                          {order.payment_status && (
                            <div className={`pay-badge ${paymentStatusClass(order.payment_status)}`}>
                              {paymentStatusLabels[order.payment_status] || order.payment_status}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${statusColors[order.status] || ""}`}>
                            {statusLabels[order.status] || order.status}
                          </span>
                        </td>
                        <td>
                          <select
                            value={order.status}
                            onChange={(e) => { e.stopPropagation(); changeStatus(order.id, e.target.value); }}
                            className="status-select"
                            disabled={updatingStatus === order.id}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[order.status, ...allowedTransitions(order)].map((s) => (
                              <option key={s} value={s} disabled={s === order.status}>
                                {s === order.status ? `${statusLabels[s] || s} (current)` : statusLabels[s] || s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ---------------- PAYMENTS ---------------- */}
        {tab === TAB_PAYMENTS && (
          <>
            {loading ? (
              <div className="admin-card admin-loading"><div className="spinner"></div><p>Loading payments...</p></div>
            ) : payments.length === 0 ? (
              <div className="admin-card admin-empty"><h3>No Payments</h3></div>
            ) : (
              <div className="admin-card admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Order ID</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Sender</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td className="order-id">{p.order_id}</td>
                        <td>{paymentMethodLabels[p.method] || p.method}</td>
                        <td className="order-total">{formatPrice(p.amount)}</td>
                        <td><span className="detail-mono">{p.transaction_ref || "—"}</span></td>
                        <td>{p.sender_name || "—"}</td>
                        <td>{formatDate(new Date(p.submitted_at * 1000).toISOString())}</td>
                        <td>
                          <span className={`pay-badge ${paymentStatusClass(p.status)}`}>
                            {paymentStatusLabels[p.status] || p.status}
                          </span>
                        </td>
                        <td>
                          <div className="pay-actions">
                            {p.status !== "paid" && p.status !== "refunded" && (
                              <button className="btn btn-gold btn-xs" onClick={() => setConfirmPayment({ id: p.id, status: "paid" })}>Verify Paid</button>
                            )}
                            {p.status !== "failed" && p.status !== "refunded" && (
                              <button className="btn btn-ghost btn-xs" onClick={() => setConfirmPayment({ id: p.id, status: "failed" })}>Reject</button>
                            )}
                            {p.status === "paid" && (
                              <button className="btn btn-ghost btn-xs" onClick={() => setConfirmPayment({ id: p.id, status: "refunded" })}>Mark Refunded</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="admin-note">
                  Verifying a payment marks the order as <strong>paid</strong> and <strong>confirmed</strong>.
                  Rejecting returns it to the customer for a new reference.
                </div>
              </div>
            )}
          </>
        )}

        {/* ---------------- REQUESTS ---------------- */}
        {tab === TAB_REQUESTS && (
          <>
            {loading ? (
              <div className="admin-card admin-loading"><div className="spinner"></div><p>Loading requests...</p></div>
            ) : requests.length === 0 ? (
              <div className="admin-card admin-empty"><h3>No Customer Requests</h3></div>
            ) : (
              <div className="admin-card admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Order ID</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td className="order-id">{r.order_id}</td>
                        <td>{requestTypeLabels[r.type] || r.type}</td>
                        <td>{r.reason || "—"}</td>
                        <td>
                          <span className={`status-badge ${r.status === "pending" ? "status-pending" : r.status === "approved" ? "status-delivered" : "status-cancelled"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{formatDate(r.created_at)}</td>
                        <td>
                          {r.status === "pending" ? (
                            <div className="pay-actions">
                              <button className="btn btn-gold btn-xs" onClick={() => actDecideRequest(r.id, "approved")}>Approve</button>
                              <button className="btn btn-ghost btn-xs" onClick={() => actDecideRequest(r.id, "rejected")}>Reject</button>
                            </div>
                          ) : (
                            <span className="detail-subtle">{r.decided_at ? formatDate(r.decided_at) : "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ---------------- REVIEWS ---------------- */}
        {tab === TAB_REVIEWS && (
          <>
            <div className="admin-toolbar">
              <div className="admin-filter">
                <label htmlFor="reviewStatusFilter" className="visually-hidden">Filter reviews by status</label>
                <select id="reviewStatusFilter" value="all" onChange={() => {}} className="admin-select">
                  <option value="all">All Reviews</option>
                </select>
              </div>
              {reviewCounts.pending > 0 && (
                <span className="admin-filter-count">{reviewCounts.pending} pending</span>
              )}
            </div>

            {loading ? (
              <div className="admin-card admin-loading"><div className="spinner"></div><p>Loading reviews...</p></div>
            ) : reviews.length === 0 ? (
              <div className="admin-card admin-empty"><h3>No Reviews</h3></div>
            ) : (
              <div className="admin-card admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Customer</th>
                      <th>Rating</th>
                      <th>Comment</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td className="order-id">{r.product_name || r.product_id || "General"}</td>
                        <td>{r.customer_name || "—"}</td>
                        <td><span className="star-rating">{"★".repeat(r.rating) || "—"}</span></td>
                        <td className="review-comment">{r.comment || "—"}</td>
                        <td>
                          <span className={`status-badge ${r.status === "approved" ? "status-delivered" : r.status === "rejected" ? "status-cancelled" : "status-pending"}`}>
                            {r.status}
                          </span>
                          {r.admin_note && <div className="detail-subtle">{r.admin_note}</div>}
                        </td>
                        <td>{formatDate(r.created_at)}</td>
                        <td>
                          {r.status === "pending" ? (
                            <div className="pay-actions">
                              <button className="btn btn-gold btn-xs" onClick={() => actDecideReview(r.id, "approved")}>Approve</button>
                              <button className="btn btn-ghost btn-xs" onClick={() => actDecideReview(r.id, "rejected")}>Reject</button>
                            </div>
                          ) : (
                            <span className="detail-subtle">{r.decided_at ? formatDate(r.decided_at) : "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ---------------- INBOX (newsletter + contact) ---------------- */}
        {tab === TAB_INBOX && (
          <>
            <h3 className="admin-subsection">Newsletter Subscriptions</h3>
            {subscriptions.length === 0 ? (
              <div className="admin-card admin-empty"><h3>No Subscriptions</h3></div>
            ) : (
              <div className="admin-card admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Email</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Subscribed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td className="order-id">{s.email}</td>
                        <td>{s.source || "—"}</td>
                        <td>
                          <span className={`status-badge ${s.active ? "status-delivered" : "status-cancelled"}`}>
                            {s.active ? "Active" : "Unsubscribed"}
                          </span>
                        </td>
                        <td>{formatDate(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="admin-subsection">Contact Messages</h3>
            {messages.length === 0 ? (
              <div className="admin-card admin-empty"><h3>No Messages</h3></div>
            ) : (
              <div className="admin-card admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Subject</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Received</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((m) => (
                      <tr key={m.id}>
                        <td>{m.id}</td>
                        <td>{m.name || "—"}</td>
                        <td className="order-id">{m.email}</td>
                        <td>{m.subject || "—"}</td>
                        <td className="review-comment">{m.message || "—"}</td>
                        <td>
                          <span className={`status-badge ${m.status === "new" ? "status-pending" : m.status === "replied" ? "status-delivered" : "status-cancelled"}`}>
                            {m.status}
                          </span>
                        </td>
                        <td>{formatDate(m.created_at)}</td>
                        <td>
                          <div className="pay-actions">
                            {m.status !== "replied" && (
                              <button className="btn btn-gold btn-xs" onClick={() => actMessageStatus(m.id, "replied")}>Mark Replied</button>
                            )}
                            {m.status !== "archived" && (
                              <button className="btn btn-ghost btn-xs" onClick={() => actMessageStatus(m.id, "archived")}>Archive</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!config?.mail_configured && (
          <div className="admin-note warn">
            Email is not configured (RESEND_API_KEY missing) — order confirmation emails will not be sent.
          </div>
        )}

        {/* ---------------- ORDER MODAL ---------------- */}
        {selectedOrder && (
          <div className="modal-overlay admin-modal-overlay" onClick={() => setSelectedOrder(null)}>
            <div className="admin-order-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>&times;</button>
              <h3>Order Details — {selectedOrder.id}</h3>

              <h4>Order</h4>
              <div className="detail-row">
                <span className="detail-label">Date</span>
                <span className="detail-value">{formatDate(selectedOrder.created_at)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => changeStatus(selectedOrder.id, e.target.value)}
                    className={`status-select ${statusColors[selectedOrder.status] || ""}`}
                  >
                    {[selectedOrder.status, ...allowedTransitions(selectedOrder)].map((s) => (
                      <option key={s} value={s} disabled={s === selectedOrder.status}>
                        {s === selectedOrder.status ? `${statusLabels[s] || s} (current)` : statusLabels[s] || s}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Payment</span>
                <span className="detail-value">
                  {paymentMethodLabels[selectedOrder.payment] || selectedOrder.payment}
                  <span className={`pay-badge ${paymentStatusClass(selectedOrder.payment_status)}`}>
                    {paymentStatusLabels[selectedOrder.payment_status] || selectedOrder.payment_status}
                  </span>
                </span>
              </div>
              {(selectedOrder.confirmed_at || selectedOrder.paid_at || selectedOrder.delivered_at || selectedOrder.cancelled_at) && (
                <div className="detail-row">
                  <span className="detail-label">Key dates</span>
                  <span className="detail-value detail-mono">
                    {selectedOrder.confirmed_at && <>Confirmed {formatDate(selectedOrder.confirmed_at)}</>}
                    {selectedOrder.paid_at && <> · Paid {formatDate(selectedOrder.paid_at)}</>}
                    {selectedOrder.delivered_at && <> · Delivered {formatDate(selectedOrder.delivered_at)}</>}
                    {selectedOrder.cancelled_at && <> · Cancelled {formatDate(selectedOrder.cancelled_at)}</>}
                  </span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Total</span>
                <span className="detail-value order-total">{formatPrice(selectedOrder.total)}</span>
              </div>

              <h4>Customer</h4>
              <div className="detail-row">
                <span className="detail-label">Name</span>
                <span className="detail-value">{selectedOrder.customer_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Phone</span>
                <span className="detail-value">{selectedOrder.customer_phone}</span>
              </div>
              {selectedOrder.customer_email && (
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{selectedOrder.customer_email}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Address</span>
                <span className="detail-value">{selectedOrder.customer_address}, {selectedOrder.customer_city}</span>
              </div>
              {selectedOrder.customer_note && (
                <div className="detail-row">
                  <span className="detail-label">Note</span>
                  <span className="detail-value">{selectedOrder.customer_note}</span>
                </div>
              )}

              <h4>Items</h4>
              <div className="order-items-detail">
                {(selectedOrder.items || []).map((item, i) => (
                  <div key={i} className="order-item-detail">
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-size">({item.size})</span>
                    </div>
                    <div className="item-qty-price">
                      <span className="item-qty">× {item.qty}</span>
                      <span className="item-price">{formatPrice(item.price * item.qty)}</span>
                    </div>
                  </div>
                ))}
                <div className="order-item-detail order-total-row">
                  <div className="item-info"><span className="item-name">Total</span></div>
                  <div className="item-qty-price"><span className="item-price">{formatPrice(selectedOrder.total)}</span></div>
                </div>
              </div>

              <h4>Payments</h4>
              {(selectedOrder.payments || []).length === 0 ? (
                <p className="detail-subtle">No payment records.</p>
              ) : (
                (selectedOrder.payments || []).map((p) => (
                  <div className="payment-detail-card" key={p.id}>
                    <div className="detail-row">
                      <span className="detail-label">Method</span>
                      <span className="detail-value">{paymentMethodLabels[p.method] || p.method}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Amount</span>
                      <span className="detail-value">{formatPrice(p.amount)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Reference</span>
                      <span className="detail-value detail-mono">{p.transaction_ref || "—"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Sender</span>
                      <span className="detail-value">{p.sender_name || "—"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Notes</span>
                      <span className="detail-value">{p.notes || "—"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Status</span>
                      <span className="detail-value detail-mono">{p.status}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Submitted</span>
                      <span className="detail-value">{formatDate(new Date(p.submitted_at * 1000).toISOString())}</span>
                    </div>
                    {p.verified_at && (
                      <div className="detail-row">
                        <span className="detail-label">Verified</span>
                        <span className="detail-value">{formatDate(p.verified_at)}</span>
                      </div>
                    )}
                  </div>
                ))
              )}

              <h4>Status History</h4>
              <div className="status-timeline">
                {(selectedOrder.status_history || []).map((h, i) => (
                  <div className="timeline-item" key={i}>
                    <span className="timeline-status">{h.status}</span>
                    <span className="timeline-note">{h.note || ""}</span>
                    <span className="timeline-at">{formatDate(h.at)}</span>
                    {h.payment_status && <span className="timeline-pay">payment: {h.payment_status}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PAYMENT CONFIRM MODAL ---------------- */}
        {confirmPayment && (
          <div className="modal-overlay admin-modal-overlay" onClick={() => setConfirmPayment(null)}>
            <div className="admin-order-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setConfirmPayment(null)}>&times;</button>
              <h3>Update Payment #{confirmPayment.id}</h3>
              <p className="detail-subtle">This action reflects the real payment record and updates the order.</p>
              <div className="field">
                <label htmlFor="verifyNote">Admin note (optional)</label>
                <input
                  type="text"
                  id="verifyNote"
                  placeholder="e.g. IBFT matched, amount received"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                />
              </div>
              <button
                className="btn btn-gold btn-block"
                onClick={() => doVerifyPayment(confirmPayment.id, confirmPayment.status)}
              >
                Confirm — mark as {confirmPayment.status === "paid" ? "PAID" : confirmPayment.status === "failed" ? "REJECTED" : "REFUNDED"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}