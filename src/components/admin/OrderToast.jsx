// src/components/admin/OrderToast.jsx
import { useNavigate } from "react-router-dom";
import { ShoppingBag, X, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Custom toast UI for new incoming orders.
 * Called via toast.custom((t) => <OrderToast t={t} order={order} />)
 */
export default function OrderToast({ t, order }) {
  const navigate = useNavigate();

  const nama = order?.nama_pelanggan || "Pelanggan";
  const total = order?.total_harga
    ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(order.total_harga)
    : "—";
  const kode = order?.kode_pesanan
    ? `#${order.kode_pesanan}`
    : order?.id
      ? `#${String(order.id).padStart(4, "0")}`
      : "";

  function handleView() {
    toast.dismiss(t.id);
    navigate("/admin/dashboard");
  }

  return (
    <div
      className={`
        flex items-start gap-3 w-80 max-w-full
        bg-white border border-neutral-200 shadow-2xl rounded-2xl p-4
        transition-all duration-300
        ${t.visible ? "animate-toast-in" : "opacity-0 translate-x-4"}
      `}
      style={{
        animation: t.visible
          ? "toastSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
          : "toastSlideOut 0.25s ease-in forwards",
      }}
    >
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
        <ShoppingBag size={18} className="text-green-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
            Pembayaran Lunas
          </span>
          {kode && (
            <span className="text-xs font-mono text-neutral-400">{kode}</span>
          )}
        </div>
        <p className="text-sm font-semibold text-neutral-800 truncate">{nama}</p>
        <p className="text-sm font-bold text-primary mt-0.5">{total}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="p-1 rounded-lg text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100 transition-colors"
          aria-label="Tutup notifikasi"
        >
          <X size={14} />
        </button>
        <button
          onClick={handleView}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/5"
        >
          Lihat <ArrowRight size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-green-400 rounded-b-2xl"
        style={{
          width: "100%",
          transformOrigin: "left",
          animation: t.visible ? "toastProgress 6s linear forwards" : "none",
        }}
      />

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastSlideOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: translateX(100%) scale(0.95); }
        }
        @keyframes toastProgress {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
