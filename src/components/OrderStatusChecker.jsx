// src/components/OrderStatusChecker.jsx
import { useState, useEffect, useCallback } from "react";
import { statusLabel, fulfillmentLabel } from "../constants/orderStatus";
import { formatRupiah } from "../utils/formatCurrency";
import { CreditCard, Loader2, ChefHat, ShoppingBag, CheckCircle2, AlertCircle, XCircle, History, ChevronRight, ChevronLeft } from "lucide-react";
import { loadSnap } from "../utils/loadSnap";
import { supabase } from "../lib/supabaseClient";
import { fetchOrderStatus } from "../utils/orderStatusApi";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { STORE_INFO, whatsappLink } from "../config/storeInfo";

/* ─── Komponen Timeline Progress ───────────────────────────── */
function OrderProgress({ status, fulfillmentStatus, paidAt }) {
  const [timeLeft, setTimeLeft] = useState("");
  const isFailed = ["kadaluarsa", "dibatalkan", "ditolak", "dikembalikan"].includes(status);

  useEffect(() => {
    // Hitung estimasi dari waktu pembayaran dikonfirmasi (updated_at), bukan created_at
    if (status === "lunas" && fulfillmentStatus === "diproses" && paidAt) {
      const targetTime = new Date(paidAt).getTime() + 15 * 60000; // 15 menit dari bayar

      const updateTimer = () => {
        const now = new Date().getTime();
        const diff = targetTime - now;

        if (diff <= 0) {
          setTimeLeft("Hampir Siap");
        } else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m}m ${s}d`);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [status, fulfillmentStatus, paidAt]);

  const steps = [
    { 
      id: 1, 
      label: "Menunggu Pembayaran", 
      icon: CreditCard, 
      isActive: status === "menunggu_pembayaran", 
      isPast: status === "lunas" 
    },
    { 
      id: 2, 
      label: "Diproses", 
      icon: ChefHat, 
      isActive: status === "lunas" && fulfillmentStatus === "diproses", 
      isPast: status === "lunas" && ["dikirim", "selesai"].includes(fulfillmentStatus) 
    },
    { 
      id: 3, 
      label: "Siap Diambil", 
      icon: ShoppingBag, 
      isActive: status === "lunas" && fulfillmentStatus === "dikirim", 
      isPast: status === "lunas" && fulfillmentStatus === "selesai" 
    },
    { 
      id: 4, 
      label: "Selesai", 
      icon: CheckCircle2, 
      isActive: status === "lunas" && fulfillmentStatus === "selesai", 
      isPast: false 
    }
  ];

  if (isFailed) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-primary bg-primary/5">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <XCircle size={32} />
        </div>
        <p className="font-bold text-lg">{statusLabel[status]?.text || status}</p>
        <p className="text-xs text-neutral-500 mt-1">Pesanan tidak dapat dilanjutkan.</p>
      </div>
    );
  }

  // Hitung persentase lebar garis progress
  const activeIndex = steps.findIndex(s => s.isActive);
  const solidPercentage = activeIndex === 3 ? 100 : 
                          activeIndex === 2 ? 66.66 : 
                          activeIndex === 1 ? 33.33 : 0;

  return (
    <div className="py-8 px-6 w-full overflow-hidden">
      <p className="text-sm text-neutral-500 font-medium mb-8 px-4">Alur status pesanan Anda:</p>
      <div className="relative max-w-full">
        {/* Garis Abu-abu Dasar */}
        <div className="absolute left-[10%] right-[10%] top-6 -translate-y-1/2 h-[3px] bg-neutral-200 z-0"></div>
        
        {/* Garis Merah Progress (Solid) */}
        <div 
           className="absolute left-[10%] top-6 -translate-y-1/2 h-[3px] bg-primary z-0 transition-all duration-700 ease-in-out" 
           style={{ width: `calc(${solidPercentage}% * 0.8)` }}
        ></div>
        
        {/* Garis Merah Putus-Putus Animasi (Dashed) menuju tahap berikutnya */}
        {activeIndex >= 0 && activeIndex < 3 && (
          <div 
             className="absolute top-6 -translate-y-1/2 h-[3px] animated-dash z-0 transition-all duration-700 ease-in-out" 
             style={{ 
               left: `calc(10% + (${solidPercentage}% * 0.8))`, 
               width: `calc(33.33% * 0.8)` 
             }}
          ></div>
        )}
        
        <div className="flex justify-between relative z-10 px-4">
          {steps.map((step, idx) => {
            // Jika sudah lewat, ganti ikon menjadi centang
            const Icon = step.isPast ? CheckCircle2 : step.icon;
            const activeOrPast = step.isActive || step.isPast;
            
            return (
              <div key={idx} className="flex flex-col items-center w-1/4">
                <div className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-500 ${
                  activeOrPast ? "bg-primary text-white shadow-sm" : "bg-white border-2 border-neutral-200 text-neutral-500"
                } ${step.isActive ? "ring-[10px] ring-primary/10 z-20" : "z-10 scale-90"}`}>
                  
                  {step.isActive && (
                    <div className="absolute inset-0 rounded-full bg-primary opacity-20 animate-ping" style={{ transform: 'scale(1.2)' }}></div>
                  )}
                  
                  <div className="relative z-10 transition-transform duration-500">
                    <Icon size={20} />
                  </div>
                </div>
                
                <div className="mt-7 flex flex-col items-center text-center">
                  <span className={`text-[11px] sm:text-xs leading-tight transition-colors duration-500 ${activeOrPast ? "font-bold text-neutral-900" : "font-medium text-neutral-500"}`}>
                    {step.label}
                  </span>
                  
                  {/* Badge "Sekarang" & Timer */}
                  <div className={`mt-2 flex flex-col items-center transition-all duration-500 ${step.isActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none absolute"}`}>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full whitespace-nowrap">
                      Sekarang
                    </span>
                    {step.id === 2 && timeLeft && (
                      <span className="text-[9px] text-primary font-bold mt-1.5 whitespace-nowrap bg-white border border-primary/15 px-2 py-0.5 rounded-md shadow-sm">
                        Estimasi: {timeLeft}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}

// Filter riwayat pesanan. "Lunas" = semua pesanan yang sudah dibayar (apa pun tahap pengerjaannya).
const GAGAL = ["kadaluarsa", "dibatalkan", "ditolak", "dikembalikan"];
const FILTERS = [
  { id: "semua", label: "Semua", match: () => true },
  { id: "menunggu", label: "Menunggu Bayar", match: (o) => o.status_pembayaran === "menunggu_pembayaran" },
  { id: "lunas", label: "Lunas", match: (o) => o.status_pembayaran === "lunas" },
  { id: "diproses", label: "Diproses", match: (o) => o.status_pembayaran === "lunas" && o.status_pesanan === "diproses" },
  { id: "siap", label: "Siap Diambil", match: (o) => o.status_pembayaran === "lunas" && o.status_pesanan === "dikirim" },
  { id: "selesai", label: "Selesai", match: (o) => o.status_pembayaran === "lunas" && o.status_pesanan === "selesai" },
  { id: "gagal", label: "Dibatalkan", match: (o) => GAGAL.includes(o.status_pembayaran) },
];

export default function OrderStatusChecker() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  // Riwayat pesanan milik akun (dari database), terbaru di atas
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [filter, setFilter] = useState("semua");
  // isLive: true saat koneksi Supabase Realtime aktif
  const [isLive, setIsLive] = useState(false);

  // Pembaruan dari Realtime / pemeriksaan berkala: gabungkan ke pesanan yang tampil
  const handleRealtimeUpdate = useCallback((patch) => {
    setResult((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Berlangganan perubahan pesanan — aktif hanya saat detail pesanan ditampilkan
  useOrderRealtime(
    result ? result.id : null,
    result ? result.kode_pesanan : null,
    handleRealtimeUpdate,
    setIsLive
  );

  // Muat riwayat pesanan akun dari database (RLS: hanya pesanan milik sendiri)
  const loadHistory = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("pesanan")
      .select("id, kode_pesanan, total_harga, created_at, status_pembayaran, status_pesanan")
      .order("created_at", { ascending: false })
      .limit(30);
    if (err) setError("Gagal memuat riwayat pesanan, coba lagi.");
    setHistory(data || []);
    setHistoryLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const activeFilter = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const filteredHistory = history.filter(activeFilter.match);

  function handleHistoryClick(order) {
    performCheck(order.kode_pesanan);
  }

  async function performCheck(kode) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await fetchOrderStatus(kode);
      if (!data.success) {
        setError(data.error?.message || "Pesanan tidak ditemukan");
      } else {
        setResult(data.order);
      }
    } catch {
      setError("Gagal memeriksa pesanan, coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  /* Buka Snap dengan token yang ada di result */
  async function handlePayNow() {
    if (!result?.snap_token) return;
    setPayLoading(true);

    try {
      await loadSnap();
    } catch (err) {
      console.error(err);
      setError("Gagal memuat sistem pembayaran. Pastikan koneksi internet stabil.");
      setPayLoading(false);
      return;
    }

    const kode = result.kode_pesanan;
    window.snap.pay(result.snap_token, {
      onSuccess: () => {
        setPayLoading(false);
        performCheck(kode);
      },
      onPending: () => {
        setPayLoading(false);
        performCheck(kode);
      },
      onError: () => {
        setPayLoading(false);
        setError("Pembayaran gagal, silakan coba lagi.");
      },
      onClose: () => {
        setPayLoading(false);
      },
    });
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      {error && (
        <p className="text-sm text-primary bg-primary/5 border border-primary/15 rounded-lg p-3 mb-6 max-w-2xl mx-auto text-center">
          {error}
        </p>
      )}

      {/* Daftar Riwayat Pesanan — ditampilkan langsung (muncul jika belum ada hasil pencarian) */}
      {!result && !loading && (
        <div className="max-w-2xl mx-auto">
          {historyLoading ? (
            <div className="flex items-center justify-center py-16 text-neutral-400">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : history.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <History size={20} className="text-neutral-500" />
                <h3 className="font-display font-bold text-lg text-neutral-900">Riwayat Pesanan Anda</h3>
              </div>
              {/* Filter status */}
              <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter status pesanan">
                {FILTERS.map((f) => {
                  const count = history.filter(f.match).length;
                  const active = f.id === filter;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(f.id)}
                      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        active ? "border-primary bg-primary text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-primary/40"
                      }`}
                    >
                      {f.label}
                      <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-neutral-400"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {filteredHistory.length === 0 && (
                <p className="rounded-2xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-500">
                  Tidak ada pesanan dengan status “{activeFilter.label}”.
                </p>
              )}
              <div className="space-y-3">
                {filteredHistory.map((order) => (
                  <button
                    type="button"
                    key={order.id}
                    onClick={() => handleHistoryClick(order)}
                    className="w-full text-left bg-white border border-neutral-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div>
                      <p className="font-mono font-bold text-neutral-900">{order.kode_pesanan}</p>
                      <p className="text-sm text-neutral-500 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute:"2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="block font-bold text-neutral-900">{formatRupiah(order.total_harga)}</span>
                        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusLabel[order.status_pembayaran]?.color ?? "bg-neutral-100 text-neutral-500"}`}>
                          {order.status_pembayaran === "lunas"
                            ? (fulfillmentLabel[order.status_pesanan] ?? "Lunas")
                            : (statusLabel[order.status_pembayaran]?.text ?? order.status_pembayaran)}
                        </span>
                      </div>
                      <ChevronRight size={20} className="text-neutral-400" />
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Empty state — belum ada riwayat pesanan */
            <div className="text-center py-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
                <History size={28} className="text-neutral-400" />
              </div>
              <p className="font-body font-semibold text-neutral-700 mb-1">Belum ada riwayat pesanan</p>
              <p className="font-body text-sm text-neutral-500">
                Pesanan yang kamu buat akan muncul di sini.
              </p>
            </div>
          )}
        </div>
      )}

      {result && history.length > 0 && (
        <button
          type="button"
          onClick={() => { setResult(null); setError(""); }}
          className="mb-3 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-neutral-600 hover:text-primary"
        >
          <ChevronLeft size={16} />
          Semua pesanan
        </button>
      )}

      {result && (
        <div className="border border-neutral-200 rounded-3xl overflow-hidden bg-white shadow-sm">
          {/* Header */}
          <div className="px-8 py-5 flex items-center justify-between border-b border-neutral-100 bg-white">
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold text-neutral-800">Detail Pesanan</span>
              {/* Indikator Live — muncul saat Supabase Realtime aktif */}
              {isLive && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live
                </span>
              )}
            </div>
            <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-lg">
              {result.kode_pesanan}
            </span>
          </div>
          
          {/* Timeline Animation Component */}
          <div className="border-b border-neutral-100">
            <OrderProgress status={result.status} fulfillmentStatus={result.fulfillment_status} paidAt={result.updated_at} />
          </div>

          <div className="p-8 space-y-6">
            {/* Items */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Ringkasan Pembelanjaan</p>
              {result.items.map((item, idx) => (
                <div key={idx} className="flex justify-between gap-4 text-base text-neutral-800 items-center">
                  <span className="font-medium">
                    {item.product_name} <span className="text-neutral-400 ml-1">× {item.qty}</span>
                    {item.variant_label && (
                      <span className="block text-xs font-normal text-neutral-500">{item.variant_label}</span>
                    )}
                  </span>
                  <span className="font-bold">{formatRupiah(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-neutral-100 w-full my-2"></div>

            {/* Total */}
            <div className="flex justify-between items-center font-bold">
              <span className="text-lg text-neutral-900">Total Pembayaran</span>
              <span className="text-2xl text-primary">{formatRupiah(result.total_amount)}</span>
            </div>

            {/* Tombol bayar — hanya muncul jika masih pending & snap_token tersedia */}
            {result.status === "menunggu_pembayaran" && result.snap_token && (
              <div className="pt-4">
                <button
                  onClick={handlePayNow}
                  disabled={payLoading}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-bold text-lg py-4 rounded-2xl transition-colors"
                >
                  {payLoading
                    ? <><Loader2 size={20} className="animate-spin" /> Membuka pembayaran…</>
                    : <><CreditCard size={20} /> Lanjutkan Pembayaran</>
                  }
                </button>
              </div>
            )}

            {/* Pesan jika pending tapi token sudah expired */}
            {result.status === "menunggu_pembayaran" && !result.snap_token && (
              <div className="bg-primary/5 border border-primary/15 rounded-2xl px-6 py-4 text-sm text-primary leading-relaxed text-center mt-4">
                <strong>Token pembayaran sudah kedaluwarsa.</strong>{" "}
                {whatsappLink() ? (
                  <a
                    href={whatsappLink(`Halo, token pembayaran pesanan ${result.kode_pesanan} kedaluwarsa.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2"
                  >
                    Hubungi admin via WhatsApp
                  </a>
                ) : (
                  "Silakan hubungi admin"
                )}{" "}
                atau buat pesanan baru.
              </div>
            )}

            {/* Lokasi pengambilan — tampil setelah pesanan dibayar */}
            {result.status === "lunas" && STORE_INFO.address && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-700">
                <p className="font-semibold text-neutral-900">Ambil pesanan di</p>
                <p className="mt-0.5">{STORE_INFO.address}</p>
                {STORE_INFO.mapsUrl && (
                  <a href={STORE_INFO.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold text-primary underline underline-offset-2">
                    Buka di Google Maps
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
