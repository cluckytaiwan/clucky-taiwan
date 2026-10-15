// src/pages/admin/AdminDashboard.jsx
// Halaman Dasbor — laporan omzet, grafik tren, produk terlaris, ringkasan stok, transaksi terbaru
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useOrdersStore } from "../../store/ordersStore";
import { formatRupiah } from "../../utils/formatCurrency";
import { downloadExcel } from "../../utils/exportExcel";
import {
  TrendingUp, ShoppingBag, Package, AlertTriangle,
  Download, Loader2, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";

/* ─── Helpers ─────────────────────────────────────────────── */
function formatDate(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).replace(".", ":");
}

function formatCode(id, kode) {
  return kode ? `#${kode}` : `#${String(id).padStart(4, "0")}`;
}

// Helper nama bulan dalam Bahasa Indonesia
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Menghitung rentang tanggal berdasarkan preset
// selectedMonth: { year, month } — dipakai saat preset === "bulanan"
function getDateRange(preset, selectedMonth) {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (preset === "harian") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end: todayEnd };
  }

  if (preset === "bulanan") {
    const { year, month } = selectedMonth;
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    // Akhir bulan: hari terakhir bulan yang dipilih (atau hari ini jika bulan ini)
    const isCurrentMonth =
      year === now.getFullYear() && month === now.getMonth();
    const end = isCurrentMonth
      ? todayEnd
      : new Date(year, month + 1, 0, 23, 59, 59, 999); // hari terakhir bulan
    return { start, end };
  }

  return null; // "semua" — tanpa filter tanggal
}

const PRESET_OPTIONS = [
  { key: "harian",  label: "Harian" },
  { key: "bulanan", label: "Bulanan" },
  { key: "semua",   label: "Semua" },
];

const PAYMENT_STATUS_LABEL = {
  menunggu_pembayaran: "Menunggu",
  lunas:               "Lunas",
  kadaluarsa:          "Kedaluwarsa",
  dibatalkan:          "Dibatalkan",
  ditolak:             "Ditolak",
  dikembalikan:        "Dikembalikan",
};

/* ─── Komponen Kartu KPI ──────────────────────────────────── */
function KpiCard({ icon, label, value, sub, color, loading }) {
  return (
    <div className="bg-surface border border-neutral-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-500 font-medium mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-24 bg-neutral-100 rounded-lg animate-pulse" />
        ) : (
          <p className="font-bold text-neutral-900 font-display text-xl leading-tight truncate">{value}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Custom Tooltip Grafik ────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-neutral-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">
          {p.name === "omzet" ? formatRupiah(p.value) : `${p.value} transaksi`}
        </p>
      ))}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function AdminDashboard() {
  const [preset, setPreset]       = useState("bulanan");
  const [orders, setOrders]       = useState([]);
  const [allLunas, setAllLunas]   = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(false);

  // State bulan yang dipilih (untuk preset Bulanan)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(), // 0-indexed
  });

  const range = useMemo(
    () => getDateRange(preset, selectedMonth),
    [preset, selectedMonth]
  );

  // Navigasi bulan: batasi maksimum ke bulan sekarang
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const isCurrentMonth =
    selectedMonth.year === currentYear && selectedMonth.month === currentMonth;

  function prevMonth() {
    setSelectedMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    setSelectedMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  }

  // ── Sync dengan shared store ──────────────────────────────
  // Saat ada perubahan realtime (INSERT/UPDATE/DELETE pesanan),
  // store memperbarui lastChangeAt → Dashboard otomatis re-fetch aggregasi
  const lastChangeAt = useOrdersStore(s => s.lastChangeAt);
  const isMounted = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Ambil SEMUA pesanan lunas — filter tanggal diterapkan client-side
    // sehingga aman meski kolom dibayar_pada NULL atau belum ada.
    // Fallback: gunakan created_at jika dibayar_pada tidak tersedia.
    const qOrders = supabase
      .from("pesanan")
      .select("id, kode_pesanan, nama_pelanggan, total_harga, status_pembayaran, status_pesanan, dibayar_pada, created_at, detail_pesanan(produk_id, nama_produk, jumlah, subtotal)")
      .eq("status_pembayaran", "lunas")
      .order("created_at", { ascending: false });

    // Produk untuk ringkasan stok
    const qProd = supabase
      .from("produk")
      .select("id, nama_produk, stok, aktif")
      .order("stok", { ascending: true });

    const [{ data: allLunasData, error: ordErr }, { data: prodData }] =
      await Promise.all([qOrders, qProd]);

    if (ordErr) {
      console.error("[Dashboard] Gagal fetch pesanan:", ordErr.message);
    }

    const rawOrders = allLunasData || [];

    // ── Filter client-side berdasarkan preset & selectedMonth ──────
    // Gunakan dibayar_pada; jika NULL → fallback ke created_at
    const filtered = range
      ? rawOrders.filter(o => {
          const ts = new Date(o.dibayar_pada ?? o.created_at);
          return ts >= range.start && ts <= range.end;
        })
      : rawOrders;

    setOrders(filtered);          // data dalam periode → untuk grafik & tabel
    setAllLunas(rawOrders);       // semua lunas → untuk KPI total keseluruhan
    setProducts(prodData || []);
    setLoading(false);
  }, [range]);


  useEffect(() => { fetchData(); }, [fetchData]);

  // Watcher: re-fetch aggregasi saat store sinyal perubahan realtime
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (lastChangeAt === null) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChangeAt]);


  /* ─── KPI Kalkulasi ─── */
  const totalOmzet        = orders.reduce((s, o) => s + Number(o.total_harga), 0);
  const totalTransaksi    = orders.length;
  const omzetAll          = allLunas.reduce((s, o) => s + Number(o.total_harga), 0);
  const lowStockCount     = products.filter(p => p.stok <= 10 && p.aktif).length;
  const outOfStockCount   = products.filter(p => p.stok === 0 && p.aktif).length;

  /* ─── Produk Terlaris ─── */
  const topProducts = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      (o.detail_pesanan || []).forEach(dp => {
        const key = dp.produk_id || dp.nama_produk;
        if (!map[key]) map[key] = { name: dp.nama_produk, qty: 0, rev: 0 };
        map[key].qty += dp.jumlah;
        map[key].rev += Number(dp.subtotal);
      });
    });
    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [orders]);

  /* ─── Data Grafik Tren ─── */
  const trendData = useMemo(() => {
    const map = {};
    const formatKey = (iso) => {
      const d = new Date(iso);
      if (preset === "harian") {
        const h = String(d.getHours()).padStart(2, "0");
        return `${h}:00`;
      }
      if (preset === "bulanan") {
        return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      }
      // semua: per bulan & tahun
      return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    };
    orders.forEach(o => {
      const key = formatKey(o.dibayar_pada || o.created_at);
      if (!map[key]) map[key] = { label: key, omzet: 0, transaksi: 0 };
      map[key].omzet += Number(o.total_harga);
      map[key].transaksi += 1;
    });
    return Object.values(map).reverse();
  }, [orders, preset]);


  /* ─── Transaksi Terbaru (10 terakhir toko secara global) ─── */
  const recentOrders = allLunas.slice(0, 10);

  /* ─── Ekspor Excel ─── */
  async function handleExport() {
    setExporting(true);
    const presetLabel = PRESET_OPTIONS.find(p => p.key === preset)?.label || preset;
    const filename = `laporan-omzet-${presetLabel.toLowerCase().replace(" ", "-")}-${new Date().toISOString().slice(0, 10)}`;

    const rows = orders.map(o => ({
      kode: o.kode_pesanan ? `#${o.kode_pesanan}` : `#${String(o.id).slice(0, 8)}`,
      tanggal: (o.dibayar_pada || o.created_at)
        ? new Date(o.dibayar_pada || o.created_at).toLocaleString("id-ID")
        : "-",
      pelanggan: o.nama_pelanggan,
      items: (o.detail_pesanan || []).map(dp => `${dp.nama_produk} (${dp.jumlah}x)`).join("; "),
      total: Number(o.total_harga),
      status_bayar: PAYMENT_STATUS_LABEL[o.status_pembayaran] || o.status_pembayaran,
      status_kirim: o.status_pesanan || "-",
    }));

    await downloadExcel({
      rows,
      headers: ["Kode Pesanan", "Tgl Bayar", "Pelanggan", "Item", "Total (Rp)", "Status Bayar", "Status Kirim"],
      keys:    ["kode", "tanggal", "pelanggan", "items", "total", "status_bayar", "status_kirim"],
      filename,
      sheetName: `Omzet ${presetLabel}`,
    });
    setExporting(false);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-neutral-900">Dasbor Laporan</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Ringkasan omzet dan performa penjualan</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Preset */}
          <div className="flex bg-neutral-100 rounded-xl p-1 gap-1">
            {PRESET_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setPreset(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  preset === opt.key
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Month Picker — hanya muncul saat preset Bulanan */}
          {preset === "bulanan" && (
            <div className="flex items-center gap-1 bg-neutral-100 rounded-xl px-1 py-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-neutral-500 hover:bg-white hover:text-neutral-800 hover:shadow-sm transition-all"
                title="Bulan sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold text-neutral-800 px-2 min-w-[130px] text-center">
                {BULAN_ID[selectedMonth.month]} {selectedMonth.year}
              </span>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth}
                className="p-1.5 rounded-lg text-neutral-500 hover:bg-white hover:text-neutral-800 hover:shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Bulan berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}


          {/* Tombol Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh data"
            className="p-2 rounded-xl bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {/* Tombol Ekspor */}
          <button
            onClick={handleExport}
            disabled={exporting || loading || orders.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Ekspor Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp size={20} />}
          label={`Total Omzet (${PRESET_OPTIONS.find(p => p.key === preset)?.label})`}
          value={formatRupiah(totalOmzet)}
          sub={
            preset === "bulanan"
              ? `Periode ${BULAN_ID[selectedMonth.month]} ${selectedMonth.year} (${totalTransaksi} transaksi)`
              : preset === "harian"
              ? `Hari ini (${totalTransaksi} transaksi)`
              : `Total dari ${totalTransaksi} transaksi`
          }
          color="bg-green-100 text-green-600"
          loading={loading}
        />
        <KpiCard
          icon={<ShoppingBag size={20} />}
          label={`Transaksi (${PRESET_OPTIONS.find(p => p.key === preset)?.label})`}
          value={totalTransaksi.toLocaleString("id-ID")}
          sub={totalTransaksi > 0 ? `Rata-rata ${formatRupiah(totalOmzet / totalTransaksi)}/transaksi` : "Tidak ada transaksi di periode ini"}
          color="bg-blue-100 text-blue-600"
          loading={loading}
        />
        <KpiCard
          icon={<Package size={20} />}
          label="Total Omzet Keseluruhan"
          value={formatRupiah(omzetAll)}
          sub={`${allLunas.length} transaksi lunas (Semua waktu)`}
          color="bg-purple-100 text-purple-600"
          loading={loading}
        />
        <KpiCard
          icon={<AlertTriangle size={20} />}
          label="Stok Rendah / Habis"
          value={`${lowStockCount} produk`}
          sub={outOfStockCount > 0 ? `${outOfStockCount} produk habis stok` : "Semua stok aman"}
          color={lowStockCount > 0 ? "bg-amber-100 text-amber-600" : "bg-neutral-100 text-neutral-400"}
          loading={loading}
        />
      </div>

      {/* Notice jika periode kosong tapi toko memiliki transaksi lunas lainnya */}
      {orders.length === 0 && !loading && preset !== "semua" && allLunas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-amber-800">
          <span>
            Belum ada transaksi lunas pada periode {preset === "bulanan" ? `${BULAN_ID[selectedMonth.month]} ${selectedMonth.year}` : "hari ini"}.
            Toko Anda memiliki total <strong>{allLunas.length} transaksi lunas</strong> ({formatRupiah(omzetAll)}).
          </span>
          <button
            onClick={() => setPreset("semua")}
            className="font-bold text-amber-900 underline hover:text-primary transition-colors ml-3 shrink-0"
          >
            Lihat Semua Periode
          </button>
        </div>
      )}

      {/* Grafik + Produk Terlaris */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Grafik Tren Omzet */}
        <div className="xl:col-span-2 bg-surface border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-neutral-900">Tren Omzet</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Berdasarkan tanggal pembayaran</p>
            </div>
            <TrendingUp size={16} className="text-neutral-300" />
          </div>
          {loading ? (
            <div className="h-56 bg-neutral-50 rounded-xl animate-pulse" />
          ) : trendData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-neutral-300 text-sm">
              Tidak ada data untuk periode ini
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOmzet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#D6293B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D6293B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#B3A296" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#B3A296" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="omzet"
                  name="omzet"
                  stroke="#D6293B"
                  strokeWidth={2.5}
                  fill="url(#colorOmzet)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#D6293B", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Produk Terlaris */}
        <div className="bg-surface border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-neutral-900 mb-4">Produk Terlaris</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-neutral-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-neutral-300 text-center py-10">Tidak ada data</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const maxQty = topProducts[0].qty;
                const pct = maxQty > 0 ? (p.qty / maxQty) * 100 : 0;
                return (
                  <div key={p.name}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-neutral-400 w-4 shrink-0">#{i + 1}</span>
                        <p className="text-sm font-medium text-neutral-800 truncate">{p.name}</p>
                      </div>
                      <span className="text-xs font-bold text-neutral-600 shrink-0 ml-2">{p.qty} unit</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grafik Transaksi Harian + Ringkasan Stok */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Grafik Jumlah Transaksi */}
        <div className="xl:col-span-2 bg-surface border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-neutral-900 mb-4">Jumlah Transaksi</h2>
          {loading ? (
            <div className="h-44 bg-neutral-50 rounded-xl animate-pulse" />
          ) : trendData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-neutral-300 text-sm">
              Tidak ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#B3A296" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#B3A296" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="transaksi"
                  name="transaksi"
                  fill="#F5A623"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ringkasan Stok */}
        <div className="bg-surface border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-neutral-900 mb-1">Ringkasan Stok</h2>
          <p className="text-xs text-neutral-400 mb-4">Produk aktif dengan stok rendah</p>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-9 bg-neutral-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Summary baris */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Habis", val: products.filter(p => p.stok === 0 && p.aktif).length, color: "text-danger" },
                  { label: "Rendah", val: products.filter(p => p.stok > 0 && p.stok <= 10 && p.aktif).length, color: "text-amber-600" },
                  { label: "Aman", val: products.filter(p => p.stok > 10 && p.aktif).length, color: "text-success" },
                ].map(s => (
                  <div key={s.label} className="bg-neutral-50 rounded-xl p-2 text-center">
                    <p className={`font-bold text-lg ${s.color}`}>{s.val}</p>
                    <p className="text-[10px] text-neutral-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* List produk stok rendah */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {products.filter(p => p.stok <= 10 && p.aktif).length === 0 ? (
                  <p className="text-sm text-neutral-300 text-center py-4">Semua stok aman ✓</p>
                ) : (
                  products.filter(p => p.stok <= 10 && p.aktif).slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <p className="text-sm text-neutral-700 truncate flex-1">{p.nama_produk}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        p.stok === 0
                          ? "bg-red-100 text-danger"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {p.stok === 0 ? "Habis" : `${p.stok} unit`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transaksi Terbaru */}
      <div className="bg-surface border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-neutral-900">Transaksi Terbaru (Lunas)</h2>
            <p className="text-xs text-neutral-400 mt-0.5">10 transaksi lunas terakhir di seluruh toko</p>
          </div>
          <a
            href="/admin/sales"
            className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            Lihat Semua Pesanan →
          </a>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-neutral-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <p className="text-center py-12 text-neutral-400 text-sm">Belum ada transaksi lunas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100 text-[11px] uppercase tracking-widest text-neutral-400 font-bold">
                  <th className="text-left px-5 py-3">Kode</th>
                  <th className="text-left px-5 py-3">Pelanggan</th>
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-left px-5 py-3">Tgl Bayar</th>
                  <th className="text-right px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {recentOrders.map(o => {
                  const first = o.detail_pesanan?.[0];
                  const extra = (o.detail_pesanan?.length || 1) - 1;
                  return (
                    <tr key={o.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-neutral-700">
                        {formatCode(o.id, o.kode_pesanan)}
                      </td>
                      <td className="px-5 py-3 font-medium text-neutral-800">{o.nama_pelanggan}</td>
                      <td className="px-5 py-3 text-neutral-500 max-w-[180px]">
                        {first && (
                          <span className="truncate block">
                            {first.nama_produk}
                            {extra > 0 && <span className="text-neutral-300 ml-1">+{extra}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-neutral-400 text-xs whitespace-nowrap">
                        {o.dibayar_pada ? formatDate(o.dibayar_pada) : (o.created_at ? formatDate(o.created_at) : "-")}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-neutral-900 whitespace-nowrap">
                        {formatRupiah(o.total_harga)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
