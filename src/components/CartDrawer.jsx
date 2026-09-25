import { useEffect, useState } from "react";
import { byId, formatPrice } from "../data/products";
import { useShop } from "../store/ShopContext";
import { DELIVERY_NOTE, BRAND_NAME } from "../data/brand";
import { placeOrder, submitPaymentReference, initiateJazzCash } from "../lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PaymentIcons = {
  cash: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 14h12" />
      <path d="M10 4v4" />
    </svg>
  ),
  bank: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 14h12" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  jazzcash: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M5 8h14" />
      <path d="M12 12h.01" />
      <path d="M12 16h.01" />
    </svg>
  ),
  card: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 10h20" />
      <path d="M2 14h20" />
    </svg>
  ),
};

export default function CartDrawer() {
  const {
    cartOpen,
    setCartOpen,
    cart,
    setQty,
    removeFromCart,
    clearCart,
    subtotal,
    subtotalLabel,
    deliveryFee,
    deliveryFeeLabel,
    showToast,
    isCustomer,
    customerUser,
    customerToken,
    catalog,
    requestOtp,
    loginWithOtp,
  } = useShop();

  const [view, setView] = useState("cart");
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState("cod");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    address: "",
    note: "",
  });
  const [invalid, setInvalid] = useState({});
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [submitting, setSubmitting] = useState(false);
  const [expandedPayment, setExpandedPayment] = useState(null);

  // Sign-in gate state
  const [authEmail, setAuthEmail] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [authStep, setAuthStep] = useState("request"); // request | verify
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState({ text: "", type: "" });

  // Payment proof submission state
  const [proofOpen, setProofOpen] = useState(false);
  const [proof, setProof] = useState({ sender_name: "", transaction_ref: "", notes: "" });
  const [proofBusy, setProofBusy] = useState(false);
  const [proofMsg, setProofMsg] = useState({ text: "", type: "" });
  const [proofDone, setProofDone] = useState(false);

  const bank = catalog?.bank_transfer;
  const jazz = catalog?.jazzcash;
  const jazzcashConfigured = !!catalog?.jazzcash_configured;

  const PAYMENT_METHODS = [
    {
      id: "cod",
      label: "Cash on Delivery",
      note: "Pay in cash when your order arrives.",
      icon: "cash",
      disabled: false,
    },
    {
      id: "bank_transfer",
      label: "Bank Transfer",
      note: "Transfer to our account. Order ships after verification.",
      icon: "bank",
      disabled: false,
      details: {
        bankName: bank?.bank_name || "Allied Bank",
        accountName: bank?.account_name || "Sidra Anum",
        accountNumber: bank?.account_number || "",
        iban: bank?.iban || "",
        branch: bank?.branch || "",
      },
    },
    {
      id: "jazzcash",
      label: "JazzCash",
      note: jazzcashConfigured
        ? "Pay securely online via JazzCash."
        : "Send payment via JazzCash mobile wallet.",
      icon: "jazzcash",
      disabled: false,
      details: {
        accountName: jazz?.wallet_name || "Iqra Anum",
        number: jazz?.wallet_number || "03222629284",
      },
    },
    {
      id: "card",
      label: "Credit / Debit Card",
      note: "Secure card payments coming soon.",
      icon: "card",
      disabled: true,
    },
  ];

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  useEffect(() => {
    if (cartOpen && (view === "done" || view === "checkout" || view === "signin") && cart.length === 0) {
      setView("cart");
    }
  }, [cartOpen, view, cart.length]);

  // Prefill the order form from the customer's saved profile.
  useEffect(() => {
    if (customerUser) {
      setForm((f) => ({
        name: f.name || customerUser.full_name || "",
        phone: f.phone || customerUser.phone || "",
        city: f.city || customerUser.city || "",
        address: f.address || customerUser.address || "",
        note: f.note || "",
      }));
    }
  }, [customerUser]);

  // Reset auth gate when signing in again.
  useEffect(() => {
    if (view !== "signin") return;
    if (isCustomer) setView("checkout");
  }, [view, isCustomer]);

  const close = () => setCartOpen(false);

  const goCheckout = () => {
    if (cart.length === 0) {
      showToast("Your cart is empty");
      return;
    }
    if (!customerToken) {
      setAuthEmail("");
      setAuthOtp("");
      setDevOtp("");
      setAuthMsg({ text: "", type: "" });
      setAuthStep("request");
      setProofDone(false);
      setView("signin");
      return;
    }
    setView("checkout");
    setMsg({ text: "", type: "" });
  };

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (invalid[field]) setInvalid((i) => ({ ...i, [field]: false }));
    setMsg({ text: "", type: "" });
  };

  // ---- OTP auth gate ------------------------------------------------------

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
      setAuthMsg({ text: err.message || "Could not send code. Please try again.", type: "error" });
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
      setView("checkout");
    } catch (err) {
      setAuthMsg({ text: err.message || "Invalid or expired code.", type: "error" });
    } finally {
      setAuthBusy(false);
    }
  };

  const switchCustomer = (e) => {
    e?.preventDefault();
    setAuthStep("request");
    setAuthMsg({ text: "", type: "" });
  };

  // ---- Order placement ----------------------------------------------------

  const placeCustomerOrder = async (e) => {
    e?.preventDefault();
    const errors = {};
    if (form.name.trim().length < 2) errors.name = true;
    if (form.phone.trim().replace(/\D/g, "").length < 7) errors.phone = true;
    if (form.city.trim().length < 2) errors.city = true;
    if (form.address.trim().length < 8) errors.address = true;

    if (Object.keys(errors).length > 0) {
      setInvalid(errors);
      setMsg({ text: "Please complete the required fields.", type: "error" });
      return;
    }

    const selectedMethod = PAYMENT_METHODS.find((m) => m.id === payment);
    if (selectedMethod?.disabled) {
      setMsg({ text: "This payment method is not available yet.", type: "error" });
      return;
    }

    setSubmitting(true);
    setMsg({ text: "", type: "" });

    const items = cart
      .map((item) => {
        const p = byId(item.id);
        if (!p) return null;
        return { id: p.id, qty: item.qty };
      })
      .filter(Boolean);

    try {
      const serverOrder = await placeOrder({
        payment,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        customer_city: form.city.trim(),
        customer_address: form.address.trim(),
        customer_note: form.note.trim() || null,
        items,
      });
      clearCart();
      const displayOrder = {
        ...serverOrder,
        date: new Date().toLocaleString("en-GB"),
        paymentLabel:
          payment === "bank_transfer"
            ? "Bank Transfer"
            : payment === "jazzcash"
            ? "JazzCash"
            : "Cash on Delivery",
      };
      setOrder(displayOrder);
      setProofOpen(false);
      setProof({ sender_name: customerUser?.full_name || "", transaction_ref: "", notes: "" });
      setProofDone(false);
      setProofMsg({ text: "", type: "" });
      setView("done");
      showToast("Order placed");
    } catch (err) {
      setMsg({ text: err.message || "Failed to place order. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Payment proof (bank transfer / manual JazzCash) --------------------

  const submitProof = async (e) => {
    e?.preventDefault();
    if (proof.transaction_ref.trim().length < 3) {
      setProofMsg({ text: "Enter the transaction reference (e.g. IBFT/FTC/transfer ID).", type: "error" });
      return;
    }
    setProofBusy(true);
    setProofMsg({ text: "", type: "" });
    try {
      await submitPaymentReference(order.id, {
        sender_name: proof.sender_name.trim() || undefined,
        transaction_ref: proof.transaction_ref.trim(),
        notes: proof.notes.trim() || undefined,
      });
      setProofDone(true);
      setProofMsg({
        text: "Payment proof submitted for verification. We'll confirm and ship your order.",
        type: "ok",
      });
    } catch (err) {
      setProofMsg({ text: err.message || "Could not submit proof.", type: "error" });
    } finally {
      setProofBusy(false);
    }
  };

  const payWithJazzCash = async (e) => {
    e?.preventDefault();
    setProofBusy(true);
    setProofMsg({ text: "", type: "" });
    try {
      const res = await initiateJazzCash(order.id);
      if (res?.redirect && res?.params) {
        const withToken = { ...res.params, token: customerToken };
        const formEl = document.createElement("form");
        formEl.method = "POST";
        formEl.action = res.redirect;
        for (const [k, v] of Object.entries(withToken)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = v;
          formEl.appendChild(input);
        }
        document.body.appendChild(formEl);
        formEl.submit();
      } else {
        setProofMsg({ text: "JazzCash is not ready yet. Please use the manual reference option instead.", type: "error" });
      }
    } catch (err) {
      setProofMsg({ text: err.message || "Could not start JazzCash payment.", type: "error" });
    } finally {
      setProofBusy(false);
    }
  };

  const isBankTransfer = payment === "bank_transfer";
  const isJazzCash = payment === "jazzcash";

  const submitText = isBankTransfer
    ? "Place Order — Pay via Bank Transfer"
    : isJazzCash
    ? "Place Order — Pay via JazzCash"
    : "Place Order — Pay on Delivery";

  const needsProofAfterOrder = isBankTransfer || isJazzCash;

  const total = subtotal + deliveryFee;

  return (
    <>
      <div className={`overlay ${cartOpen ? "open" : ""}`} onClick={close}></div>
      <aside className={`cart-drawer ${cartOpen ? "open" : ""}`} aria-label="Shopping cart" aria-hidden={!cartOpen}>
        <div className="cart-head">
          <h3>
            {view === "checkout" ? "Checkout" : view === "signin" ? "Sign In" : view === "done" ? "Order Received" : "Your Cart"}
          </h3>
          <button className="cart-close" aria-label="Close cart" onClick={close}>
            &times;
          </button>
        </div>

        {view === "cart" && (
          <>
            <div className="cart-body">
              {cart.length === 0 ? (
                <p className="cart-empty">
                  Your cart is empty.
                  <br />
                  Discover something extraordinary.
                </p>
              ) : (
                cart.map((item) => {
                  const product = byId(item.id);
                  if (!product) return null;
                  return (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-thumb">
                        <img src={product.image} alt={product.name} loading="lazy" />
                      </div>
                      <div className="cart-item-info">
                        <div className="cart-item-name">{product.name}</div>
                        <div className="cart-item-size">
                          {product.size || "Signature"}
                        </div>
                        <div className="cart-item-price">
                          {formatPrice(product.salePrice)}
                        </div>
                        <div className="cart-item-controls">
                          <button
                            className="cart-qty-btn"
                            aria-label={`Decrease ${product.name} quantity`}
                            onClick={() => setQty(item.id, -1)}
                          >
                            &minus;
                          </button>
                          <span className="cart-item-qty">{item.qty}</span>
                          <button
                            className="cart-qty-btn"
                            aria-label={`Increase ${product.name} quantity`}
                            onClick={() => setQty(item.id, 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="cart-remove"
                          onClick={() => removeFromCart(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="cart-foot">
              <div className="cart-total">
                <span>Subtotal</span>
                <span>{subtotalLabel}</span>
              </div>
              <button
                className="btn btn-gold btn-block"
                onClick={goCheckout}
                disabled={cart.length === 0}
              >
                {isCustomer ? "Proceed to Checkout" : "Checkout — Sign In"}
              </button>
              <p className="cart-note">
                {DELIVERY_NOTE} &middot; {deliveryFeeLabel}
              </p>
            </div>
          </>
        )}

        {view === "signin" && (
          <div className="cart-body checkout-form">
            <div className="checkout-delivery-note">
              Subscribe a real order: we need to verify your email first.
            </div>
            <p className="auth-gate-note">
              Orders are linked to your email so you can track them and we can send a confirmation
              &mdash; login with a one-time code (no password).
            </p>

            {authStep === "request" ? (
              <>
                <div className="field">
                  <label htmlFor="authEmail">Email Address *</label>
                  <input
                    type="email"
                    id="authEmail"
                    placeholder="you@email.com"
                    value={authEmail}
                    onChange={(e) => {
                      setAuthEmail(e.target.value);
                      setAuthMsg({ text: "", type: "" });
                    }}
                  />
                </div>
                <button className="btn btn-gold btn-block" onClick={sendOtp} disabled={authBusy}>
                  {authBusy ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="authCode">Verification Code *</label>
                  <input
                    type="text"
                    id="authCode"
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
                <button className="btn btn-gold btn-block" onClick={verifyOtpCode} disabled={authBusy}>
                  {authBusy ? "Verifying..." : "Verify & Continue"}
                </button>
                <button className="btn-back" type="button" onClick={switchCustomer}>
                  &larr; Use a different email
                </button>
              </>
            )}

            <p className={`form-msg ${authMsg.type || ""}`}>{authMsg.text}</p>
          </div>
        )}

        {view === "checkout" && isCustomer && (
          <form className="cart-body checkout-form" noValidate onSubmit={placeCustomerOrder}>
            <div className="checkout-delivery-note">
              {BRAND_NAME} &mdash; delivered across Karachi.
            </div>
            <p className="auth-gate-note">
              Signed in as <strong>{customerUser?.email}</strong>. Orders appear under My Orders.
            </p>

            <div className="field">
              <label htmlFor="coName">Full Name *</label>
              <input
                type="text"
                id="coName"
                placeholder="Recipient's full name"
                className={invalid.name ? "invalid" : ""}
                value={form.name}
                onChange={setField("name")}
              />
            </div>

            <div className="field">
              <label htmlFor="coPhone">Phone Number *</label>
              <input
                type="tel"
                id="coPhone"
                placeholder="03XX - XXXXXXX"
                className={invalid.phone ? "invalid" : ""}
                value={form.phone}
                onChange={setField("phone")}
              />
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="coCity">City *</label>
                <input
                  type="text"
                  id="coCity"
                  placeholder="Karachi"
                  className={invalid.city ? "invalid" : ""}
                  value={form.city}
                  onChange={setField("city")}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="coAddress">Delivery Address *</label>
              <input
                type="text"
                id="coAddress"
                placeholder="House, street, area"
                className={invalid.address ? "invalid" : ""}
                value={form.address}
                onChange={setField("address")}
              />
            </div>

            <div className="field">
              <label htmlFor="coNote">Order Note (optional)</label>
              <textarea
                id="coNote"
                rows="2"
                placeholder="Anything we should know about the delivery?"
                value={form.note}
                onChange={setField("note")}
              ></textarea>
            </div>

            <div className="field">
              <label>Payment Method</label>
              <div className="payment-methods-grid">
                {PAYMENT_METHODS.map((m) => {
                  const isSelected = payment === m.id && !m.disabled;
                  return (
                    <label
                      key={m.id}
                      className={`payment-method-card ${m.disabled ? "disabled" : ""} ${isSelected ? "selected" : ""}`}
                      onClick={() => !m.disabled && setPayment(m.id)}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={m.id}
                        checked={payment === m.id}
                        disabled={m.disabled}
                        onChange={() => !m.disabled && setPayment(m.id)}
                        className="payment-method-radio"
                      />
                      <div className="payment-method-content">
                        <div className="payment-method-icon">
                          {PaymentIcons[m.icon]}
                        </div>
                        <div className="payment-method-info">
                          <strong className="payment-method-label">{m.label}</strong>
                          <span className="payment-method-note">{m.note}</span>
                        </div>
                        {m.disabled && <span className="payment-method-tag">Coming Soon</span>}
                        {isSelected && <span className="payment-method-check">✓</span>}
                      </div>
                      {m.details && !m.disabled && (
                        <button
                          type="button"
                          className={`payment-method-expand ${expandedPayment === m.id ? "open" : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedPayment(expandedPayment === m.id ? null : m.id);
                          }}
                          aria-expanded={expandedPayment === m.id}
                          aria-label={expandedPayment === m.id ? `Hide ${m.label} details` : `Show ${m.label} details`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>

              {expandedPayment && PAYMENT_METHODS.find((m) => m.id === expandedPayment)?.details && (
                <div className="payment-method-details">
                  {(() => {
                    const method = PAYMENT_METHODS.find((m) => m.id === expandedPayment);
                    if (method.id === "bank_transfer") {
                      const d = method.details;
                      return (
                        <div className="bank-transfer-details">
                          <h4>Bank Transfer Details</h4>
                          <div className="detail-row">
                            <span className="detail-label">Bank</span>
                            <span className="detail-value">{d.bankName}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Account Title</span>
                            <span className="detail-value">{d.accountName}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Account Number</span>
                            <span className="detail-value detail-mono">{d.accountNumber}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">IBAN</span>
                            <span className="detail-value detail-mono">{d.iban}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Branch</span>
                            <span className="detail-value">{d.branch}</span>
                          </div>
                          <p className="detail-instruction">
                            After placing the order you'll submit your transaction reference here &mdash;
                            nothing ships until our team verifies it.
                          </p>
                        </div>
                      );
                    }
                    if (method.id === "jazzcash") {
                      const d = method.details;
                      return (
                        <div className="jazzcash-details">
                          <h4>JazzCash Details</h4>
                          <div className="detail-row">
                            <span className="detail-label">Account Name</span>
                            <span className="detail-value">{d.accountName}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">JazzCash Number</span>
                            <span className="detail-value detail-mono">{d.number}</span>
                          </div>
                          <p className="detail-instruction">
                            {jazzcashConfigured
                              ? "You'll be redirected to JazzCash to pay securely after placing the order."
                              : "Send the exact amount to the number above, then submit your transaction reference after placing the order."}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            <div className="checkout-summary">
              <div>
                <span>Subtotal</span>
                <span>{subtotalLabel}</span>
              </div>
              <div>
                <span>Delivery</span>
                <span>{deliveryFeeLabel}</span>
              </div>
              <div className="checkout-total">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            <button type="submit" className="btn btn-gold btn-block" disabled={submitting}>
              {submitting ? "Placing Order..." : submitText}
            </button>
            <button
              type="button"
              className="btn-back"
              onClick={() => setView("cart")}
            >
              &larr; Back to cart
            </button>
            <p className={`form-msg ${msg.type || ""}`}>{msg.text}</p>
          </form>
        )}

        {view === "done" && order && (
          <div className="cart-body order-done">
            <div className="order-done-mark">&#10003;</div>
            <h4 className="order-done-title">Order Received</h4>
            <p className="order-done-sub">Order {order.id} &mdash; {order.date}</p>

            <div className="order-done-items">
              {order.items.map((i) => (
                <div className="order-done-item" key={i.id}>
                  <span>
                    {i.name} <em>({i.size})</em> &times; {i.qty}
                  </span>
                  <span>{formatPrice(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="order-done-item">
                <span>Delivery</span>
                <span>{formatPrice(order.delivery_fee)}</span>
              </div>
              <div className="order-done-item order-done-total">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>

            {order.payment === "bank_transfer" && (
              <div className="bank-transfer-details">
                <h4>Bank Transfer to</h4>
                <div className="detail-row">
                  <span className="detail-label">Bank</span>
                  <span className="detail-value">{bank?.bank_name || "Allied Bank"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Account Title</span>
                  <span className="detail-value">{bank?.account_name || "Sidra Anum"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Account Number</span>
                  <span className="detail-value detail-mono">{bank?.account_number || "0010159652950014"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">IBAN</span>
                  <span className="detail-value detail-mono">{bank?.iban || "PK00ALLA000000100159652950014"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Amount</span>
                  <span className="detail-value detail-mono">{formatPrice(order.total)}</span>
                </div>
              </div>
            )}

            {order.payment === "jazzcash" && (
              <div className="jazzcash-details">
                <h4>JazzCash Payment</h4>
                {jazzcashConfigured ? (
                  <p className="detail-instruction">
                    Pay securely through the JazzCash gateway to complete your order.
                  </p>
                ) : (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">Account Name</span>
                      <span className="detail-value">{jazz?.wallet_name || "Iqra Anum"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">JazzCash Number</span>
                      <span className="detail-value detail-mono">{jazz?.wallet_number || "03222629284"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Amount</span>
                      <span className="detail-value detail-mono">{formatPrice(order.total)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {needsProofAfterOrder && !proofDone && (
              <div className="payment-proof-wrap">
                <button
                  type="button"
                  className="btn-back proof-toggle"
                  onClick={() => setProofOpen(!proofOpen)}
                >
                  {proofOpen ? "Hide" : "Submit Payment Proof"} &middot; Order ships after verification
                </button>

                {proofOpen && (
                  <div className="payment-proof-form">
                    {jazzcashConfigured && order.payment === "jazzcash" && (
                      <button
                        type="button"
                        className="btn btn-gold btn-block"
                        disabled={proofBusy}
                        onClick={payWithJazzCash}
                      >
                        {proofBusy ? "Redirecting..." : "Pay with JazzCash online"}
                      </button>
                    )}
                    {(!jazzcashConfigured || order.payment === "bank_transfer") && (
                      <>
                        <div className="field">
                          <label htmlFor="proofSender">Sender Name (optional)</label>
                          <input
                            type="text"
                            id="proofSender"
                            placeholder="Name on the transaction"
                            value={proof.sender_name}
                            onChange={(e) => setProof((p) => ({ ...p, sender_name: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="proofRef">Transaction Reference *</label>
                          <input
                            type="text"
                            id="proofRef"
                            placeholder="e.g. IBFT200315, FTC/PAY 123456"
                            value={proof.transaction_ref}
                            onChange={(e) => setProof((p) => ({ ...p, transaction_ref: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="proofNotes">Notes (optional)</label>
                          <input
                            type="text"
                            id="proofNotes"
                            placeholder="Anything to help us match your payment"
                            value={proof.notes}
                            onChange={(e) => setProof((p) => ({ ...p, notes: e.target.value }))}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-gold btn-block"
                          disabled={proofBusy}
                          onClick={submitProof}
                        >
                          {proofBusy ? "Submitting..." : "Submit Reference for Verification"}
                        </button>
                      </>
                    )}
                    <p className={`form-msg ${proofMsg.type || ""}`}>{proofMsg.text}</p>
                  </div>
                )}
              </div>
            )}

            {proofDone && (
              <p className="payment-disclosure proof-done-msg">
                Your payment reference has been submitted. Our team will verify it and then ship your
                order &mdash; you'll see the status update under <strong>My Orders</strong>.
              </p>
            )}

            {order.payment === "cod" && (
              <p className="payment-disclosure">
                Your order will be delivered to {order.customer_address}, {order.customer_city}.
                Please keep <strong>{formatPrice(order.total)} in cash</strong> ready for the rider
                &mdash; this is a cash-on-delivery order, so no online payment was taken.
              </p>
            )}

            <button
              className="btn btn-gold btn-block"
              onClick={() => {
                setView("cart");
                close();
              }}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </>
  );
}