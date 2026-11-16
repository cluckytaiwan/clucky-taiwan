// src/pages/public/OrderStatusPage.jsx
import { useNavigate } from "react-router-dom";
import OrderStatusChecker from "../../components/OrderStatusChecker";
import StoreFooter from "../../components/StoreFooter";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function OrderStatusPage() {
  const navigate = useNavigate();
  usePageTitle("Pesanan Saya");

  return (
    <div className="min-h-dvh bg-background pt-8 flex flex-col">
      <button
        onClick={() => navigate("/")}
        className="mx-auto mb-2 flex h-11 w-full max-w-3xl items-center px-4 sm:px-8 font-body text-sm text-neutral-600"
      >
        &larr; Kembali ke Beranda
      </button>
      <main className="flex-1">
        <h1 className="mx-auto max-w-3xl px-4 sm:px-8 font-display text-2xl font-bold text-neutral-900">Pesanan Saya</h1>
        <OrderStatusChecker />
      </main>
      <StoreFooter />
    </div>
  );
}
