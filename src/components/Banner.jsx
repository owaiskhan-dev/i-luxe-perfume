import { handleAnchorClick } from "../utils/scroll";
import Reveal from "./Reveal";
import { BRAND_NAME, DELIVERY_NOTE } from "../data/brand";

export default function Banner() {
  return (
    <section className="banner">
      <div className="banner-bg" aria-hidden="true"></div>
      <div className="container banner-content">
        <Reveal as="span" className="eyebrow">The {BRAND_NAME} Ritual</Reveal>
        <Reveal as="h2" className="banner-title" delay="1">
          Write Your Signature <em>in Scent</em>
        </Reveal>
        <Reveal as="p" delay="2">
          Find the fragrance that feels unmistakably yours. {DELIVERY_NOTE} with
          cash on delivery.
        </Reveal>
        <Reveal delay="3">
          <a
            href="#products"
            className="btn btn-gold btn-gold--dark"
            onClick={(e) => handleAnchorClick(e, "products")}
          >
            Explore the Scents
          </a>
        </Reveal>
      </div>
    </section>
  );
}