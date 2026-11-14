// src/utils/orderStatusApi.js
//
// Satu-satunya jalur pelanggan (anon) untuk membaca status pesanan:
// Edge Function check-order-status yang mewajibkan kode_pesanan + no HP.
// Pelanggan TIDAK boleh membaca tabel pesanan langsung (RLS anon dicabut di 0011).

export async function fetchOrderStatus(kodePesanan, noHp) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order-status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ kode_pesanan: kodePesanan, customer_phone: noHp }),
    },
  );
  return res.json();
}

/**
 * Polling status pesanan secara berkala. Mengembalikan fungsi stop().
 * - Interval di-skip saat tab tidak terlihat (hemat request).
 * - onResult(order) dipanggil setiap respons sukses; kembalikan `true`
 *   dari onResult untuk menghentikan polling.
 */
export function pollOrderStatus(kodePesanan, noHp, onResult, intervalMs = 5000) {
  let stopped = false;
  let inFlight = false;

  async function tick() {
    if (stopped || inFlight || document.visibilityState === "hidden") return;
    inFlight = true;
    try {
      const data = await fetchOrderStatus(kodePesanan, noHp);
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
