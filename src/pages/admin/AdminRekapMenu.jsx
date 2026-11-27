// src/pages/admin/AdminRekapMenu.jsx
//
// Rekap menu terjual untuk Admin, dengan pilihan periode (bukan hanya harian).
// Hanya pesanan LUNAS yang dihitung, berdasarkan tanggal pembayaran.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UtensilsCrossed, Receipt, Wallet, Trophy } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatRupiah } from "../../utils/formatCurrency";

const PRESETS = [
  { id: "today", label: "Hari ini" },
  { id: "7d", label: "7 hari" },
  { id: "30d", label: "30 hari" },
  { id: "month", label: "Bulan ini" },
  { id: "custom", label: "Kustom" },
];

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const toInput = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const fromInput = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };

function rangeFor(preset, customFrom, customTo) {
  const now = new Date();
  if (preset === "today") return [dayStart(now), dayEnd(now)];
  if (preset === "7d") { const s = new Date(now); s.setDate(s.getDate() - 6); return [dayStart(s), dayEnd(now)]; }
  if (preset === "30d") { const s = new Date(now); s.setDate(s.getDate() - 29); return [dayStart(s), dayEnd(now)]; }
  if (preset === "month") return [dayStart(new Date(now.getFullYear(), now.getMonth(), 1)), dayEnd(now)];
  return [dayStart(fromInput(customFrom)), dayEnd(fromInput(customTo))];
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-surface px-4 py-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span>
      <div>
        <p className="font-display text-lg font-bold text-neutral-900 leading-tight">{value}</p>
        <p className="text-[11px] text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

export default function AdminRekapMenu() {
  const [preset, setPreset] = useState("today");
  const [customFrom, setCustomFrom] = useState(toInput(new Date()));
  const [customTo, setCustomTo] = useState(toInput(new Date()));
  const [rows, setRows] = useState([]);
  const [orderCount, setOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [from, to] = rangeFor(preset, customFrom, customTo);
    if (from > to) { setRows([]); setOrderCount(0); setError("Tanggal awal harus sebelum tanggal akhir."); setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("pesanan")
      .select("id, detail_pesanan(nama_produk, jumlah, subtotal)")
      .eq("status_pembayaran", "lunas")
      .gte("dibayar_pada", from.toISOString())
      .lte("dibayar_pada", to.toISOString())
      .limit(5000);
    if (err) { setError("Gagal memuat rekap. Coba lagi."); setRows([]); setOrderCount(0); setLoading(false); return; }
    const map = new Map();
    for (const o of data || []) {
      for (const d of o.detail_pesanan || []) {
        const cur = map.get(d.nama_produk) || { nama: d.nama_produk, qty: 0, total: 0 };
        cur.qty += d.jumlah;
        cur.total += Number(d.subtotal);
        map.set(d.nama_produk, cur);
      }
    }
    setRows([...map.values()].sort((a, b) => b.qty - a.qty || b.total - a.total));
    setOrderCount((data || []).length);
    setLoading(false);
  }, [preset, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalQty = useMemo(() => rows.reduce((s, r) => s + r.qty, 0), [rows]);
  const totalRp = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);
  const maxQty = rows[0]?.qty || 1;

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-neutral-900">Rekap Menu Terjual</h1>
        <p className="text-sm text-neutral-500">Hanya pesanan yang sudah lunas, berdasarkan tanggal pembayaran.</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              preset === p.id ? "border-primary bg-primary text-white" : "border-neutral-200 bg-surface text-neutral-600 hover:border-primary/40"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customFrom} max={customTo} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} className="rounded-lg border border-neutral-200 bg-surface px-3 py-1.5" />
            <span className="text-neutral-400">s/d</span>
            <input type="date" value={customTo} min={customFrom} onChange={(e) => e.target.value && setCustomTo(e.target.value)} className="rounded-lg border border-neutral-200 bg-surface px-3 py-1.5" />
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={UtensilsCrossed} label="Porsi terjual" value={totalQty} tone="bg-primary/10 text-primary" />
        <Stat icon={Trophy} label="Jenis menu" value={rows.length} tone="bg-amber-100 text-amber-700" />
        <Stat icon={Receipt} label="Pesanan lunas" value={orderCount} tone="bg-green-100 text-green-700" />
        <Stat icon={Wallet} label="Pendapatan menu" value={formatRupiah(totalRp)} tone="bg-blue-100 text-blue-600" />
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-surface">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-neutral-500">Belum ada menu terjual pada periode ini.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Menu</th>
                <th className="px-4 py-3 text-right">Terjual</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.nama} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-semibold text-neutral-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-neutral-800">{r.nama}</p>
                    <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-neutral-100">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(r.qty / maxQty) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-neutral-900">{r.qty}</td>
                  <td className="px-4 py-3 text-right text-neutral-600 hidden sm:table-cell">{formatRupiah(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
