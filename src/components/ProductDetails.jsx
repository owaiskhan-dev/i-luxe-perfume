import { useEffect, useState } from "react";
import { formatPrice } from "../data/products";
import { useShop } from "../store/ShopContext";

export default function ProductDetails({ product, onClose }) {
  const { addToCart, showToast } = useShop();
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
  }, [product]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!product) return null;

  const images = [product.image, ...(product.additionalImages || [])];

  const handleAdd = () => {
    addToCart(product.id);
    showToast(`${product.name} added to your cart`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} details`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close details" onClick={onClose}>
          &times;
        </button>

        <div className="modal-grid">
          <div className="modal-gallery">
            <div className="modal-main-img">
              <img src={images[imgIndex]} alt={product.name} />
            </div>
            {images.length > 1 && (
              <div className="modal-thumbs">
                {images.map((img, i) => (
                  <button
                    key={img}
                    className={`modal-thumb ${i === imgIndex ? "active" : ""}`}
                    onClick={() => setImgIndex(i)}
                    aria-label={i === 0 ? product.name : `${product.name} \u2014 30ml`}
                  >
                    <img src={img} alt={i === 0 ? product.name : `${product.name} 30ml`} />
                  </button>
                ))}
              </div>
            )}
            {product.thirtyMlImage && (
              <p className="modal-size-note">Also available in a 30ml size.</p>
            )}
          </div>

          <div className="modal-info">
            <span className="product-family">{product.family || "Signature"}</span>
            <h3 className="modal-title">{product.name}</h3>

            <div className="modal-price">
              {product.originalPrice && (
                <span className="price-old">{formatPrice(product.originalPrice)}</span>
              )}
              <span className="product-price product-price--sale">
                {formatPrice(product.salePrice)}
              </span>
            </div>

            {product.size && <p className="modal-size">Size: {product.size}</p>}

            <p className="modal-desc">{product.description}</p>

            <button className="btn btn-gold btn-block" onClick={handleAdd}>
              Add to Cart &mdash; {formatPrice(product.salePrice)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}