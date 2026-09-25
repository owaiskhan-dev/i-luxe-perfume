import { useEffect, useState } from "react";
import { formatPrice } from "../data/products";
import { useShop } from "../store/ShopContext";
import {
  getMyOrders,
  getOrderById,
  submitPaymentReference,
  createOrderRequest,
  initiateJazzCash,
  getCatalog,
} from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  return_requested: "Return requested",
  returned: "Returned",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS = {
  cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer",
  jazzcash: "JazzCash",
};

const statusClass = (s) => {
  if (s === "delivered") return "st-delivered";
  if (s === "cancelled" || s === "returned" || s === "refunded") return "st-cancelled";
  if (s === "refund_pending" || s === "return_requested") return "st-refund";
  if (s === "confirmed" || s === "processing" || s === "shipped") return "st-processing";
  return "st-pending";
};

export default function AccountPage() {
  const { isCustomer, customerUser, requestOtp, loginWithOtp, logoutCustomer, saveProfile } = useShop();

  const [authEmail, setAuthEmail] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [authStep, setAuthStep] = useState("request");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState({ text: "", type: "" });

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersMsg, setOrdersMsg] = useState({ text: "", type: "" });

  const [profile, setProfile] = useState({ full_name: "", phone: "", city: "", address: "", note: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: "", type: "" });

  const [catalog, setCatalog] = useState(null);
  const [proofInputs, setProofInputs] = useState({});
  const [proofBusy, setProofBusy] = useState({});
  const [actions, setActions] = useState({});

  useEffect(() => {
    getCatalog()
      .then((c) => setCatalog(c))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (customerUser) {
      setProfile({
        full_name: customerUser.full_name || "",
        phone: customerUser.phone || "",
        city: customerUser.city || "",
        address: customerUser.address || "",
        note: customerUser.note || "",
      });
      loadOrders();
    } else {
      setOrders([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerUser]);

  const loadOrders = async (silent = true) => {
    if (!silent) setOrdersLoading(true);
    try {
      const list = await getMyOrders();
      setOrders(list);
      setOrdersMsg({ text: "", type: "" });
    } catch (err) {
      setOrdersMsg({ text: err.message || "Could not load your orders.", type: "error" });
    } finally {
      setOrdersLoading(false);
    }
  };

  const refreshOrder = async (orderId) => {
    try {
      const fresh = await getOrderById(orderId);
      setOrders((prev) => prev.map((o) => (o.id === fresh.id ? fresh : o)));
    } catch {
      /* ignore */
    }
  };

  const sendOtp = async (e) => {
    e?.preventDefault();
    if (!EMAIL_RE.test(authEmail.trim())) {
      setAuthMsg({ text: "Please enter a valid email address.", type: "error" });
      return;
    }
    setAuthBusy(true);
    setAuthMsg({ text: "", type: "" });
    try {
      const res = await requestOtp(authEmail.trim());
      // The code-entry screen may only appear once the email API has
      // confirmed the code was actually sent.
      if (res?.delivered !== true) {
        setAuthStep("request");
        setAuthMsg({ text: "The code could not be emailed. Please try again in a moment.", type: "error" });
        return;
      }
      setAuthStep("verify");
      setAuthMsg({ text: "Verification code sent to your email.", type: "ok" });
    } catch (err) {
      setAuthStep("request");
      setAuthMsg({ text: err.message || "Could not send code.", type: "error" });
    } finally {
      setAuthBusy(false);
    }
  };

  const verifyOtpCode = async (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(authOtp.trim())) {
      setAuthMsg({ text: "Enter the 6-digit code you received.", type: "error" });
      return;
    }
    setAuthBusy(true);
    setAuthMsg({ text: "", type: "" });
    try {
      await loginWithOtp(authEmail.trim(), authOtp.trim());
      setAuthStep("request");
    } catch (err) {
      setAuthMsg({ text: err.message || "Invalid or expired code.", type: "error" });
    } finally {
      setAuthBusy(false);
    }
  };

  const saveProfileNow = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ text: "", type: "" });
    try {
      await saveProfile(profile);
      setProfileMsg({ text: "Profile saved.", type: "ok" });
    } catch (err) {
      setProfileMsg({ text: err.message || "Could not save profile.", type: "error" });
    } finally {
      setProfileSaving(false);
    }
  };

  const submitProof = async (order) => {
    const v = proofInputs[order.id] || {};
    if ((v.transaction_ref || "").trim().length < 3) {
      setOrdersMsg({ text: "Enter the transaction reference for verification.", type: "error" });
      return;
    }
    setProofBusy((b) => ({ ...b, [order.id]: true }));
    setOrdersMsg({ text: "", type: "" });
    try {
      await submitPaymentReference(order.id, {
        sender_name: v.sender_name?.trim() || undefined,
        transaction_ref: v.transaction_ref.trim(),
        notes: v.notes?.trim() || undefined,
      });
      setOrdersMsg({ text: `Reference submitted for ${order.id}. We'll verify and ship it.`, type: "ok" });
      setProofInputs((prev) => ({ ...prev, [order.id]: {} }));
      await refreshOrder(order.id);
    } catch (err) {
      setOrdersMsg({ text: err.message || "Could not submit reference.", type: "error" });
    } finally {
      setProofBusy((b) => ({ ...b, [order.id]: false }));
    }
  };

  const payWithJazzCash = async (order) => {
    setProofBusy((b) => ({ ...b, [order.id]: true }));
    try {
      const res = await initiateJazzCash(order.id);
      if (res?.redirect && res?.params) {
        const formEl = document.createElement("form");
        formEl.method = "POST";
        formEl.action = res.redirect;
        for (const [k, v] of Object.entries(res.params)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = v;
          formEl.appendChild(input);
        }
        document.body.appendChild(formEl);
        formEl.submit();
      } else {
        setOrdersMsg({ text: "JazzCash is not ready yet — use the reference option.", type: "error" });
      }
    } catch (err) {
      setOrdersMsg({ text: err.message || "Could not start JazzCash payment.", type: "error" });
    } finally {
      setProofBusy((b) => ({ ...b, [order.id]: false }));
    }
  };

  const requestOrderAction = async (order, type, reason) => {
    setActions((a) => ({ ...a, [`${order.id}:${type}`]: true }));
    setOrdersMsg({ text: "", type: "" });
    try {
      await createOrderRequest(order.id, type, reason);
      setOrdersMsg({ text: `${type === "cancel" ? "Cancellation" : "Return"} request submitted.`, type: "ok" });
      await refreshOrder(order.id);
    } catch (err) {
      setOrdersMsg({ text: err.message || "Request could not be submitted.", type: "error" });
    } finally {
      setActions((a) => ({ ...a, [`${order.id}:${type}`]: false }));
    }
  };

  if (!isCustomer) {
    return (
      <div className="page account-page">
        <div className="container">
          <div className="account-auth-card">
            <h1 className="section-title">My Account</h1>
            <p className="section-sub">Sign in with a one-time code to view your orders and track delivery.</p>

            {authStep === "request" ? (
              <form className="account-auth-form" onSubmit={sendOtp} noValidate>
                <div className="field">
                  <label htmlFor="acEmail">Email Address *</label>
                  <input
                    type="email"
                    id="acEmail"
                    placeholder="you@email.com"
                    value={authEmail}
                    onChange={(e) => {
                      setAuthEmail(e.target.value);
                      setAuthMsg({ text: "", type: "" });
                    }}
                  />
                </div>
                <button className="btn btn-gold btn-block" disabled={authBusy}>
                  {authBusy ? "Sending..." : "Send Verification Code"}
                </button>
              </form>
            ) : (
              <form className="account-auth-form" onSubmit={verifyOtpCode} noValidate>
                <div className="field">
                  <label htmlFor="acCode">Verification Code *</label>
                  <input
                    type="text"
                    id="acCode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={authOtp}
                    onChange={(e) => {
                      setAuthOtp(e.target.value.replace(/\D/g, ""));
                      setAuthMsg({ text: "", type: "" });
                    }}
                  />
                </div>
                <button className="btn btn-gold btn-block" disabled={authBusy}>
                  {authBusy ? "Verifying..." : "Verify & Continue"}
                </button>
                <button className="btn-back" type="button" onClick={() => { setAuthStep("request"); setAuthMsg({ text: "", type: "" }); }}>
                  &larr; Use a different email
                </button>
              </form>
            )}

            <p className={`form-msg ${authMsg.type || ""}`}>{authMsg.text}</p>
          </div>
        </div>
      </div>
    );
  }

  const jazzcashConfigured = !!catalog?.jazzcash_configured;

  return (
    <div className="page account-page">
      <div className="container">
        <div className="account-top">
          <div>
            <h1 className="section-title">My Account</h1>
            <p className="section-sub">
              Signed in as <strong>{customerUser?.email}</strong>. Track orders and keep your delivery details up to date.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logoutCustomer}>
            Sign Out
          </button>
        </div>

        <div className="account-layout">
          <div className="account-card">
            <h2 className="account-heading">Delivery Profile</h2>
            <form onSubmit={saveProfileNow} noValidate>
              <div className="field">
                <label htmlFor="pfName">Full Name</label>
                <input
                  type="text"
                  id="pfName"
                  value={profile.full_name}
                  onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="pfPhone">Phone Number</label>
                <input
                  type="tel"
                  id="pfPhone"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="pfCity">City</label>
                <input
                  type="text"
                  id="pfCity"
                  value={profile.city}
                  onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="pfAddress">Delivery Address</label>
                <input
                  type="text"
                  id="pfAddress"
                  value={profile.address}
                  onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="pfNote">Delivery Note</label>
                <textarea
                  id="pfNote"
                  rows="2"
                  value={profile.note}
                  onChange={(e) => setProfile((p) => ({ ...p, note: e.target.value }))}
                ></textarea>
              </div>
              <button type="submit" className="btn btn-gold" disabled={profileSaving}>
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
              <p className={`form-msg ${profileMsg.type || ""}`}>{profileMsg.text}</p>
            </form>
          </div>

          <div className="account-card account-orders">
            <h2 className="account-heading">My Orders</h2>
            {ordersLoading && <p className="orders-empty">Loading your orders...</p>}
            <p className={`form-msg ${ordersMsg.type || ""}`}>{ordersMsg.text}</p>

            {!ordersLoading && orders.length === 0 && (
              <p className="orders-empty">
                No orders yet. When you place an order, it will appear here.
              </p>
            )}

            {orders.map((order) => {
              const items = Array.isArray(order.items) ? order.items : [];
              const needsProof =
                (order.payment === "bank_transfer" || order.payment === "jazzcash") &&
                order.payment_status !== "paid" &&
                order.payment_status !== "refunded" &&
                order.status !== "cancelled";
              const canCancel = ["pending", "confirmed", "processing"].includes(order.status);
              const canReturn = order.status === "delivered";
              const proofInput = proofInputs[order.id] || {};

              return (
                <div className="order-row" key={order.id}>
                  <div className="order-row-head">
                    <div>
                      <strong>Order {order.id}</strong>
                      <span className="order-date">
                        {new Date(`${order.created_at}${order.created_at.includes("T") ? "" : "Z"}`).toLocaleString("en-GB")}
                      </span>
                    </div>
                    <span className={`order-status ${statusClass(order.status)}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  <div className="order-row-pay">
                    <span>{PAYMENT_LABELS[order.payment] || order.payment}</span>
                    <span className={`pay-status ${order.payment_status === "paid" ? "ok" : ""}`}>
                      {order.payment_status === "verification_required"
                        ? "Payment under verification"
                        : order.payment_status === "paid"
                        ? "Paid"
                        : order.payment_status === "cod_pending"
                        ? "Pay on delivery"
                        : order.payment_status === "refunded"
                        ? "Refunded"
                        : order.payment_status === "failed"
                        ? "Payment failed"
                        : order.payment_status === "pending"
                        ? "Awaiting payment"
                        : order.payment_status}
                    </span>
                  </div>

                  <div className="order-row-items">
                    {items.map((i, idx) => (
                      <div className="order-row-item" key={`${i.id}-${idx}`}>
                        <span>
                          {i.name} <em>({i.size})</em> &times; {i.qty}
                        </span>
                        <span>{formatPrice(i.price * i.qty)}</span>
                      </div>
                    ))}
                    <div className="order-row-item">
                      <span>Delivery</span>
                      <span>{formatPrice(order.delivery_fee)}</span>
                    </div>
                    <div className="order-row-item order-row-total">
                      <span>Total</span>
                      <span>{formatPrice(order.total)}</span>
                    </div>
                  </div>

                  {(needsProof || canCancel || canReturn) && (
                    <div className="order-row-actions">
                      {needsProof && order.payment === "bank_transfer" && (
                        <div className="order-proof">
                          <details>
                            <summary>Submit payment proof (bank transfer)</summary>
                            <div className="payment-proof-form">
                              <div className="detail-row">
                                <span className="detail-label">Transfer to</span>
                                <span className="detail-value detail-mono">
                                  {catalog?.bank_transfer?.account_number || "0010159652950014"}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">IBAN</span>
                                <span className="detail-value detail-mono">
                                  {catalog?.bank_transfer?.iban || "PK00ALLA000000100159652950014"}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">Amount</span>
                                <span className="detail-value detail-mono">{formatPrice(order.total)}</span>
                              </div>
                              <div className="field">
                                <label>Sender Name (optional)</label>
                                <input
                                  type="text"
                                  value={proofInput.sender_name || ""}
                                  onChange={(e) =>
                                    setProofInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], sender_name: e.target.value } }))
                                  }
                                />
                              </div>
                              <div className="field">
                                <label>Transaction Reference *</label>
                                <input
                                  type="text"
                                  placeholder="e.g. IBFT200315"
                                  value={proofInput.transaction_ref || ""}
                                  onChange={(e) =>
                                    setProofInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], transaction_ref: e.target.value } }))
                                  }
                                />
                              </div>
                              <div className="field">
                                <label>Notes (optional)</label>
                                <input
                                  type="text"
                                  value={proofInput.notes || ""}
                                  onChange={(e) =>
                                    setProofInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], notes: e.target.value } }))
                                  }
                                />
                              </div>
                              <button
                                className="btn btn-gold"
                                disabled={proofBusy[order.id]}
                                onClick={() => submitProof(order)}
                              >
                                {proofBusy[order.id] ? "Submitting..." : "Submit Reference"}
                              </button>
                            </div>
                          </details>
                        </div>
                      )}

                      {needsProof && order.payment === "jazzcash" && jazzcashConfigured && (
                        <button
                          className="btn btn-gold"
                          disabled={proofBusy[order.id]}
                          onClick={() => payWithJazzCash(order)}
                        >
                          {proofBusy[order.id] ? "Redirecting..." : "Pay with JazzCash online"}
                        </button>
                      )}

                      {needsProof && order.payment === "jazzcash" && !jazzcashConfigured && (
                        <div className="order-proof">
                          <details>
                            <summary>Submit payment proof (JazzCash)</summary>
                            <div className="payment-proof-form">
                              <div className="detail-row">
                                <span className="detail-label">Send to</span>
                                <span className="detail-value detail-mono">
                                  {catalog?.jazzcash?.wallet_number || "03222629284"}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">Amount</span>
                                <span className="detail-value detail-mono">{formatPrice(order.total)}</span>
                              </div>
                              <div className="field">
                                <label>Sender Name (optional)</label>
                                <input
                                  type="text"
                                  value={proofInput.sender_name || ""}
                                  onChange={(e) =>
                                    setProofInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], sender_name: e.target.value } }))
                                  }
                                />
                              </div>
                              <div className="field">
                                <label>Transaction Reference *</label>
                                <input
                                  type="text"
                                  placeholder="e.g. JZ-123456"
                                  value={proofInput.transaction_ref || ""}
                                  onChange={(e) =>
                                    setProofInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], transaction_ref: e.target.value } }))
                                  }
                                />
                              </div>
                              <button
                                className="btn btn-gold"
                                disabled={proofBusy[order.id]}
                                onClick={() => submitProof(order)}
                              >
                                {proofBusy[order.id] ? "Submitting..." : "Submit Reference"}
                              </button>
                            </div>
                          </details>
                        </div>
                      )}

                      {canCancel && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={actions[`${order.id}:cancel`]}
                          onClick={() => requestOrderAction(order, "cancel", "")}
                        >
                          {actions[`${order.id}:cancel`] ? "Requesting..." : "Request Cancellation"}
                        </button>
                      )}

                      {canReturn && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={actions[`${order.id}:return`]}
                          onClick={() => requestOrderAction(order, "return", "")}
                        >
                          {actions[`${order.id}:return`] ? "Requesting..." : "Request Return"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}