import { testers } from "../data/products";
import Reveal from "./Reveal";
import ProductCard from "./ProductCard";

export default function Testers({ onQuickView }) {
  return (
    <section className="testers section section--dark" id="testers">
      <div className="container">
        <div className="section-head center">
          <Reveal as="span" className="eyebrow">Try Before You Buy</Reveal>
          <Reveal as="h2" className="section-title" delay="1">
            Perfume <em>Testers</em>
          </Reveal>
          <Reveal as="p" className="section-lead" delay="2">
            Experience a fragrance on your skin before committing to the full
            bottle. Every tester holds the same beautiful juice, simply
            presented &mdash; the perfect way to discover your signature.
          </Reveal>
        </div>

        <div className="product-grid tester-grid" id="testerGrid">
          {testers.map((t) => (
            <ProductCard key={t.id} product={t} onQuickView={onQuickView} />
          ))}
        </div>
      </div>
    </section>
  );
}