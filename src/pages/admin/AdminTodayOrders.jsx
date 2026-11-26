// src/pages/admin/AdminTodayOrders.jsx
//
// Halaman utama Admin: daftar "Pesanan Hari Ini" + omzet harian.
// Admin memproses pesanan di sini (ubah status). Daftar diperbarui otomatis lewat
// Supabase Realtime (channel bersama dari AdminLayout → ordersStore.lastChangeAt).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ClipboardList, Wallet, Clock, ChefHat } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useOrdersStore } from "../../store/ordersStore";
import { formatRupiah } from "../../utils/formatCurrency";
import FulfillmentDropdown from "../../components/admin/FulfillmentDropdown";
import OrderDetailModal from "../../components/admin/OrderDetailModal";

const PAYMENT_STATUS = {
  menunggu_pembayaran: { label: "Menunggu bayar", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  lunas:               { label: "Lunas",          badge: "bg-green-100 text-green-700 border-green-200" },
  kadaluarsa:          { label: "Kedaluwarsa",    badge: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  dibatalkan:          { label: "Dibatalkan",     badge: "bg-red-100 text-red-600 border-red-200" },
  ditolak:             { label: "Ditolak",        badge: "bg-red-100 text-red-600 border-red-200" },
  dikembalikan:        { label: "Dikembalikan",   badge: "bg-blue-100 text-blue-600 border-blue-200" },
};

const jam = (iso) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

/** Awal hari ini (00:00 waktu perangkat) dalam ISO. */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-surface px-4 py-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={18} />
      </span>
      <div>
        <p className="font-display text-lg font-bold text-neutral-900 leading-tight">{value}</p>
        <p className="text-[11px] text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

export default function AdminTodayOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const lastChangeAt = useOrdersStore((s) => s.lastChangeAt);
  const updateFulfillmentInStore = useOrdersStore((s) => s.updateFulfillment);

  const fetchToday = useCallback(async () => {
    const since = startOfToday();
    // Pesanan yang dibuat hari ini ATAU dibayar hari ini (agar omzet harian tidak terlewat)
    const { data, error } = await supabase
      .from("pesanan")
      .select("*, detail_pesanan(nama_produk, jumlah, subtotal, varian_terpilih)")
      .or(`created_at.gte.${since},dibayar_pada.gte.${since}`)
      .order("created_at", { ascending: false });
    if (error) console.error("[PesananHariIni] gagal memuat:", error.message);
    setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday, lastChangeAt]);

  // Jaga modal detail tetap sinkron saat data berubah
  useEffect(() => {
    if (!selected) return;
    const fresh = orders.find((o) => o.id === selected.id);
    if (fresh) setSelected((prev) => ({ ...prev, ...fresh }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  async function handleUpdate(orderId, status) {
    setLoadingId(orderId);
    const error = await updateFulfillmentInStore(orderId, status);
    setLoadingId(null);
    if (!error) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status_pesanan: status } : o)));
    }
  }

  const since = startOfToday();
  const stats = useMemo(() => {
    const paidToday = orders.filter(
      (o) => o.status_pembayaran === "lunas" && new Date(o.dibayar_pada || o.created_at) >= new Date(since),
    );
    return {
      omzet: paidToday.reduce((s, o) => s + Number(o.total_harga), 0),
      lunas: paidToday.length,
      menunggu: orders.filter((o) => o.status_pembayaran === "menunggu_pembayaran").length,
      diproses: orders.filter((o) => o.status_pembayaran === "lunas" && o.status_pesanan === "diproses").length,
    };
  }, [orders, since]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-neutral-900">Pesanan Hari Ini</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} label="Omzet harian" value={formatRupiah(stats.omzet)} tone="bg-green-100 text-green-700" />
        <Stat icon={ClipboardList} label="Pesanan lunas" value={stats.lunas} tone="bg-primary/10 text-primary" />
        <Stat icon={ChefHat} label="Perlu diproses" value={stats.diproses} tone="bg-amber-100 text-amber-700" />
        <Stat icon={Clock} label="Menunggu bayar" value={stats.menunggu} tone="bg-neutral-100 text-neutral-600" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-surface py-16 text-center">
          <ClipboardList className="mx-auto mb-3 text-neutral-300" size={36} />
          <p className="font-semibold text-neutral-700">Belum ada pesanan hari ini</p>
          <p className="text-sm text-neutral-400">Pesanan baru akan muncul otomatis.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const ps = PAYMENT_STATUS[o.status_pembayaran] || {};
            const first = o.detail_pesanan?.[0];
            const extra = (o.detail_pesanan?.length ?? 0) - 1;
            return (
              <li key={o.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(o)}
                  onKeyDown={(e) => { if (e.key === "Enter") setSelected(o); }}
                  className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-surface p-4 transition-shadow hover:shadow-sm cursor-pointer sm:flex-row sm:items-center"
                >
                  <div className="sm:w-36 shrink-0">
                    <p className="font-mono text-xs font-bold text-neutral-900">#{o.kode_pesanan}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{jam(o.created_at)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-800 text-sm truncate">{o.nama_pelanggan}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {first ? `${first.nama_produk} (${first.jumlah}x)` : "—"}
                      {extra > 0 && ` +${extra} lainnya`}
                    </p>
                    {o.catatan && <p className="text-[11px] text-amber-600 truncate">📝 {o.catatan}</p>}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className="font-bold text-neutral-900 text-sm whitespace-nowrap">{formatRupiah(o.total_harga)}</span>
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${ps.badge}`}>
                      {ps.label}
                    </span>
                    <div className="w-36" onClick={(e) => e.stopPropagation()}>
                      {o.status_pembayaran === "lunas" ? (
                        <FulfillmentDropdown order={o} onUpdate={handleUpdate} loadingId={loadingId} />
                      ) : (
                        <span className="text-xs italic text-neutral-400">Status terkunci</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <OrderDetailModal
          order={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          loadingId={loadingId}
        />
      )}
    </div>
  );
}
