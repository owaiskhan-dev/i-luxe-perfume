import { useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useShop } from "../store/ShopContext";
import { goToSection } from "../utils/scroll";
import { NAV_LINKS } from "./Header";

export default function MobileMenu() {
  const { mobileMenuOpen, setMobileMenuOpen, isCustomer, customerUser } = useShop();
  const location = useLocation();
  const navigate = useNavigate();

  const getHref = () => "#";

  const go = (e, id) => {
    e.preventDefault();
    goToSection({ pathname: location.pathname, navigate }, id);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <div className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`} id="mobileMenu">
      <Link to="/account" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>
        {isCustomer ? `My Account${customerUser?.full_name ? ` (${customerUser.full_name.split(" ")[0]})` : ""}` : "Sign In / My Account"}
      </Link>
      {NAV_LINKS.map(({ id, label }) => (
        <a key={id} href={getHref()} className="mobile-link" onClick={(e) => go(e, id)}>
          {label}
        </a>
      ))}
    </div>
  );
}