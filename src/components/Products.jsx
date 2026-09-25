import { useState } from "react";
import { filters, perfumes } from "../data/products";
import Reveal from "./Reveal";
import ProductCard from "./ProductCard";

export default function Products({ onQuickView }) {
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = perfumes.filter(
    (p) => activeFilter === "all" || p.category === activeFilter
  );

  return (
    <section className="products section" id="products">
      <div className="container">
        <div className="section-head center">
          <Reveal as="span" className="eyebrow">Shop I. Luxe</Reveal>
          <Reveal as="h2" className="section-title" delay="1">
            Signature <em>Scents</em>
          </Reveal>
          <Reveal as="p" className="section-lead" delay="2">
            Our four signature fragrances, available in their signature size, a
            30ml size, and as testers to try first.
          </Reveal>
        </div>

        <Reveal className="filter-bar">
          {filters.map((f) => (
            <button
              key={f.key}
              className={`filter-btn ${activeFilter === f.key ? "active" : ""}`}
              data-filter={f.key}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </Reveal>

        <div className="product-grid" id="productGrid">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      </div>
    </section>
  );
}