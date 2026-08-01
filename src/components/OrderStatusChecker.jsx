// src/components/OrderStatusChecker.jsx
import { useState, useEffect } from "react";
import { statusLabel, fulfillmentLabel } from "../constants/orderStatus";
import { formatRupiah } from "../utils/formatCurrency";
import { CreditCard, Loader2, ChefHat, ShoppingBag, CheckCircle2, AlertCircle, XCircle, History, ChevronRight } from "lucide-react";
import { clearPendingPayment } from "./CheckoutForm";
import { loadSnap } from "../utils/loadSnap";
import { getOrderHistory } from "../utils/storage";

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
      <div className="flex flex-col items-center justify-center py-10 text-[#D63E4D] bg-[#fae4e8]/30">
        <div className="w-16 h-16 rounded-full bg-[#fae4e8] flex items-center justify-center mb-3">
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
        <div className="absolute left-[10%] right-[10%] top-6 -translate-y-1/2 h-[3px] bg-[#EADFDB] z-0"></div>
        
        {/* Garis Merah Progress (Solid) */}
        <div 
           className="absolute left-[10%] top-6 -translate-y-1/2 h-[3px] bg-[#D63E4D] z-0 transition-all duration-700 ease-in-out" 
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
                  activeOrPast ? "bg-[#D63E4D] text-white shadow-sm" : "bg-white border-2 border-[#EADFDB] text-[#8C8380]"
                } ${step.isActive ? "ring-[10px] ring-[#fae4e8] z-20" : "z-10 scale-90"}`}>
                  
                  {step.isActive && (
                    <div className="absolute inset-0 rounded-full bg-[#D63E4D] opacity-20 animate-ping" style={{ transform: 'scale(1.2)' }}></div>
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
                    <span className="text-[10px] font-bold text-[#D63E4D] bg-[#fae4e8] px-3 py-1 rounded-full whitespace-nowrap">
                      Sekarang
                    </span>
                    {step.id === 2 && timeLeft && (
                      <span className="text-[9px] text-[#D63E4D] font-bold mt-1.5 whitespace-nowrap bg-white border border-[#fae4e8] px-2 py-0.5 rounded-md shadow-sm">
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

export default function OrderStatusChecker() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Muat riwayat pesanan dari perangkat
  useEffect(() => {
    const savedOrders = getOrderHistory();
    setHistory(savedOrders);

    // Legacy fallback
    const saved = localStorage.getItem("clucky_last_order");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.kode && data.hp) {
          setOrderId(data.kode);
          setPhone(data.hp);
        }
      } catch { /* ignore */ }
    }
  }, []);

  function handleHistoryClick(order) {
    setOrderId(order.kode);
    setPhone(order.hp);
    performCheck(order.kode, order.hp);
  }

  async function performCheck(kode, noHp) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ kode_pesanan: kode, customer_phone: noHp }),
        },
      );
      const data = await res.json();
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

  function handleCheck(e) {
    e.preventDefault();
    if (!orderId || !phone) return;
    performCheck(orderId.trim(), phone.trim());
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

    window.snap.pay(result.snap_token, {
      onSuccess: () => {
        clearPendingPayment();
        setPayLoading(false);
        performCheck(orderId.trim(), phone.trim());
      },
      onPending: () => {
        clearPendingPayment();
        setPayLoading(false);
        performCheck(orderId.trim(), phone.trim());
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
      {/* Form Cek Pesanan (Horizontal) */}
      <form onSubmit={handleCheck} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 max-w-2xl mx-auto">
        <input
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Kode Pesanan"
          className="w-full sm:w-[200px] border border-neutral-200 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-[#D63E4D] uppercase text-sm bg-white"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Nomor HP"
          className="w-full sm:w-[220px] border border-neutral-200 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-[#D63E4D] text-sm bg-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-[120px] bg-[#D63E4D] hover:bg-[#c03544] disabled:opacity-50 text-white font-bold py-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D63E4D] focus-visible:ring-offset-2 flex items-center justify-center gap-2 transition-colors"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Mencari..." : "Cek"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-[#D63E4D] bg-[#fae4e8]/50 border border-[#fae4e8] rounded-lg p-3 mb-6 max-w-2xl mx-auto text-center">
          {error}
        </p>
      )}

      {/* Daftar Riwayat Pesanan (muncul jika belum ada hasil pencarian) */}
      {!result && !loading && history.length > 0 && (
        <div className="max-w-2xl mx-auto mt-10">
          <div className="flex items-center gap-2 mb-4">
            <History size={20} className="text-neutral-500" />
            <h3 className="font-display font-bold text-lg text-neutral-900">Riwayat Pesanan Anda</h3>
          </div>
          <div className="space-y-3">
            {history.map((order, idx) => (
              <div 
                key={idx}
                onClick={() => handleHistoryClick(order)}
                className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-[#D63E4D]/50 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="font-mono font-bold text-neutral-900">{order.kode}</p>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {new Date(order.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute:"2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-neutral-900">{formatRupiah(order.total)}</span>
                  <ChevronRight size={20} className="text-neutral-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="border border-neutral-200 rounded-3xl overflow-hidden bg-white shadow-sm">
          {/* Header */}
          <div className="px-8 py-5 flex items-center justify-between border-b border-neutral-100 bg-white">
            <span className="text-base font-bold text-neutral-800">Detail Pesanan</span>
            <span className="font-mono text-sm font-bold text-[#D63E4D] bg-[#fae4e8] px-4 py-1.5 rounded-lg">
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
                <div key={idx} className="flex justify-between text-base text-neutral-800 items-center">
                  <span className="font-medium">{item.product_name} <span className="text-neutral-400 ml-1">× {item.qty}</span></span>
                  <span className="font-bold">{formatRupiah(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-neutral-100 w-full my-2"></div>

            {/* Total */}
            <div className="flex justify-between items-center font-bold">
              <span className="text-lg text-neutral-900">Total Pembayaran</span>
              <span className="text-2xl text-[#D63E4D]">{formatRupiah(result.total_amount)}</span>
            </div>

            {/* Tombol bayar — hanya muncul jika masih pending & snap_token tersedia */}
            {result.status === "menunggu_pembayaran" && result.snap_token && (
              <div className="pt-4">
                <button
                  onClick={handlePayNow}
                  disabled={payLoading}
                  className="w-full flex items-center justify-center gap-2 bg-[#E77F86] hover:bg-[#D66D74] disabled:opacity-60 text-white font-bold text-lg py-4 rounded-2xl transition-colors"
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
              <div className="bg-[#fae4e8]/50 border border-[#fae4e8] rounded-2xl px-6 py-4 text-sm text-[#D63E4D] leading-relaxed text-center mt-4">
                <strong>Token pembayaran sudah kedaluwarsa.</strong> Silakan hubungi admin atau buat pesanan baru.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
