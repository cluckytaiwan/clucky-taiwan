// src/pages/public/OrderStatusPage.jsx
import { useNavigate } from "react-router-dom";
import OrderStatusChecker from "../../components/OrderStatusChecker";

export default function OrderStatusPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background py-8">
      <button
        onClick={() => navigate("/")}
        className="mx-auto mb-2 block max-w-md px-4 font-body text-sm text-neutral-500"
      >
        &larr; Kembali ke Beranda
      </button>
      <OrderStatusChecker />
    </div>
  );
}
