import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { byId, formatPrice } from "../data/products";
import {
  getCustomerUser,
  setCustomerUser,
  sendOtp,
  verifyOtp,
  fetchMe,
  updateMyProfile,
  customerLogout as apiCustomerLogout,
  getServerCart,
  syncServerCart,
  clearServerCart as apiClearServerCart,
  getCatalog,
} from "../lib/api";

const ShopContext = createContext(null);

const CART_KEY = "iluxe_cart";

const loadCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const cartItemsForServer = (items) =>
  items.map((i) => {
    const p = byId(i.id);
    return { id: i.id, qty: i.qty, size: (p && p.size) || "Signature" };
  });

export function ShopProvider({ children }) {
  const [cart, setCart] = useState(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ id: 0, message: "" });
  const toastTimer = useRef(null);

  const [customerToken, setCustomerTokenState] = useState(() => getCustomerUser() ? "token" : "");
  const [customerUser, setCustomerUserState] = useState(getCustomerUser);
  const [catalog, setCatalog] = useState(null);
  const customerTokenRef = useRef(customerToken);

  const showToast = useCallback((message) => {
    setToast((t) => ({ id: t.id + 1, message }));
  }, []);

  useEffect(() => {
    let mounted = true;
    getCatalog()
      .then((c) => { if (mounted) setCatalog(c); })
      .catch((e) => { if (mounted) console.error("catalog load failed:", e); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!toast.message) return undefined;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, message: "" }));
    }, 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  // Persist + sync server cart whenever the cart mutates under an auth session.
  const syncTimer = useRef(null);
  const persist = useCallback((next) => {
    setCart(next);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — state still works in-memory */
    }
    if (customerTokenRef.current && next.length > 0) {
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        syncServerCart(cartItemsForServer(next)).catch(() => {});
      }, 600);
    }
  }, []);

  // Restore a server cart into the local cart (used right after OTP login).
  const adoptCart = useCallback((serverItems, preferLocal) => {
    if (preferLocal) {
      // Local cart survives: push it up to the account cart.
      if (customerTokenRef.current) syncServerCart(cartItemsForServer(cart));
      return;
    }
    if (Array.isArray(serverItems) && serverItems.length > 0) {
      const restore = serverItems.map((i) => ({ id: i.id, qty: i.qty }));
      setCart(restore);
      try { localStorage.setItem(CART_KEY, JSON.stringify(restore)); } catch { /* noop */ }
    }
  }, [cart]);

  const addToCart = useCallback((id, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === id);
      const next = existing
        ? prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i))
        : [...prev, { id, qty }];
      persist(next);
      return next;
    });
  }, [persist]);

  const setQty = useCallback((id, delta) => {
    setCart((prev) => {
      const next = prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
      persist(next);
      return next;
    });
  }, [persist]);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => {
      const next = prev.filter((i) => i.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearCart = useCallback(() => {
    setCart([]);
    try { localStorage.setItem(CART_KEY, JSON.stringify([])); } catch { /* noop */ }
    if (customerTokenRef.current) apiClearServerCart().catch(() => {});
  }, []);

  // ---- Customer auth ------------------------------------------------------

  const loginWithOtp = useCallback(async (email, code) => {
    const data = await verifyOtp({ email, code });
    const user = data.user || null;
    setCustomerTokenState(user ? "token" : "");
    setCustomerUserState(user);
    setCustomerUser(user);
    customerTokenRef.current = user ? "token" : "";
    if (!user) return data;
    const serverItems = await getServerCart().catch(() => []);
    // Adopt a saved account cart only when the device cart is empty.
    if (cart.length === 0) adoptCart(serverItems, false);
    else syncServerCart(cartItemsForServer(cart)).catch(() => {});
    if (data.user) showToast(`Welcome back, ${data.user.email || "customer"}`);
    return data;
  }, [adoptCart, cart, showToast]);

  const requestOtp = useCallback(async (email) => {
    return sendOtp(email);
  }, []);

  const logoutCustomer = useCallback(() => {
    apiCustomerLogout();
    apiClearServerCart().catch(() => {});
    setCustomerTokenState("");
    setCustomerUserState(null);
    customerTokenRef.current = "";
  }, []);

  const refreshCustomer = useCallback(async () => {
    const user = await fetchMe();
    setCustomerUserState(user);
    return user;
  }, []);

  const saveProfile = useCallback(async (profile) => {
    const user = await updateMyProfile(profile);
    setCustomerUserState(user);
    return user;
  }, []);

  useEffect(() => {
    customerTokenRef.current = customerToken;
  }, [customerToken]);

  const cartCount = useMemo(
    () => cart.reduce((sum, i) => sum + i.qty, 0),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, i) => {
        const p = byId(i.id);
        return sum + (p ? p.salePrice * i.qty : 0);
      }, 0),
    [cart]
  );

  const deliveryFee = catalog?.delivery_fee ?? 300;

  const value = useMemo(
    () => ({
      cart,
      cartCount,
      subtotal,
      subtotalLabel: formatPrice(subtotal),
      deliveryFee,
      deliveryFeeLabel: formatPrice(deliveryFee),
      catalog,
      customerToken,
      isCustomer: !!customerToken,
      customerUser,
      requestOtp,
      loginWithOtp,
      logoutCustomer,
      refreshCustomer,
      saveProfile,
      cartOpen,
      mobileMenuOpen,
      setCartOpen,
      setMobileMenuOpen,
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      showToast,
      toast,
    }),
    [cart, cartCount, subtotal, deliveryFee, catalog, customerToken, customerUser, toast, cartOpen, mobileMenuOpen, setCartOpen, setMobileMenuOpen, addToCart, setQty, removeFromCart, clearCart, showToast, requestOtp, loginWithOtp, logoutCustomer, refreshCustomer, saveProfile]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}