import { useShop } from "../store/ShopContext";

export default function Toast() {
  const { toast } = useShop();
  return (
    <div className={`toast ${toast.message ? "show" : ""}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}