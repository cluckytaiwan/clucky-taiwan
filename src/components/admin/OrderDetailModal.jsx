// src/components/admin/OrderDetailModal.jsx
import { X } from "lucide-react";
import { formatRupiah } from "../../utils/formatCurrency";
import FulfillmentDropdown from "./FulfillmentDropdown";

const PAYMENT_STATUS = {
  menunggu_pembayaran: { label: "Menunggu",    badge: "bg-amber-100 text-amber-700 border-amber-200" },
  lunas:               { label: "Lunas",        badge: "bg-green-100 text-green-700 border-green-200"  },
  kadaluarsa:          { label: "Kedaluwarsa",  badge: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  dibatalkan:          { label: "Dibatalkan",   badge: "bg-red-100 text-red-600 border-red-200"       },
  ditolak:             { label: "Ditolak",      badge: "bg-red-100 text-red-600 border-red-200"       },
  dikembalikan:        { label: "Dikembalikan", badge: "bg-blue-100 text-blue-600 border-blue-200"    },
};

function formatDate(iso) {
  return new Date(iso)
    .toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(".", ":");
}

function formatCode(id) {
  return `#${String(id).padStart(4, "0")}`;
}

export default function OrderDetailModal({ order, onClose, onUpdate, loadingId }) {
  if (!order) return null;
  const kode    = order.kode_pesanan ? `#${order.kode_pesanan}` : formatCode(order.id);
  const ps      = PAYMENT_STATUS[order.status_pembayaran] || {};
  const isLunas = order.status_pembayaran === "lunas";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-lg text-neutral-900 font-mono">{kode}</p>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ps.badge}`}>
                {ps.label}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">{formatDate(order.created_at)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-neutral-500 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Pelanggan */}
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Pelanggan</p>
            <p className="font-semibold text-neutral-900">{order.nama_pelanggan}</p>
            <p className="text-sm text-neutral-500">{order.no_hp_pelanggan}</p>
            {order.alamat_pelanggan && (
              <p className="text-sm text-neutral-500 mt-0.5 flex gap-1.5">
                <span>📍</span><span>{order.alamat_pelanggan}</span>
              </p>
            )}
          </div>

          {/* Catatan */}
          {order.catatan && (
            <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-500 shrink-0 mt-0.5">📝</span>
              <div>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">Catatan</p>
                <p className="text-sm text-amber-900 leading-relaxed">{order.catatan}</p>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="rounded-xl border border-neutral-100 overflow-hidden">
            <div className="bg-neutral-50 px-4 py-2.5">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Item Pesanan</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {order.detail_pesanan?.map((dp) => (
                <div key={dp.id} className="flex justify-between items-start px-4 py-3 text-sm gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-700">
                      {dp.nama_produk || dp.produk?.nama_produk || "Produk Terhapus"}
                      <span className="text-neutral-400 ml-1.5 text-xs">×{dp.jumlah ?? dp.kuantitas}</span>
                    </p>
                    {/* Tampilkan varian yang dipilih (snapshot dari checkout) */}
                    {Array.isArray(dp.varian_terpilih) && dp.varian_terpilih.length > 0 && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {dp.varian_terpilih.map((v) => v.nama).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-neutral-900 shrink-0">{formatRupiah(dp.subtotal)}</span>
                </div>
              ))}

            </div>
            <div className="bg-neutral-50 px-4 py-3 flex justify-between items-center border-t border-neutral-100">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total</span>
              <span className="font-bold text-primary text-base">{formatRupiah(order.total_harga)}</span>
            </div>
          </div>

          {/* Fulfillment dropdown di modal */}
          {isLunas && (
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Status Pengiriman</p>
              <FulfillmentDropdown order={order} onUpdate={onUpdate} loadingId={loadingId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
