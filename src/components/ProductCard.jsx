import { useEffect, useRef, useState } from "react";
import { formatPrice } from "../data/products";
import { useShop } from "../store/ShopContext";
import Reveal from "./Reveal";

export default function ProductCard({ product, onQuickView }) {
  const { addToCart, showToast } = useShop();
  const [added, setAdded] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleAdd = () => {
    addToCart(product.id);
    showToast(`${product.name} added to your cart`);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Reveal as="article" className="product-card">
      <div className={`product-media pm--${product.category || "noir"}`}>
        <button
          className="product-media-link"
          onClick={() => onQuickView(product)}
          aria-label={`View ${product.name} details`}
        >
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="product-img"
          />
        </button>
        {product.badge && <span className="product-badge">{product.badge}</span>}
      </div>

      <div className="product-info">
        <span className="product-family">{product.family || "Signature"}</span>
        <button
          className="product-name product-name-btn"
          onClick={() => onQuickView(product)}
        >
          {product.name}
        </button>
        <p className="product-notes">{product.cardText || product.description}</p>

        <div className="product-foot">
          <div className="product-pricing">
            {product.originalPrice && (
              <span className="price-old">{formatPrice(product.originalPrice)}</span>
            )}
            <span className="product-price product-price--sale">
              {formatPrice(product.salePrice)}
            </span>
          </div>
          <button
            className={`add-btn ${added ? "added" : ""}`}
            onClick={handleAdd}
            aria-label={`Add ${product.name} to cart`}
          >
            {added ? "\u2713 Added" : "Add to Cart"}
          </button>
        </div>
      </div>
    </Reveal>
  );
}