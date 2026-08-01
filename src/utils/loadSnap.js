/**
 * src/utils/loadSnap.js
 *
 * Loader dinamis untuk Midtrans Snap.js.
 * Membaca VITE_MIDTRANS_CLIENT_KEY dan VITE_MIDTRANS_IS_PRODUCTION
 * dari environment variable sehingga tidak perlu edit HTML secara manual
 * saat deploy ke production.
 */

let snapLoaded = false;
let snapLoadingPromise = null;

export function loadSnap() {
  // Jika sudah ter-load, langsung resolve
  if (snapLoaded && window.snap) {
    return Promise.resolve();
  }

  // Jika sedang dalam proses load, kembalikan promise yang sama
  if (snapLoadingPromise) {
    return snapLoadingPromise;
  }

  snapLoadingPromise = new Promise((resolve, reject) => {
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
    const isProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === "true";

    if (!clientKey) {
      reject(new Error("VITE_MIDTRANS_CLIENT_KEY tidak diset di .env"));
      return;
    }

    // Hapus script lama jika ada (anti-duplikasi)
    const existingScript = document.getElementById("midtrans-snap-script");
    if (existingScript) {
      existingScript.remove();
    }

    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";

    const script = document.createElement("script");
    script.id = "midtrans-snap-script";
    script.src = snapUrl;
    script.setAttribute("data-client-key", clientKey);
    script.onload = () => {
      snapLoaded = true;
      resolve();
    };
    script.onerror = () => {
      snapLoadingPromise = null;
      reject(new Error("Gagal memuat Snap.js dari Midtrans"));
    };

    document.head.appendChild(script);
  });

  return snapLoadingPromise;
}
