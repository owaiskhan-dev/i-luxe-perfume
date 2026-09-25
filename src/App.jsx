import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ShopProvider } from "./store/ShopContext";
import AnnouncementBar from "./components/AnnouncementBar";
import Preloader from "./components/Preloader";
import Header from "./components/Header";
import MobileMenu from "./components/MobileMenu";
import CartDrawer from "./components/CartDrawer";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import About from "./components/About";
import Products from "./components/Products";
import Testers from "./components/Testers";
import GiftSection from "./components/GiftSection";
import Banner from "./components/Banner";
import ComingSoonSection from "./components/ComingSoonSection";
import Testimonials from "./components/Testimonials";
import Newsletter from "./components/Newsletter";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import Toast from "./components/Toast";
import ProductDetails from "./components/ProductDetails";
import AdminDashboard from "./components/AdminDashboard";
import AdminAuth from "./components/AdminAuth";
import AccountPage from "./components/AccountPage";
import { adminLogout } from "./lib/api";

function HomePage({ setActiveProduct }) {
  return (
    <>
      <Hero />
      <Marquee />
      <About />
      <Products onQuickView={setActiveProduct} />
      <Testers onQuickView={setActiveProduct} />
      <GiftSection />
      <Banner />
      <ComingSoonSection />
      <Testimonials />
      <Newsletter />
      <Contact />
    </>
  );
}

function AdminRoute({ isAuthenticated, onLogout, setAuthenticated }) {
  return isAuthenticated ? (
    <AdminDashboard onLogout={onLogout} isAuthenticated={isAuthenticated} />
  ) : (
    <AdminAuth onSuccess={setAuthenticated} onClose={() => window.location.href = "/"} />
  );
}

function Shell() {
  const [preloaderVisible, setPreloaderVisible] = useState(true);
  const [activeProduct, setActiveProduct] = useState(null);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  const handleLogoClick = (e) => {
    e.preventDefault();
    window.location.href = "/admin";
  };

  const handleAdminLogout = () => {
    adminLogout();
    setAdminAuthenticated(false);
  };

  const handleAuthSuccess = () => {
    setAdminAuthenticated(true);
  };

  return (
    <>
      {preloaderVisible && <Preloader onDone={() => setPreloaderVisible(false)} />}
      <AnnouncementBar />
      <Header onLogoClick={handleLogoClick} />
      <MobileMenu />
      <CartDrawer />

      <main>
        <Routes>
          <Route path="/" element={<HomePage setActiveProduct={setActiveProduct} />} />
          <Route
            path="/admin"
            element={
              <AdminRoute
                isAuthenticated={adminAuthenticated}
                onLogout={handleAdminLogout}
                setAuthenticated={handleAuthSuccess}
              />
            }
          />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </main>

      <Footer />
      <ProductDetails product={activeProduct} onClose={() => setActiveProduct(null)} />
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <ShopProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ShopProvider>
  );
}