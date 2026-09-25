import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import logo from "../assets/logo.jpeg";
import { useShop } from "../store/ShopContext";
import { handleAnchorClick, goToSection } from "../utils/scroll";
import { BRAND_NAME } from "../data/brand";

export const NAV_LINKS = [
  { id: "home", label: "Home" },
  { id: "about", label: "Brand" },
  { id: "products", label: "Signature Scents" },
  { id: "testimonials", label: "Reviews" },
  { id: "contact", label: "Contact" },
];

export default function Header({ onLogoClick }) {
  const { cartCount, setCartOpen, mobileMenuOpen, setMobileMenuOpen, isCustomer, customerUser } = useShop();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = location.pathname === "/admin";

  const getHref = () => "#";

  const handleNavClick = (e, id) => {
    e.preventDefault();
    goToSection({ pathname: location.pathname, navigate }, id);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    NAV_LINKS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header className={`header ${scrolled ? "scrolled" : ""}`} id="header">
      <div className="container nav-wrap">
        <a
          href={isAdmin ? "/#home" : "#home"}
          className="logo"
          onClick={(e) => {
            if (onLogoClick) {
              onLogoClick(e);
            } else {
              handleAnchorClick(e, "home");
            }
          }}
        >
          <img src={logo} alt={BRAND_NAME} className="logo-img" width="44" height="44" />
          <span className="logo-word">
            I. Luxe <span className="logo-accent">Perfume</span>
          </span>
        </a>

        <nav className="nav" aria-label="Primary">
          {NAV_LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={getHref()}
              className={`nav-link ${active === id ? "active" : ""}`}
              onClick={(e) => handleNavClick(e, id)}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <Link to="/account" className={`account-btn ${isCustomer ? "authed" : ""}`} aria-label="My account">
            {isCustomer ? (
              <span className="account-avatar">
                {(customerUser?.full_name || customerUser?.email || "U").charAt(0).toUpperCase()}
              </span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </Link>
          <button
            className="cart-btn"
            aria-label="Shopping cart"
            onClick={() => setCartOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className={`cart-count ${cartCount > 0 ? "show" : ""}`}>
              {cartCount}
            </span>
          </button>
          <button
            className={`burger ${mobileMenuOpen ? "open" : ""}`}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
}