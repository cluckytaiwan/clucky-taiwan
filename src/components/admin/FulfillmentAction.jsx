// src/components/admin/FulfillmentAction.jsx
// Status pengerjaan + tombol satu langkah ke status berikutnya
// (Diproses → Siap Diambil → Selesai). Untuk koreksi mundur, pakai
// FulfillmentDropdown di modal detail.
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { fulfillmentInfo, nextFulfillment } from "../../constants/adminOrder";

export default function FulfillmentAction({ order, onUpdate, loadingId, compact = false }) {
  const isLoading = loadingId === order.id;
  const current = fulfillmentInfo(order.status_pesanan);
  const next = nextFulfillment(order.status_pesanan);

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "flex-wrap"}`} onClick={(e) => e.stopPropagation()}>
      <span className={`inline-block whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border ${current.badge}`}>
        {current.label}
      </span>
      {next && (
        <button
          type="button"
          onClick={() => onUpdate(order.id, next.key)}
          disabled={isLoading}
          className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-neutral-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : next.key === "selesai" ? (
            <Check size={14} />
          ) : (
            <ArrowRight size={14} />
          )}
          {next.key === "selesai" ? "Selesai" : next.label}
        </button>
      )}
    </div>
  );
}
