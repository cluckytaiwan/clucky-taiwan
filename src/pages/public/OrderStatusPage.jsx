// src/pages/public/OrderStatusPage.jsx
import { useNavigate } from "react-router-dom";
import OrderStatusChecker from "../../components/OrderStatusChecker";
import StoreFooter from "../../components/StoreFooter";

export default function OrderStatusPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-8 flex flex-col">
      <button
        onClick={() => navigate("/")}
        className="mx-auto mb-2 block max-w-md px-4 font-body text-sm text-neutral-500"
      >
        &larr; Kembali ke Beranda
      </button>
      <div className="flex-1">
        <OrderStatusChecker />
      </div>
      <StoreFooter />
    </div>
  );
}
