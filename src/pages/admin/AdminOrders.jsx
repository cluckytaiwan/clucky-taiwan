// src/pages/admin/AdminOrders.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah } from "../../utils/formatCurrency";
import { ChevronDown, ChevronUp, Eye, Loader2 } from "lucide-react";
import SalesSummary from "../../components/admin/SalesSummary";
import FulfillmentDropdown from "../../components/admin/FulfillmentDropdown";
import OrderDetailModal from "../../components/admin/OrderDetailModal";

/* ─── Konstanta (dipakai di tabel baris, bukan di sub-komponen) ─ */
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

/* ─── Main Page ─────────────────────────────────────────────── */
export default function AdminOrders() {
  const [orders, setOrders]               = useState([]);
  const [totalCount, setTotalCount]       = useState(0);
  const [page, setPage]                   = useState(0);
  const PAGE_SIZE = 50;

  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sortAsc, setSortAsc]             = useState(false);
  const [loadingId, setLoadingId]         = useState(null);

  useEffect(() => {
    fetchOrders();
    const ch = supabase
      .channel("admin-pesanan-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pesanan" }, handleRealtimeChange)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [page]);

  async function fetchOrders() {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("pesanan")
      .select("*, detail_pesanan(*, produk(nama_produk))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    setOrders(data || []);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }

  /* Fetch satu pesanan lengkap dengan relasi — dipakai saat realtime INSERT */
  async function fetchSingleOrder(id) {
    const { data } = await supabase
      .from("pesanan")
      .select("*, detail_pesanan(*, produk(nama_produk))")
      .eq("id", id)
      .single();
    if (data) {
      setOrders((prev) => [data, ...prev.filter((o) => o.id !== data.id)]);
    }
  }

  function handleRealtimeChange({ eventType, new: n, old: o }) {
    if (eventType === "INSERT") {
      // Fetch ulang agar relasi detail_pesanan(produk) ikut termuat
      fetchSingleOrder(n.id);
    } else if (eventType === "UPDATE") {
      setOrders((prev) => prev.map((r) => (r.id === n.id ? { ...r, ...n } : r)));
      setSelectedOrder((prev) => (prev?.id === n.id ? { ...prev, ...n } : prev));
    } else if (eventType === "DELETE") {
      setOrders((prev) => prev.filter((r) => r.id !== o.id));
    }
  }

  async function updateFulfillment(orderId, newStatus) {
    setLoadingId(orderId);
    const { error: updateError } = await supabase
      .from("pesanan")
      .update({ status_pesanan: newStatus })
      .eq("id", orderId);

    if (!updateError) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status_pesanan: newStatus } : o)));
      setSelectedOrder((prev) => (prev?.id === orderId ? { ...prev, status_pesanan: newStatus } : prev));
    }
    setLoadingId(null);
  }

  const filtered = (filter === "all" ? orders : orders.filter((o) => o.status_pembayaran === filter))
    .slice()
    .sort((a, b) => {
      const diff = new Date(b.created_at) - new Date(a.created_at);
      return sortAsc ? -diff : diff;
    });

  const filterOptions = ["all", "menunggu_pembayaran", "lunas", "kadaluarsa", "dibatalkan"];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-display text-neutral-900 mb-6">Pesanan Masuk</h1>

      <SalesSummary orders={orders} />

      {/* Filter pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filterOptions.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s ? "bg-primary text-white shadow-sm" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {s === "all" ? "Semua" : (PAYMENT_STATUS[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 size={28} className="animate-spin mx-auto mb-2" />
          <p className="text-sm">Memuat data pesanan…</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-16 text-neutral-400 text-sm">Tidak ada pesanan.</p>
      ) : (
        <div className="bg-surface border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-widest text-neutral-400 font-bold">
                  <th className="text-left px-5 py-3">
                    <button
                      className="flex items-center gap-1 hover:text-neutral-700 transition-colors"
                      onClick={() => setSortAsc((v) => !v)}
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
                {filtered.map((order) => {
                  const kode    = order.kode_pesanan ? `#${order.kode_pesanan}` : formatCode(order.id);
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
                              {first.produk?.nama_produk || "Produk Terhapus"}
                              <span className="text-neutral-400 ml-1 text-xs">({first.kuantitas}x)</span>
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

                      {/* Status Kirim — dropdown jika lunas */}
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
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
              Menampilkan {orders.length > 0 ? page * PAGE_SIZE + 1 : 0} - {page * PAGE_SIZE + orders.length} dari {totalCount} pesanan
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-white font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detail */}
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
