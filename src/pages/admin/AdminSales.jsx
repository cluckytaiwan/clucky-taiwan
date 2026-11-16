// src/pages/admin/AdminSales.jsx
// Halaman Penjualan/Pemesanan — menggunakan shared ordersStore.
// Default menampilkan antrean pesanan AKTIF (lunas & belum selesai), paling lama di atas.
import { useEffect, useState } from "react";
import { CheckCheck, ChevronDown, ChevronUp, Loader2, MessageCircle, Search, X, StickyNote } from "lucide-react";
import toast from "react-hot-toast";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { formatRupiah } from "../../utils/formatCurrency";
import FulfillmentAction from "../../components/admin/FulfillmentAction";
import OrderDetailModal from "../../components/admin/OrderDetailModal";
import { useOrdersStore, PAGE_SIZE } from "../../store/ordersStore";
import {
  PAYMENT_STATUS, isActiveOrder, formatOrderCode, formatOrderDate, customerWaLink,
} from "../../constants/adminOrder";

const FILTERS = [
  { key: "aktif", label: "Aktif" },
  { key: "all", label: "Semua" },
  { key: "menunggu_pembayaran", label: "Menunggu" },
  { key: "lunas", label: "Lunas" },
  { key: "kadaluarsa", label: "Kedaluwarsa" },
  { key: "dibatalkan", label: "Dibatalkan" },
  { key: "ditolak", label: "Ditolak" },
];

/** Cocokkan pesanan dengan filter aktif — menjaga list konsisten saat event realtime masuk. */
function matchesFilter(order, status) {
  if (status === "aktif") return isActiveOrder(order);
  if (status === "all") return true;
  return order.status_pembayaran === status;
}

function itemSummary(order) {
  const items = order.detail_pesanan || [];
  const first = items[0];
  if (!first) return { label: "—", extra: 0 };
  const name = first.nama_produk || first.produk?.nama_produk || "Produk Terhapus";
  return { label: `${name} (${first.jumlah ?? first.kuantitas}x)`, extra: items.length - 1 };
}

function StatCard({ label, value, colorClass, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-surface border rounded-xl px-4 py-3 text-left transition-colors ${
        active ? "border-primary ring-1 ring-primary/30" : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <p className={`font-bold text-xl font-display ${colorClass}`}>{value}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
    </button>
  );
}

function PaymentBadge({ status }) {
  const ps = PAYMENT_STATUS[status] || {};
  return (
    <span className={`inline-block whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full border ${ps.badge}`}>
      {ps.label ?? status}
    </span>
  );
}

export default function AdminSales() {
  const orders       = useOrdersStore(s => s.orders);
  const totalCount   = useOrdersStore(s => s.totalCount);
  const page         = useOrdersStore(s => s.page);
  const salesLoading = useOrdersStore(s => s.salesLoading);
  const counts       = useOrdersStore(s => s.counts);
  const fetchSales   = useOrdersStore(s => s.fetchSales);
  const fetchCounts  = useOrdersStore(s => s.fetchCounts);
  const setFilters   = useOrdersStore(s => s.setFilters);
  const completeOldOrders      = useOrdersStore(s => s.completeOldOrders);
  const storeUpdateFulfillment = useOrdersStore(s => s.updateFulfillment);

  const [filterStatus,  setFilterStatus]  = useState("aktif");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sortAsc,       setSortAsc]       = useState(false);
  const [loadingId,     setLoadingId]     = useState(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [cleaning,      setCleaning]      = useState(false);
  const cleanupDialogRef = useDialogFocus(confirmCleanup, () => setConfirmCleanup(false));

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Pencarian & filter dijalankan di server (seluruh pesanan), debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setFilters({ search: searchQuery, status: filterStatus }), 300);
    return () => clearTimeout(t);
  }, [searchQuery, filterStatus, setFilters]);

  // Sinkronkan modal detail saat orders berubah (realtime / update)
  useEffect(() => {
    if (!selectedOrder) return;
    const updated = orders.find(o => o.id === selectedOrder.id);
    if (updated) setSelectedOrder(prev => ({ ...prev, ...updated }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  async function updateFulfillment(orderId, newStatus) {
    setLoadingId(orderId);
    const error = await storeUpdateFulfillment(orderId, newStatus);
    setLoadingId(null);
    if (error) toast.error("Gagal mengubah status pesanan. Periksa koneksi lalu coba lagi.");
  }

  async function handleCleanup() {
    setCleaning(true);
    const { count, error } = await completeOldOrders();
    setCleaning(false);
    setConfirmCleanup(false);
    if (error) toast.error("Gagal menyelesaikan pesanan lama.");
    else toast.success(count > 0 ? `${count} pesanan lama ditandai selesai` : "Tidak ada pesanan lama yang tertunda");
  }

  // Antrean aktif diurutkan server (paling lama dulu); tab lain bisa dibalik urutannya
  const filtered = orders
    .filter(o => matchesFilter(o, filterStatus))
    .slice()
    .sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at);
      if (filterStatus === "aktif") return diff;
      return sortAsc ? diff : -diff;
    });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-neutral-900">Pesanan</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {filterStatus === "aktif" ? "Antrean pesanan yang perlu dikerjakan, paling lama di atas" : "Kelola dan pantau semua transaksi"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Live
        </span>
      </div>

      {/* Statistik (seluruh pesanan) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xl">
        <StatCard label="Perlu diproses" value={counts.diproses} colorClass="text-blue-600"
          active={filterStatus === "aktif"} onClick={() => setFilterStatus("aktif")} />
        <StatCard label="Siap diambil" value={counts.siap} colorClass="text-violet-600"
          active={false} onClick={() => setFilterStatus("aktif")} />
        <StatCard label="Menunggu bayar" value={counts.menunggu} colorClass="text-amber-600"
          active={filterStatus === "menunggu_pembayaran"} onClick={() => setFilterStatus("menunggu_pembayaran")} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama, kode, atau no. HP…"
            aria-label="Cari pesanan"
            className="w-full pl-9 pr-9 py-2.5 bg-surface border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Hapus pencarian"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                filterStatus === f.key
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-surface text-neutral-600 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {searchQuery && (
        <p className="text-xs text-neutral-500">
          {totalCount} hasil untuk &ldquo;<strong className="text-neutral-700">{searchQuery}</strong>&rdquo;
        </p>
      )}

      {/* Daftar pesanan */}
      {salesLoading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 size={28} className="animate-spin mx-auto mb-2" />
          <p className="text-sm">Memuat pesanan…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <p className="text-sm">
            {searchQuery
              ? "Tidak ada pesanan yang cocok dengan pencarian."
              : filterStatus === "aktif"
                ? "Tidak ada pesanan yang perlu dikerjakan."
                : "Tidak ada pesanan."}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          {/* HP: kartu */}
          <ul className="md:hidden divide-y divide-neutral-100">
            {filtered.map(order => {
              const { label, extra } = itemSummary(order);
              const wa = customerWaLink(order);
              return (
                <li key={order.id} className="p-4">
                  <button type="button" onClick={() => setSelectedOrder(order)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-neutral-900">{formatOrderCode(order)}</p>
                        <p className="mt-0.5 font-semibold text-neutral-800">{order.nama_pelanggan}</p>
                        <p className="text-xs text-neutral-500">{formatOrderDate(order.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-neutral-900">{formatRupiah(order.total_harga)}</p>
                        <div className="mt-1"><PaymentBadge status={order.status_pembayaran} /></div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-neutral-700 line-clamp-1">
                      {label}{extra > 0 && <span className="text-neutral-400"> +{extra} lainnya</span>}
                    </p>
                    {order.catatan && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-amber-700"><StickyNote size={12} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="line-clamp-2">{order.catatan}</span></p>
                    )}
                  </button>
                  {order.status_pembayaran === "lunas" && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <FulfillmentAction order={order} onUpdate={updateFulfillment} loadingId={loadingId} compact />
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Chat WhatsApp ${order.nama_pelanggan}`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-success hover:bg-green-50"
                        >
                          <MessageCircle size={18} />
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Desktop: tabel */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase tracking-widest text-neutral-500 font-bold">
                  <th className="text-left px-5 py-3">
                    {filterStatus === "aktif" ? (
                      "Kode / Waktu"
                    ) : (
                      <button
                        className="flex items-center gap-1 uppercase hover:text-neutral-700 transition-colors"
                        onClick={() => setSortAsc(v => !v)}
                      >
                        Kode / Waktu
                        {sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    )}
                  </th>
                  <th className="text-left px-5 py-3">Pelanggan</th>
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-center px-5 py-3">Bayar</th>
                  <th className="text-left px-5 py-3">Pengerjaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(order => {
                  const { label, extra } = itemSummary(order);
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-neutral-50/80 transition-colors align-middle cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-neutral-900 font-mono text-xs">{formatOrderCode(order)}</p>
                        <p className="text-neutral-500 text-xs mt-0.5">{formatOrderDate(order.created_at)}</p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="font-semibold text-neutral-800 text-sm">{order.nama_pelanggan}</p>
                        <p className="text-neutral-500 text-xs mt-0.5">{order.no_hp_pelanggan}</p>
                      </td>
                      <td className="px-5 py-3.5" style={{ maxWidth: 220 }}>
                        <p className="text-neutral-800 text-sm line-clamp-1">{label}</p>
                        {order.catatan && (
                          <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-700"><StickyNote size={12} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="line-clamp-1">{order.catatan}</span></p>
                        )}
                        {extra > 0 && <p className="text-xs text-neutral-500 mt-0.5">+{extra} lainnya</p>}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className="font-bold text-neutral-900">{formatRupiah(order.total_harga)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <PaymentBadge status={order.status_pembayaran} />
                      </td>
                      <td className="px-5 py-3.5">
                        {order.status_pembayaran === "lunas" ? (
                          <FulfillmentAction order={order} onUpdate={updateFulfillment} loadingId={loadingId} compact />
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer: paginasi */}
          <div className="px-4 sm:px-5 py-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 bg-neutral-50 text-xs">
            <span className="text-neutral-500">
              {`${orders.length > 0 ? page * PAGE_SIZE + 1 : 0}–${page * PAGE_SIZE + orders.length} dari ${totalCount} pesanan`}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchSales(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => fetchSales(page + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
                className="px-3 py-2 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bersihkan antrean dari pesanan lama yang lupa ditandai selesai */}
      {filterStatus === "aktif" && (
        <button
          type="button"
          onClick={() => setConfirmCleanup(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <CheckCheck size={14} />
          Selesaikan pesanan lama (lebih dari 24 jam)
        </button>
      )}

      {confirmCleanup && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div ref={cleanupDialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="cleanup-title" className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 id="cleanup-title" className="font-bold text-lg text-neutral-900 mb-2">Selesaikan pesanan lama?</h3>
            <p className="text-sm text-neutral-600 mb-5">
              Semua pesanan lunas yang dibuat lebih dari 24 jam lalu dan belum berstatus Selesai
              akan ditandai <strong>Selesai</strong>. Gunakan ini untuk membersihkan antrean dari
              pesanan yang lupa diperbarui.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCleanup(false)}
                className="flex-1 border border-neutral-200 rounded-xl py-2.5 font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Batal
              </button>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="flex-1 bg-neutral-900 hover:bg-neutral-700 text-white rounded-xl py-2.5 font-semibold disabled:opacity-60"
              >
                {cleaning ? "Memproses…" : "Tandai Selesai"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={updateFulfillment}
          loadingId={loadingId}
        />
      )}
    </div>
  );
}
