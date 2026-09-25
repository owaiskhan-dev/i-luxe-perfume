export const scrollToId = (id) => {
  if (!id) return;
  if (id === "home") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.querySelector(".header");
  const offset = (header ? header.offsetHeight : 80) + 12;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
};

export const handleAnchorClick = (e, id) => {
  if (e) e.preventDefault();
  scrollToId(id);
};

// Navigate to a home section from any route. On / the section exists and we
// scroll directly; on /account or /admin we route home first, then scroll once
// the home sections have rendered.
export const goToSection = ({ pathname, navigate }, id) => {
  if (!id) return;
  if (pathname === "/") {
    scrollToId(id);
    return;
  }
  navigate("/");
  setTimeout(() => scrollToId(id), 80);
};