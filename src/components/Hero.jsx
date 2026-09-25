import { useEffect, useState } from "react";
import bg1 from "../assets/background-one.jpeg";
import bg2 from "../assets/background-two.jpeg";
import bg3 from "../assets/background-three.jpeg";
import bg4 from "../assets/background-four.jpeg";
import bg5 from "../assets/background-five.jpeg";
import bg6 from "../assets/background-six.jpeg";
import bg7 from "../assets/background-seven.jpeg";
import bg8 from "../assets/background-eight-and-luxe-reverie-30ml.jpeg";
import logo from "../assets/logo.jpeg";
import logoAnimation from "../assets/logo-animation.mp4";
import { handleAnchorClick } from "../utils/scroll";
import Reveal from "./Reveal";
import { BRAND_NAME } from "../data/brand";

const BACKGROUNDS = [bg1, bg2, bg3, bg4, bg5, bg6, bg7, bg8];

const HOLD_MS = 2000;
const FADE_MS = 1500;
const STEP_MS = HOLD_MS + FADE_MS;

export default function Hero() {
  const [videoFailed, setVideoFailed] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    BACKGROUNDS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(
      () => setActive((a) => (a + 1) % BACKGROUNDS.length),
      STEP_MS
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="hero" id="home">
      <div className="hero-slideshow" aria-hidden="true">
        {BACKGROUNDS.map((src, i) => (
          <div
            key={src}
            className={`hero-slide ${i === active ? "active" : ""}`}
            style={{ backgroundImage: `url(${src})` }}
          ></div>
        ))}
        <div className="hero-scrim"></div>
      </div>

      <div className="container hero-content">
        <Reveal as="span" className="hero-eyebrow">
          I. Luxe Perfume &mdash; {BRAND_NAME}
        </Reveal>
        <Reveal as="h1" className="hero-title" delay="1">
          The Essence of <em>Timeless Luxury</em>
        </Reveal>
        <Reveal as="p" className="hero-desc" delay="2">
          {BRAND_NAME} crafts signature fragrances that linger like a memory.
          Each bottle carries a story &mdash; made to be worn, given and
          remembered.
        </Reveal>
        <Reveal as="div" className="hero-actions" delay="3">
          <a
            href="#products"
            className="btn btn-gold"
            onClick={(e) => handleAnchorClick(e, "products")}
          >
            Discover Signature Scents
          </a>
          <a
            href="#testers"
            className="btn btn-outline"
            onClick={(e) => handleAnchorClick(e, "testers")}
          >
            Try the Testers
          </a>
        </Reveal>
        <Reveal as="div" className="hero-stats" delay="3">
          <div className="stat">
            <span className="stat-num">4</span>
            <span className="stat-label">Signature Scents</span>
          </div>
          <div className="stat">
            <span className="stat-num">5</span>
            <span className="stat-label">Testers to Discover</span>
          </div>
          <div className="stat">
            <span className="stat-num">300</span>
            <span className="stat-label">PKR Karachi Delivery</span>
          </div>
        </Reveal>
      </div>

      <Reveal className="hero-media" delay="2">
        <div className="hero-media-frame">
          {videoFailed ? (
            <img src={logo} alt={BRAND_NAME} className="hero-media-img" />
          ) : (
            <video
              src={logoAnimation}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              poster={logo}
              onError={() => setVideoFailed(true)}
              aria-hidden="true"
            />
          )}
        </div>
        <span className="hero-media-tag">The Maison &mdash; {BRAND_NAME}</span>
      </Reveal>
    </section>
  );
}