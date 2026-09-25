import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Reveal from "./Reveal";
import { useShop } from "../store/ShopContext";
import { getPublicReviews, submitReview } from "../lib/api";
import { BRAND_NAME } from "../data/brand";

export default function Testimonials() {
  const { isCustomer, customerUser, catalog, showToast } = useShop();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ product_id: "", rating: 5, comment: "" });
  const [hoverRating, setHoverRating] = useState(0);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [busy, setBusy] = useState(false);

  const load = () => {
    getPublicReviews()
      .then((data) => setReviews(Array.isArray(data?.reviews) ? data.reviews : []))
      .catch((err) => setMsg({ text: err.message || "Could not load reviews.", type: "error" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const products = Array.isArray(catalog?.products) ? catalog.products : [];

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.comment.trim().length < 10) {
      setMsg({ text: "Please write a few words about the scent.", type: "error" });
      return;
    }
    setBusy(true);
    setMsg({ text: "", type: "" });
    try {
      const res = await submitReview({
        product_id: form.product_id,
        rating: form.rating,
        comment: form.comment.trim(),
      });
      setMsg({ text: res.note || "Thank you — your review is under moderation.", type: "success" });
      setForm({ product_id: "", rating: 5, comment: "" });
      showToast("Review submitted — pending approval");
    } catch (err) {
      setMsg({ text: err.message || "Could not submit your review.", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const renderStars = (rating, interactive = false) => {
    const shown = interactive ? (hoverRating || form.rating) : rating;
    return (
      <div
        className="stars stars-row"
        onMouseLeave={() => interactive && setHoverRating(0)}
        role={interactive ? "radiogroup" : undefined}
        aria-label={interactive ? "Select a rating" : `${rating} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((n) =>
          interactive ? (
            <button
              key={n}
              type="button"
              className={`star ${n <= shown ? "on" : ""}`}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setForm((f) => ({ ...f, rating: n }))}
              onMouseEnter={() => setHoverRating(n)}
            >
              &#9733;
            </button>
          ) : (
            <span key={n} className={`star ${n <= shown ? "on" : ""}`}>
              &#9733;
            </span>
          )
        )}
      </div>
    );
  };

  const initials = (name) => {
    const clean = String(name || "U").trim();
    return clean.charAt(0).toUpperCase();
  };

  return (
    <section className="testimonials section" id="testimonials">
      <div className="container">
        <div className="section-head center">
          <Reveal as="span" className="eyebrow">Reviews</Reveal>
          <Reveal as="h2" className="section-title" delay="1">
            What Customers <em>Say</em>
          </Reveal>
          <Reveal as="p" className="section-lead" delay="2">
            Honest words from people who have worn {BRAND_NAME}. Share your own
            experience below.
          </Reveal>
        </div>

        <Reveal className="review-layout">
          <div className="review-feed">
            {loading ? (
              <div className="review-empty">
                <p>Loading reviews...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="review-empty">
                <span className="review-empty-mark">&#9733;</span>
                <p>
                  No reviews yet &mdash; be the first to share how your scent
                  wears on you.
                </p>
              </div>
            ) : (
              reviews.map((r) => (
                <article className="review-card" key={r.id}>
                  <div className="review-head">
                    <div className="avatar avatar--review">{initials(r.name)}</div>
                    <div>
                      <span className="author-name">{r.name}</span>
                      {r.product_name && <span className="author-role">purchased {r.product_name}</span>}
                      <span className="author-role">
                        {new Date(`${r.created_at}Z`).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  {renderStars(r.rating)}
                  <p className="review-comment">{r.comment}</p>
                </article>
              ))
            )}
          </div>

          <div className="review-form-wrap">
            <h3 className="review-form-title">Write a Review</h3>
            <p className="review-form-note">
              Tell others about the scent, the longevity and the experience.
            </p>

            {!isCustomer ? (
              <div className="review-form-login">
                <p>
                  Please sign in to your account to write a review &mdash; this
                  keeps reviews real and verifiable.
                </p>
                <Link to="/account" className="btn btn-gold btn-block">
                  Sign In / My Account
                </Link>
              </div>
            ) : (
              <form className="review-form" noValidate onSubmit={onSubmit}>
                <div className="field">
                  <label htmlFor="reviewProduct">Which scent did you try? (optional)</label>
                  <select
                    id="reviewProduct"
                    value={form.product_id}
                    onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
                  >
                    <option value="">General feedback</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.size ? `${p.name} (${p.size})` : p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Rating</label>
                  {renderStars(form.rating, true)}
                </div>
                <div className="field">
                  <label htmlFor="reviewComment">Your Review</label>
                  <textarea
                    id="reviewComment"
                    name="comment"
                    rows="4"
                    placeholder="How does the fragrance wear on you?"
                    required
                    value={form.comment}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, comment: e.target.value }));
                      setMsg({ text: "", type: "" });
                    }}
                  ></textarea>
                </div>
                <button type="submit" className="btn btn-gold btn-block" disabled={busy}>
                  {busy ? "Submitting..." : "Submit Review"}
                </button>
                <p className={`form-msg ${msg.type || ""}`}>{msg.text}</p>
              </form>
            )}

            <p className="review-disclosure">
              Signed-in as {customerUser?.email || "a customer"}. Every review is
              reviewed by the owner before it is published here.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}