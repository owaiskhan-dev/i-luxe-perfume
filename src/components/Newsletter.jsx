import { useState } from "react";
import Reveal from "./Reveal";
import { subscribeNewsletter } from "../lib/api";
import { BRAND_NAME } from "../data/brand";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setSaved(false);
      setMsg({ text: "Please enter a valid email address.", type: "error" });
      return;
    }

    setBusy(true);
    setMsg({ text: "", type: "" });
    try {
      await subscribeNewsletter(email.trim());
      setSaved(true);
      setEmail("");
      setMsg({
        text: "Thank you — you're subscribed. We'll let you know as soon as there's news.",
        type: "success",
      });
    } catch (err) {
      setSaved(false);
      setMsg({ text: err.message || "Could not subscribe right now. Please try again.", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="newsletter" id="newsletter">
      <div className="container">
        <Reveal className="newsletter-box">
          <span className="eyebrow">Join the Maison</span>
          <h2 className="section-title">
            Be First to <em>Know</em>
          </h2>
          <p className="section-lead">
            News from {BRAND_NAME} &mdash; new releases, maison stories and
            private previews, delivered to your inbox.
          </p>
          <form
            className="newsletter-form"
            id="newsletterForm"
            noValidate
            onSubmit={onSubmit}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setMsg({ text: "", type: "" });
              }}
              placeholder="Your email address"
              aria-label="Email address"
              required
            />
            <button type="submit" className="btn btn-gold" disabled={busy}>
              {busy ? "Subscribing..." : saved ? "Subscribed" : "Subscribe"}
            </button>
          </form>
          <p className={`form-msg ${msg.type || ""}`}>{msg.text}</p>
        </Reveal>
      </div>
    </section>
  );
}