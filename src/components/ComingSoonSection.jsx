import centerImg from "../assets/center-coming-soon.jpeg";
import Reveal from "./Reveal";

export default function ComingSoonSection() {
  return (
    <section className="coming-soon section section--dark" id="coming-soon">
      <div className="container">
        <div className="coming-soon-card">
          <Reveal className="coming-soon-media">
            <img
              src={centerImg}
              alt="I. Luxe Perfume preview box — coming soon"
              className="coming-soon-img"
              loading="lazy"
            />
          </Reveal>

          <Reveal as="span" className="eyebrow">Coming Soon</Reveal>
          <Reveal as="h2" className="coming-soon-title" delay="1">
            A New <em>Signature</em> in the Making
          </Reveal>
          <Reveal as="p" className="coming-soon-lead" delay="2">
            An exclusive new fragrance is being composed in our atelier and will
            be revealed very soon. Keep an eye on this space.
          </Reveal>
        </div>
      </div>
    </section>
  );
}