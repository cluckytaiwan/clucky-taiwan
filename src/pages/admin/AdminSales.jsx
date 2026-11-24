// src/pages/admin/AdminSales.jsx
// Halaman Penjualan/Pemesanan — menggunakan shared ordersStore
// Orders state & realtime dikelola oleh store; halaman ini hanya UI + filter lokal.
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { formatRupiah } from "../../utils/formatCurrency";
import FulfillmentDropdown from "../../components/admin/FulfillmentDropdown";
import OrderDetailModal from "../../components/admin/OrderDetailModal";
import { useOrdersStore, PAGE_SIZE } from "../../store/ordersStore";

/* ─── Konstanta ───────────────────────────────────────────── */
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

function formatCode(id, kode) {
  return kode ? `#${kode}` : `#${String(id).padStart(4, "0")}`;
}

/* ─── Komponen Statistik Mini ─────────────────────────────── */
function MiniStat({ label, value, colorClass }) {
  return (
    <div className="bg-surface border border-neutral-200 rounded-xl px-4 py-3 text-center min-w-[110px]">
      <p className={`font-bold text-lg font-display ${colorClass}`}>{value}</p>
      <p className="text-[11px] text-neutral-400 mt-0.5">{label}</p>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function AdminSales() {
  // ── Shared store (orders, pagination, loading) ──
  const orders       = useOrdersStore(s => s.orders);
  const totalCount   = useOrdersStore(s => s.totalCount);
  const page         = useOrdersStore(s => s.page);
  const salesLoading = useOrdersStore(s => s.salesLoading);
  const fetchSales   = useOrdersStore(s => s.fetchSales);
  const storeUpdateFulfillment = useOrdersStore(s => s.updateFulfillment);

  // ── UI state lokal (bukan state orders) ──
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [searchQuery,    setSearchQuery]     = useState("");
  const [selectedOrder,  setSelectedOrder]  = useState(null);
  const [sortAsc,        setSortAsc]        = useState(false);
  const [loadingId,      setLoadingId]      = useState(null);

  // Fetch halaman pertama saat komponen mount
  useEffect(() => {
    fetchSales(0);
  }, [fetchSales]);

  // Sync selectedOrder saat orders di-update oleh realtime
  useEffect(() => {
    if (!selectedOrder) return;
    const updated = orders.find(o => o.id === selectedOrder.id);
    if (updated) setSelectedOrder(prev => ({ ...prev, ...updated }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  /* ─── Pagination ─── */
  function goToPage(newPage) {
    fetchSales(newPage);
  }

  /* ─── Fulfillment update ─── */
  async function updateFulfillment(orderId, newStatus) {
    setLoadingId(orderId);
    await storeUpdateFulfillment(orderId, newStatus);
    // selectedOrder sudah di-update via useEffect di atas (sync dari orders)
    setLoadingId(null);
  }

  /* ─── Filter & Search (client-side pada halaman aktif) ─── */
  const filtered = orders
    .filter(o => filterStatus === "all" || o.status_pembayaran === filterStatus)
    .filter(o => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.nama_pelanggan?.toLowerCase().includes(q) ||
        o.no_hp_pelanggan?.includes(q) ||
        (o.kode_pesanan && o.kode_pesanan.toLowerCase().includes(q)) ||
        String(o.id).toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => {
      const diff = new Date(b.created_at) - new Date(a.created_at);
      return sortAsc ? -diff : diff;
    });

  /* ─── Statistik Mini ─── */
  const settled    = orders.filter(o => o.status_pembayaran === "lunas").length;
  const pending    = orders.filter(o => o.status_pembayaran === "menunggu_pembayaran").length;
  const inProgress = orders.filter(o => o.status_pembayaran === "lunas" && o.status_pesanan !== "selesai").length;

  const filterOptions = ["all", "menunggu_pembayaran", "lunas", "kadaluarsa", "dibatalkan", "ditolak"];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-neutral-900">Penjualan & Pesanan</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Kelola dan pantau semua transaksi masuk</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Live
        </span>
      </div>

      {/* Statistik Mini */}
      <div className="flex gap-3 flex-wrap">
        <MiniStat label="Halaman ini"  value={orders.length}  colorClass="text-neutral-800" />
        <MiniStat label="Lunas"        value={settled}         colorClass="text-success" />
        <MiniStat label="Menunggu"     value={pending}         colorClass="text-amber-600" />
        <MiniStat label="Diproses"     value={inProgress}      colorClass="text-blue-600" />
      </div>

      {/* Toolbar: Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Box */}
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama, kode, atau no. HP…"
            className="w-full pl-9 pr-8 py-2.5 bg-surface border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Status Bayar */}
        <div className="flex gap-1.5 flex-wrap">
          {filterOptions.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                filterStatus === s
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-surface text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:text-neutral-700"
              }`}
            >
              {s === "all" ? "Semua" : (PAYMENT_STATUS[s]?.label ?? s)}
            </button>
          ))}
        </div>
      </div>

      {/* Info hasil search */}
      {searchQuery && (
        <p className="text-xs text-neutral-400">
          {filtered.length} hasil untuk &ldquo;<strong className="text-neutral-600">{searchQuery}</strong>&rdquo;
          {filterStatus !== "all" && ` dalam status ${PAYMENT_STATUS[filterStatus]?.label}`}
        </p>
      )}

      {/* Tabel Pesanan */}
      {salesLoading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 size={28} className="animate-spin mx-auto mb-2" />
          <p className="text-sm">Memuat data pesanan…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <p className="text-sm">
            {searchQuery
              ? "Tidak ada pesanan yang cocok dengan pencarian."
              : "Tidak ada pesanan."}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-widest text-neutral-400 font-bold">
                  <th className="text-left px-5 py-3">
                    <button
                      className="flex items-center gap-1 hover:text-neutral-700 transition-colors"
                      onClick={() => setSortAsc(v => !v)}
                    >
                      ID / Waktu
                      {sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </th>
                  <th className="text-left px-5 py-3">Pelanggan</th>
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-center px-5 py-3 w-32">Bayar</th>
                  <th className="text-left px-5 py-3 w-44">Status Kirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(order => {
                  const kode    = formatCode(order.id, order.kode_pesanan);
                  const items   = order.detail_pesanan || [];
                  const first   = items[0];
                  const extra   = items.length - 1;
                  const ps      = PAYMENT_STATUS[order.status_pembayaran] || {};
                  const isLunas = order.status_pembayaran === "lunas";

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-neutral-50/80 transition-colors align-middle cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* ID / Waktu */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-neutral-900 font-mono text-xs">{kode}</p>
                        <p className="text-neutral-400 text-xs mt-0.5">{formatDate(order.created_at)}</p>
                      </td>

                      {/* Pelanggan */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="font-semibold text-neutral-800 text-sm">{order.nama_pelanggan}</p>
                        <p className="text-neutral-400 text-xs mt-0.5">{order.no_hp_pelanggan}</p>
                      </td>

                      {/* Item */}
                      <td className="px-5 py-3.5" style={{ maxWidth: 180 }}>
                        {first ? (
                          <>
                            <p className="text-neutral-800 text-sm line-clamp-1">
                              {first.produk?.nama_produk || first.nama_produk || "Produk Terhapus"}
                              <span className="text-neutral-400 ml-1 text-xs">({first.kuantitas || first.jumlah}x)</span>
                            </p>
                            {order.catatan && (
                              <p className="text-[11px] text-amber-600 mt-0.5 line-clamp-1">📝 {order.catatan}</p>
                            )}
                            {extra > 0 && (
                              <p className="text-[11px] text-neutral-400 mt-0.5">+{extra} lainnya</p>
                            )}
                          </>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className="font-bold text-neutral-900">{formatRupiah(order.total_harga)}</span>
                      </td>

                      {/* Status Bayar */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${ps.badge}`}>
                          {ps.label}
                        </span>
                      </td>

                      {/* Status Kirim */}
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        {isLunas ? (
                          <FulfillmentDropdown
                            order={order}
                            onUpdate={updateFulfillment}
                            loadingId={loadingId}
                          />
                        ) : (
                          <span className="text-xs text-neutral-300 italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between bg-neutral-50 text-xs">
            <span className="text-neutral-500">
              {searchQuery
                ? `${filtered.length} hasil dari ${orders.length} pesanan termuat`
                : `Menampilkan ${orders.length > 0 ? page * PAGE_SIZE + 1 : 0}–${page * PAGE_SIZE + orders.length} dari ${totalCount} pesanan`
              }
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detail pesanan */}
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
