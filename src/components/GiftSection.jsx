import giftImg from "../assets/gift.jpeg";
import { handleAnchorClick } from "../utils/scroll";
import Reveal from "./Reveal";

export default function GiftSection() {
  return (
    <section className="gift section" id="gift">
      <div className="container gift-grid">
        <Reveal className="gift-media">
          <img
            src={giftImg}
            alt="I. Luxe Perfume presented as a premium gift"
            className="gift-img"
            loading="lazy"
          />
        </Reveal>

        <div className="gift-text">
          <Reveal as="span" className="eyebrow">The Art of Giving</Reveal>
          <Reveal as="h2" className="section-title" delay="1">
            A Gift That <em>Stays</em> with Them
          </Reveal>
          <Reveal as="p" className="section-lead" delay="2">
            Our fragrances are composed to be given as much as worn. Each bottle
            arrives gift-wrapped and ready to leave an impression &mdash; for
            anniversaries, celebrations, or simply because.
          </Reveal>
          <Reveal as="ul" className="gift-points" delay="2">
            <li>Signature gift wrapping on every order</li>
            <li>Handwritten notes, on request</li>
            <li>30ml &amp; tester sizes for thoughtful parcels</li>
          </Reveal>
          <Reveal delay="3">
            <a
              href="#products"
              className="link-arrow"
              onClick={(e) => handleAnchorClick(e, "products")}
            >
              Choose a gift &rarr;
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}