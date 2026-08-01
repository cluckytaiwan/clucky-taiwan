import { useState } from "react";
import { useCartStore } from "../store/cartStore";
import { formatRupiah } from "../utils/formatCurrency";
import { isValidPhoneNumber } from "../utils/validators";
import { User, Phone, MapPin, QrCode, X, Clock, CreditCard } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { loadSnap } from "../utils/loadSnap";
import { saveCustomerProfile, getCustomerProfile, saveOrderToHistory } from "../utils/storage";

const PENDING_KEY = "clucky_pending_payment";
const LAST_ORDER_KEY = "clucky_last_order";

const initialForm = { customer_name: "", customer_phone: "", customer_address: "", customer_notes: "" };

/* ─── Helper localStorage ───────────────────────────────────── */
export function savePendingPayment({ snapToken, kode, hp, orderId, total }) {
  localStorage.setItem(PENDING_KEY, JSON.stringify({ snapToken, kode, hp, orderId, total, savedAt: Date.now() }));
}
export function getPendingPayment() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Anggap expired setelah 23 jam (snap token Midtrans 24 jam)
    if (Date.now() - data.savedAt > 23 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
export function clearPendingPayment() {
  localStorage.removeItem(PENDING_KEY);
}

/* ─── Modal: Snap Ditutup ───────────────────────────────────── */
function SnapClosedModal({ kode, total, onPayNow, onPayLater }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header orange */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 text-base">Pembayaran Belum Selesai</h3>
            <p className="text-sm text-neutral-500 mt-0.5">
              Pesanan <span className="font-semibold text-neutral-700">{kode}</span> sudah tersimpan,
              tapi belum dibayar.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between bg-neutral-50 rounded-xl px-4 py-3 mb-4 border border-neutral-100">
            <span className="text-sm text-neutral-500">Total tagihan</span>
            <span className="font-bold text-neutral-900">{formatRupiah(total)}</span>
          </div>

          <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
            Pesanan akan otomatis <strong>kedaluwarsa</strong> jika tidak dibayar dalam 24 jam.
            Bayar sekarang untuk memastikan pesanan diproses.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={onPayNow}
              className="w-full flex items-center justify-center gap-2 bg-[#E77F86] hover:bg-[#D66D74] text-white font-bold py-3 rounded-xl transition-colors"
            >
              <CreditCard size={18} />
              Bayar Sekarang
            </button>
            <button
              onClick={onPayLater}
              className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 text-sm font-medium hover:bg-neutral-50 transition-colors"
            >
              Bayar Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────── */
export default function CheckoutForm({ onBack, onSuccess }) {
  const { items, getTotal, clearCart } = useCartStore();
  const [form, setForm] = useState(() => {
    const saved = getCustomerProfile();
    return saved || initialForm;
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [pendingModal, setPendingModal] = useState(null); // { snapToken, kode, orderId, phone, total }

  function validate() {
    const e = {};
    if (!form.customer_name.trim() || form.customer_name.trim().length < 3) {
      e.customer_name = "Nama minimal 3 karakter";
    }
    if (!isValidPhoneNumber(form.customer_phone)) {
      e.customer_phone = "Format nomor HP tidak valid (contoh: 081234567890)";
    }
    if (!form.customer_address.trim() || form.customer_address.trim().length < 10) {
      e.customer_address = "Alamat terlalu singkat, mohon lengkapi";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* Buka Snap dengan token yang diberikan */
  async function openSnap({ snapToken, kode, orderId, phone, total }) {
    try {
      await loadSnap();
    } catch (err) {
      console.error(err);
      setServerError("Gagal memuat sistem pembayaran. Pastikan koneksi internet stabil.");
      return;
    }

    const channel = supabase
      .channel(`payment-check-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pesanan", filter: `id=eq.${orderId}` },
        (payload) => {
          if (payload.new.status_pembayaran === "lunas") {
            if (window.snap && typeof window.snap.hide === "function") window.snap.hide();
            localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ kode, hp: phone }));
            saveOrderToHistory({ kode, hp: phone, total, date: new Date().toISOString() });
            saveCustomerProfile(form);
            clearPendingPayment();
            supabase.removeChannel(channel);
            clearCart();
            onSuccess(kode);
          }
        }
      )
      .subscribe();

    window.snap.pay(snapToken, {
      onSuccess: () => {
        localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ kode, hp: phone }));
        saveOrderToHistory({ kode, hp: phone, total, date: new Date().toISOString() });
        saveCustomerProfile(form);
        clearPendingPayment();
        supabase.removeChannel(channel);
        clearCart();
        onSuccess(kode);
      },
      onPending: () => {
        localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ kode, hp: phone }));
        saveOrderToHistory({ kode, hp: phone, total, date: new Date().toISOString() });
        saveCustomerProfile(form);
        clearPendingPayment();
        supabase.removeChannel(channel);
        clearCart();
        onSuccess(kode);
      },
      onError: () => {
        supabase.removeChannel(channel);
        setServerError("Pembayaran gagal, silakan coba lagi.");
      },
      onClose: () => {
        supabase.removeChannel(channel);
        // Simpan ke localStorage dan tampilkan modal
        savePendingPayment({ snapToken, kode, hp: phone, orderId, total });
        setPendingModal({ snapToken, kode, orderId, phone, total });
      },
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    
    // Prevent double-submit
    if (loading) return;
    
    if (!validate()) return;
    if (items.length === 0) { setServerError("Keranjang kosong"); return; }

    setLoading(true);
    try {
      // 1. Pre-flight check stok terbaru
      const productIds = items.map((i) => i.product_id || i.id); // handle backward compatibility id
      const { data: stockData, error: stockError } = await supabase
        .from("produk")
        .select("id, stok, aktif")
        .in("id", productIds);

      if (stockError) throw stockError;

      const stockErrors = [];
      for (const item of items) {
        const itemId = item.product_id || item.id;
        const current = stockData?.find((p) => p.id === itemId);
        if (!current?.aktif) stockErrors.push(`"${item.name}" tidak lagi tersedia`);
        else if (current.stok < item.qty) {
          stockErrors.push(`Stok "${item.name}" sisa ${current.stok}`);
        }
      }

      if (stockErrors.length > 0) {
        setServerError(`Maaf, pesanan gagal: ${stockErrors.join(", ")}`);
        setLoading(false);
        return;
      }

      // 2. Buat pesanan (Edge Function)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            customer_name: form.customer_name.trim(),
            customer_phone: form.customer_phone.trim(),
            customer_address: form.customer_address.trim(),
            customer_notes: form.customer_notes.trim(),
            items: items.map((item) => ({
              product_id: item.product_id,
              qty: item.qty,
              variant_ids: item.variant_ids ?? [], // varian yang dipilih (kosong jika produk tanpa varian)
            })),
          }),
        },
      );

      const data = await res.json();

      if (!data.success) {
        setServerError(data.error?.message || "Gagal membuat pesanan");
        setLoading(false);
        return;
      }

      // Kosongkan keranjang karena pesanan SUDAH MASUK ke database dengan sukses
      clearCart();

      openSnap({
        snapToken: data.snap_token,
        kode: data.kode_pesanan,
        orderId: data.order_id,
        phone: form.customer_phone.trim(),
        total: data.total_amount,
      });
    } catch (err) {
      console.error(err);
      setServerError("Terjadi kesalahan jaringan, coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  /* Handler modal: Bayar Sekarang */
  function handlePayNow() {
    if (!pendingModal) return;
    setPendingModal(null);
    openSnap(pendingModal);
  }

  /* Handler modal: Bayar Nanti */
  function handlePayLater() {
    setPendingModal(null);
    // Data sudah tersimpan di localStorage oleh onClose, tidak perlu aksi lagi
  }

  return (
    <>
      {/* Modal Snap ditutup */}
      {pendingModal && (
        <SnapClosedModal
          kode={pendingModal.kode}
          total={pendingModal.total}
          onPayNow={handlePayNow}
          onPayLater={handlePayLater}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={onBack} className="text-sm text-neutral-500 mb-6 font-body hover:text-neutral-900 transition-colors">
          &larr; Kembali ke keranjang
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* KOLOM KIRI: Data Pelanggan */}
          <div className="flex-1 space-y-6">
            <div>
              <h2 className="text-2xl font-bold font-display text-neutral-900 mb-1">Data Pelanggan</h2>
              <p className="text-sm text-neutral-500 font-body">Isi data diri Anda untuk pengantaran pesanan.</p>
            </div>

            <div className="space-y-5">
              {/* Nama Pelanggan */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-2">
                  <User size={16} className="text-neutral-500" />
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                  placeholder="Contoh: Budi Santoso"
                />
                {errors.customer_name && <p className="text-xs text-danger mt-1.5">{errors.customer_name}</p>}
              </div>

              {/* Nomor HP */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-2">
                  <Phone size={16} className="text-neutral-500" />
                  Nomor HP
                </label>
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                  placeholder="08xxxxxxxxxx"
                />
                {errors.customer_phone && <p className="text-xs text-danger mt-1.5">{errors.customer_phone}</p>}
              </div>

              {/* Alamat Lengkap */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-2">
                  <MapPin size={16} className="text-neutral-500" />
                  Alamat Lengkap
                </label>
                <textarea
                  value={form.customer_address}
                  onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                  rows={3}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm resize-none"
                  placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan, kota"
                />
                {errors.customer_address && <p className="text-xs text-danger mt-1.5">{errors.customer_address}</p>}
              </div>

              {/* Catatan (Opsional) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-2">
                  Catatan Pesanan <span className="text-neutral-400 font-normal">(Opsional)</span>
                </label>
                <textarea
                  value={form.customer_notes}
                  onChange={(e) => setForm({ ...form, customer_notes: e.target.value })}
                  rows={2}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm resize-none"
                  placeholder="Misal: Jangan terlalu pedas, sambal dipisah..."
                  maxLength={255}
                />
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: Ringkasan Belanja */}
          <div className="w-full lg:w-[420px]">
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm sticky top-24">
              <h3 className="text-lg font-bold font-display text-neutral-900 mb-6">Ringkasan Belanja</h3>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 mb-6">
                {items.map((item) => (
                  <div key={item.product_id} className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{item.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {item.qty} x {formatRupiah(item.price)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-neutral-900">{formatRupiah(item.price * item.qty)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-200 pt-4 space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-medium">Subtotal</span>
                  <span className="font-semibold text-neutral-900">{formatRupiah(getTotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500 font-medium">Ongkir</span>
                  <span className="font-semibold text-success">Gratis</span>
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-4 flex justify-between items-center mb-6">
                <span className="text-base font-bold text-neutral-900">Total</span>
                <span className="text-lg font-bold text-neutral-900">{formatRupiah(getTotal())}</span>
              </div>

              {serverError && (
                <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-center">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#E77F86] hover:bg-[#D66D74] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <QrCode size={20} />
                {loading ? "Memproses..." : "Bayar Sekarang"}
              </button>
              <p className="text-[11px] text-center text-neutral-500 mt-3">
                Pembayaran aman • Data terenkripsi
              </p>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
