// src/components/admin/OrderDetailModal.jsx
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { X, MessageCircle, MapPin, StickyNote } from "lucide-react";
import { formatRupiah } from "../../utils/formatCurrency";
import FulfillmentDropdown from "./FulfillmentDropdown";
import { PAYMENT_STATUS, formatOrderCode, formatOrderDate, customerWaLink } from "../../constants/adminOrder";

export default function OrderDetailModal({ order, onClose, onUpdate, loadingId }) {
  const dialogRef = useDialogFocus(true, onClose);

  if (!order) return null;
  const kode    = formatOrderCode(order);
  const ps      = PAYMENT_STATUS[order.status_pembayaran] || {};
  const isLunas = order.status_pembayaran === "lunas";
  const wa      = customerWaLink(order);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Detail pesanan ${kode}`}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-lg text-neutral-900 font-mono">{kode}</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ps.badge}`}>
                {ps.label}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">{formatOrderDate(order.created_at)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup detail pesanan"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-neutral-500 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Pelanggan */}
          <div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Pelanggan</p>
            <p className="font-semibold text-neutral-900">{order.nama_pelanggan}</p>
            <div className="flex items-center gap-3">
              <p className="text-sm text-neutral-500">{order.no_hp_pelanggan}</p>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-success hover:bg-green-100"
                >
                  <MessageCircle size={13} />
                  {order.status_pesanan === "dikirim" ? "Kabari siap diambil" : "Chat WhatsApp"}
                </a>
              )}
            </div>
            {order.alamat_pelanggan && order.alamat_pelanggan !== "-" && (
              <p className="text-sm text-neutral-500 mt-0.5 flex gap-1.5">
                <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{order.alamat_pelanggan}</span>
              </p>
            )}
          </div>

          {/* Catatan */}
          {order.catatan && (
            <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <StickyNote size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-0.5">Catatan</p>
                <p className="text-sm text-amber-900 leading-relaxed">{order.catatan}</p>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="rounded-xl border border-neutral-100 overflow-hidden">
            <div className="bg-neutral-50 px-4 py-2.5">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Item Pesanan</p>
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
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Status Pengerjaan</p>
              <FulfillmentDropdown order={order} onUpdate={onUpdate} loadingId={loadingId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
