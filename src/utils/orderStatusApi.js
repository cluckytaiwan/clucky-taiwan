// src/utils/orderStatusApi.js
//
// Pelanggan tidak bisa membaca tabel pesanan langsung (ditutup RLS), jadi status
// dibaca lewat Edge Function check-order-status yang mewajibkan kode + no HP.

/**
 * Mengambil status satu pesanan dari server.
 * Dipanggil oleh pollOrderStatus di bawah. Hasil: { success, order } dari server.
 */
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
 * Menanyakan status pesanan ke server setiap 5 detik (polling), sampai dihentikan.
 * Dipanggil setelah checkout dan di halaman status pesanan.
 * Hasil: fungsi stop(); onResult(order) mengembalikan true untuk berhenti.
 * Saat tab tidak terlihat, pengecekan dilewati agar tidak membuang request.
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
