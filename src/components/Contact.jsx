import { useState } from "react";
import Reveal from "./Reveal";
import { sendContactMessage } from "../lib/api";
import { BRAND_NAME, OWNER_NAME, CONTACT_EMAIL } from "../data/brand";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[a-zA-Z .'-]+$/;

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [invalid, setInvalid] = useState({});
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (invalid[field]) setInvalid((i) => ({ ...i, [field]: false }));
    setMsg({ text: "", type: "" });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (form.name.trim().length < 2 || !NAME_RE.test(form.name.trim())) errors.name = true;
    if (!EMAIL_RE.test(form.email.trim())) errors.email = true;
    if (form.message.trim().length < 10) errors.message = true;

    if (Object.keys(errors).length > 0) {
      setInvalid(errors);
      setMsg({ text: "Please complete all fields correctly.", type: "error" });
      return;
    }

    setBusy(true);
    setMsg({ text: "", type: "" });
    try {
      await sendContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setForm({ name: "", email: "", subject: "", message: "" });
      setMsg({
        text: "Message sent — thank you. We aim to reply within 48 hours.",
        type: "success",
      });
    } catch (err) {
      setMsg({ text: err.message || "Could not send your message. Please try again.", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="contact section" id="contact">
      <div className="container contact-grid">
        <div className="contact-info">
          <Reveal as="span" className="eyebrow">Get in Touch</Reveal>
          <Reveal as="h2" className="section-title" delay="1">
            We&rsquo;d Love to <em>Hear From You</em>
          </Reveal>
          <Reveal as="p" className="body-copy" delay="1">
            Questions about a fragrance, an order, or gifting? Send a message
            and we&rsquo;ll get back to you at our business email.
          </Reveal>
          <Reveal as="ul" className="contact-list" delay="2">
            <li>
              <strong>Brand</strong> {BRAND_NAME}
            </li>
            <li>
              <strong>Owner</strong> {OWNER_NAME}
            </li>
            <li>
              <strong>Email</strong>
              <a href={`mailto:${CONTACT_EMAIL}`} className="contact-mail">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <strong>Response</strong> We aim to reply within 48 hours.
            </li>
          </Reveal>
        </div>

        <Reveal className="contact-form">
          <form noValidate onSubmit={onSubmit}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Your name"
                  required
                  className={invalid.name ? "invalid" : ""}
                  value={form.name}
                  onChange={set("name")}
                />
              </div>
              <div className="field">
                <label htmlFor="contactEmail">Email</label>
                <input
                  type="email"
                  id="contactEmail"
                  name="email"
                  placeholder="you@email.com"
                  required
                  className={invalid.email ? "invalid" : ""}
                  value={form.email}
                  onChange={set("email")}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="contactSubject">Subject (optional)</label>
              <input
                type="text"
                id="contactSubject"
                name="subject"
                placeholder="How can we help?"
                value={form.subject}
                onChange={set("subject")}
              />
            </div>

            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                rows="5"
                placeholder="How can we help?"
                required
                className={invalid.message ? "invalid" : ""}
                value={form.message}
                onChange={set("message")}
              ></textarea>
            </div>

            <button type="submit" className="btn btn-gold" disabled={busy}>
              {busy ? "Sending..." : "Send Message"}
            </button>
            <p className={`form-msg ${msg.type || ""}`}>{msg.text}</p>
            <p className="contact-disclosure">
              Your message is sent securely to {CONTACT_EMAIL} — we reply
              directly from our business inbox.
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}