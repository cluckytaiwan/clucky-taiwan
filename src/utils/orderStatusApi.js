// src/utils/orderStatusApi.js
//
// Status pesanan dibaca lewat Edge Function check-order-status. Pelanggan harus login:
// fungsi hanya mengembalikan pesanan milik akun yang token login-nya dikirim.
import { supabase } from "../lib/supabaseClient";

/**
 * Mengambil status satu pesanan milik akun yang sedang login.
 * Hasil: { success, order } dari server.
 */
export async function fetchOrderStatus(kodePesanan) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order-status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ kode_pesanan: kodePesanan }),
    },
  );
  return res.json();
}

/**
 * Menanyakan status pesanan ke server secara berkala (polling), sampai dihentikan.
 * Dipakai sebagai cadangan Realtime dan untuk memantau pembayaran setelah checkout.
 * Hasil: fungsi stop(); onResult(order) mengembalikan true untuk berhenti.
 * Saat tab tidak terlihat, pengecekan dilewati agar tidak membuang request.
 */
export function pollOrderStatus(kodePesanan, onResult, intervalMs = 5000) {
  let stopped = false;
  let inFlight = false;

  async function tick() {
    if (stopped || inFlight || document.visibilityState === "hidden") return;
    inFlight = true;
    try {
      const data = await fetchOrderStatus(kodePesanan);
      if (!stopped && data?.success && onResult(data.order) === true) stop();
    } catch (err) {
      console.warn("[pollOrderStatus] gagal:", err.message);
    } finally {
      inFlight = false;
    }
  }

  const id = setInterval(tick, intervalMs);
  function stop() {
    stopped = true;
    clearInterval(id);
  }
  return stop;
}
