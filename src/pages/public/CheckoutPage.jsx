// src/pages/public/CheckoutPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CheckoutForm, { getPendingPayment, clearPendingPayment } from "../../components/CheckoutForm";
import { CheckCircle2, Clock, CreditCard, X } from "lucide-react";
import { formatRupiah } from "../../utils/formatCurrency";
import { loadSnap } from "../../utils/loadSnap";

/* ─── Banner Pesanan Pending ────────────────────────────────── */
function PendingPaymentBanner({ pending, onPayNow, onDismiss }) {
  if (!pending) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
      <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <Clock size={20} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-neutral-900 text-sm">Ada pesanan yang belum dibayar</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Pesanan <span className="font-semibold text-neutral-700">{pending.kode}</span>
            {pending.total ? ` · ${formatRupiah(pending.total)}` : ""}
            {" "}— belum selesai dibayar.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onPayNow}
            className="flex items-center gap-1.5 bg-[#E77F86] hover:bg-[#D66D74] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors"
          >
            <CreditCard size={14} />
            Lanjutkan Bayar
          </button>
          <button
            onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const [completedOrderId, setCompletedOrderId] = useState(null);
  const [pendingPayment, setPendingPayment] = useState(null);

  useEffect(() => {
    const pending = getPendingPayment();
    if (pending) setPendingPayment(pending);
  }, []);

  /* Buka Snap dengan token pending */
  async function handlePayNow() {
    if (!pendingPayment) return;

    try {
      await loadSnap();
    } catch (err) {
      console.error(err);
      // Tidak ada state error di sini, biarkan user coba lagi dari banner
      return;
    }

    window.snap.pay(pendingPayment.snapToken, {
      onSuccess: () => {
        clearPendingPayment();
        setPendingPayment(null);
        setCompletedOrderId(pendingPayment.kode);
      },
      onPending: () => {
        clearPendingPayment();
        setPendingPayment(null);
        setCompletedOrderId(pendingPayment.kode);
      },
      onError: () => {
        // Biarkan banner tetap tampil
      },
      onClose: () => {
        // Tetap di halaman, banner masih ada
      },
    });
  }

  function handleDismiss() {
    clearPendingPayment();
    setPendingPayment(null);
  }

  /* Halaman sukses setelah bayar */
  if (completedOrderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <CheckCircle2 className="mx-auto text-success" size={64} />
          <h1 className="mt-4 font-display text-xl font-bold text-neutral-900">
            Pesanan Diterima!
          </h1>
          <p className="mt-2 font-body text-sm text-neutral-500">
            Simpan <b>Kode Pesanan</b> berikut untuk mengecek status pesanan Anda:
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-neutral-200/50 p-3">
            <span className="font-mono text-xl font-bold tracking-widest text-primary">
              {completedOrderId}
            </span>
          </div>
          <button
            onClick={() => navigate("/cek-pesanan")}
            className="mt-6 w-full rounded-xl bg-primary py-3 font-body font-semibold text-white hover:bg-primary-dark"
          >
            Cek Status Pesanan
          </button>
          <button
            onClick={() => navigate("/")}
            className="mt-2 w-full rounded-xl border border-neutral-200 py-3 font-body font-semibold text-neutral-900 hover:bg-neutral-200/50"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <PendingPaymentBanner
        pending={pendingPayment}
        onPayNow={handlePayNow}
        onDismiss={handleDismiss}
      />
      <CheckoutForm
        onBack={() => navigate("/")}
        onSuccess={(orderId) => {
          setPendingPayment(null);
          setCompletedOrderId(orderId);
        }}
      />
    </div>
  );
}
