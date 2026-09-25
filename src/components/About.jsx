import logo from "../assets/logo.jpeg";
import controlleImg from "../assets/controlle.jpeg";
import { handleAnchorClick } from "../utils/scroll";
import Reveal from "./Reveal";
import { BRAND_NAME } from "../data/brand";

export default function About() {
  return (
    <section className="about section" id="about">
      <div className="container about-grid">
        <div className="about-media">
          <Reveal className="about-img main-img" aria-hidden="true">
            <img src={logo} alt="" className="about-img-fill about-img-fill--logo" loading="lazy" />
            <span className="img-tag">{BRAND_NAME} &mdash; I. Luxe Perfume</span>
          </Reveal>
          <Reveal className="about-img sub-img" delay="1" aria-hidden="true">
            <img src={controlleImg} alt="" className="about-img-fill" loading="lazy" />
            <span className="img-tag img-tag--dark">Controlle &mdash; Signature Scent</span>
          </Reveal>
        </div>

        <div className="about-text">
          <Reveal as="span" className="eyebrow">Our Story</Reveal>
          <Reveal as="h2" className="section-title" delay="1">
            A House Built on <em>Artistry</em>
          </Reveal>
          <Reveal as="p" className="section-lead" delay="1">
            {BRAND_NAME} is a fragrance house built on a simple belief:
            fragrance is one of the most personal forms of self-expression.
          </Reveal>
          <Reveal as="p" className="body-copy" delay="2">
            Every signature &mdash; Controlle, Falcon One, Masarai and Meadows &mdash;
            is composed to be worn, given and remembered. Each is available in
            its signature presentation, a 30ml size for everyday ease, and as a
            tester so you can discover it on your skin before you commit.
          </Reveal>
          <Reveal as="ul" className="about-points" delay="2">
            <li>Four signature fragrances in the maison&rsquo;s range</li>
            <li>30ml sizes and perfume testers in every scent</li>
            <li>Cash on delivery across Karachi</li>
          </Reveal>
          <Reveal delay="3">
            <a
              href="#products"
              className="link-arrow"
              onClick={(e) => handleAnchorClick(e, "products")}
            >
              Discover the fragrances &rarr;
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}