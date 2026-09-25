import { useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.jpeg";
import { goToSection } from "../utils/scroll";
import { BRAND_NAME, OWNER_NAME, CONTACT_EMAIL } from "../data/brand";

const EXPLORE = [
  { id: "home", label: "Home" },
  { id: "about", label: "Our Brand" },
  { id: "products", label: "Signature Scents" },
  { id: "testers", label: "Perfume Testers" },
];

const SUPPORT = [
  { id: "contact", label: "Contact Us" },
  { id: "newsletterForm", label: "Newsletter" },
];

const LEGAL = ["Privacy Policy", "Terms of Service"];

export default function Footer() {
  const location = useLocation();
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const getHref = () => "#";

  const handleClick = (e, id) => {
    e.preventDefault();
    goToSection({ pathname: location.pathname, navigate }, id);
  };

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <a
            href={getHref()}
            className="logo footer-logo"
            onClick={(e) => handleClick(e, "home")}
          >
            <img src={logo} alt="" className="logo-img logo-img--footer" width="52" height="52" loading="lazy" />
            <span className="logo-word">
              I. Luxe <span className="logo-accent">Perfume</span>
            </span>
          </a>
          <p>
            Signature fragrances, 30ml sizes and perfume testers &mdash;
            delivered across Karachi with cash on delivery.
          </p>
        </div>

        <div className="footer-col">
          <h4>Explore</h4>
          {EXPLORE.map((l) => (
            <a key={l.label} href={getHref()} onClick={(e) => handleClick(e, l.id)}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="footer-col">
          <h4>Support</h4>
          {SUPPORT.map((l, i) => (
            <a key={`${l.label}-${i}`} href={getHref()} onClick={(e) => handleClick(e, l.id)}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="footer-col">
          <h4>Legal</h4>
          {LEGAL.map((label) => (
            <a key={label} href="#">{label}</a>
          ))}
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <p>
            &copy; {year} {BRAND_NAME}. / Owner: {OWNER_NAME} / {CONTACT_EMAIL}
          </p>
        </div>
      </div>
    </footer>
  );
}