import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserById, insertReview, listReviews, reviewExistsForUser, getReview, updateReviewStatus } from "../db.js";
import { byId } from "../catalog.js";
import { cleanString, ValidationError } from "../lib/validate.js";

const router = Router();

// Public feed of approved reviews only — the moving testimonials section.
router.get("/", (req, res, next) => {
  try {
    const productId = String(req.query.product_id || "").slice(0, 60);
    const reviews = listReviews({ status: "approved", productId, limit: Math.min(Number(req.query.limit) || 100, 200) });
    res.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product_name,
        name: r.name,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
      })),
    });
  } catch (e) { next(e); }
});

// Authenticated customers only. Name/email are sourced from the server-side
// user record (never client-supplied), so identity cannot be impersonated.
// Every new review starts as pending and appears publicly only after the
// owner approves it in the admin dashboard.
router.post("/", requireAuth, (req, res, next) => {
  try {
    const user = getUserById(req.user.sub);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ValidationError("Rating must be between 1 and 5 stars");
    }
    const comment = cleanString(req.body?.comment, 1000);
    if (comment.length < 10) throw new ValidationError("Please write at least a few words about the scent");

    const productId = cleanString(req.body?.product_id, 60);
    let productName = "";
    if (productId) {
      const p = byId(productId);
      if (!p) throw new ValidationError("Unknown product selected");
      productName = p.size ? `${p.name} (${p.size})` : p.name;
    }

    if (reviewExistsForUser(user.id, productId)) {
      throw new ValidationError("You have already submitted a review and it is pending or published");
    }

    const recent = listReviews({ status: "all", limit: 5 }).find(
      (r) => r.user_id === user.id
    );
    if (recent) {
      const ageSec = (Date.now() - new Date(recent.created_at + "Z").getTime()) / 1000;
      if (ageSec < 30) throw new ValidationError("Please wait a moment before submitting again");
    }

    const review = insertReview({
      user_id: user.id,
      product_id: productId,
      product_name: productName,
      name: user.full_name || user.email,
      email: user.email,
      rating,
      comment,
    });

    res.status(201).json({ review, note: "Thank you! Your review is under moderation and will appear once approved." });
  } catch (e) { next(e); }
});

export default router;