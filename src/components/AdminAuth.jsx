import { useState, useEffect } from "react";
import { adminLogin } from "../lib/api";
import { useShop } from "../store/ShopContext";
import Reveal from "./Reveal";
import { useNavigate } from "react-router-dom";

export default function AdminAuth({ onSuccess, onClose }) {
  const { showToast } = useShop();
  const navigate = useNavigate();
  const [step, setStep] = useState("secret");
  const [secretCode, setSecretCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryIn, setRetryIn] = useState(0);

  const handleSecretSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStep("password");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await adminLogin({
        code: secretCode,
        password: password.trim(),
      });
    } catch (err) {
      setLoading(false);
      if (err.status === 503) {
        setError(err.message || "Admin credentials are not configured on the server.");
      } else if (err.status === 429) {
        const secs = err.data?.retry_in || 60;
        setRetryIn(secs);
        setError(`Too many attempts. Retry in ${secs}s.`);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Invalid code or password. Access denied.");
      }
      setPassword("");
      return;
    }

    onSuccess();
    navigate("/admin", { replace: true });
    setLoading(false);
  };

  const handleBack = () => {
    if (step === "password") {
      setStep("secret");
      setPassword("");
      setError("");
      setRetryIn(0);
    } else {
      onClose?.();
      navigate("/", { replace: true });
    }
  };

  return (
    <section className="admin-section section" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="admin-auth-page" style={{ width: "100%", maxWidth: "420px", padding: "24px" }}>
        <div className="admin-auth-modal" style={{ background: "var(--cream)", borderRadius: "12px", padding: "48px 40px", boxShadow: "0 40px 80px rgba(10, 19, 48, 0.4)", border: "1px solid var(--line)" }}>
          <div className="admin-auth-header" style={{ textAlign: "center", marginBottom: "32px" }}>
            <svg className="admin-auth-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--gold-2)", marginBottom: "16px" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: "28px", fontWeight: 500, color: "var(--noir)", marginBottom: "8px" }}>Admin Access</h2>
            <p className="admin-auth-subtitle" style={{ color: "var(--muted)", fontSize: "14px" }}>Secure verification required</p>
          </div>

          {step === "secret" && (
            <form className="admin-auth-form" onSubmit={handleSecretSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="admin-auth-field" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label htmlFor="secretCode" style={{ fontSize: "13px", fontWeight: 500, color: "var(--noir)", letterSpacing: "0.5px" }}>Admin Secret Code</label>
                <input
                  type="password"
                  id="secretCode"
                  autoComplete="off"
                  placeholder="Enter secret code"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  required
                  autoFocus
                  style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--cream)", color: "var(--noir)", fontSize: "15px" }}
                />
              </div>
              {error && <p className="admin-auth-error" style={{ color: "#c00", fontSize: "13px" }}>{error}</p>}
              <div className="admin-auth-actions" style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="button" className="btn btn-outline" onClick={handleBack} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Verifying..." : "Continue"}
                </button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form className="admin-auth-form" onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="admin-auth-field" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label htmlFor="adminPassword" style={{ fontSize: "13px", fontWeight: 500, color: "var(--noir)", letterSpacing: "0.5px" }}>Admin Password</label>
                <input
                  type="password"
                  id="adminPassword"
                  autoComplete="current-password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--cream)", color: "var(--noir)", fontSize: "15px" }}
                />
              </div>
              {error && <p className="admin-auth-error" style={{ color: "#c00", fontSize: "13px" }}>{error}</p>}
              <div className="admin-auth-actions" style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="button" className="btn btn-outline" onClick={handleBack} style={{ flex: 1 }}>Back</button>
                <button type="submit" className="btn btn-gold" disabled={loading} style={{ flex: 1 }}>
                  {loading ? "Signing In..." : "Access Dashboard"}
                </button>
              </div>
            </form>
          )}

          <p className="admin-auth-hint" style={{ textAlign: "center", marginTop: "24px", fontSize: "12px", color: "var(--muted)" }}>Press Escape to go back</p>
        </div>
      </div>
    </section>
  );
}