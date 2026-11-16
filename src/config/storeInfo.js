// src/config/storeInfo.js
//
// Informasi toko yang tampil di footer dan halaman pesanan (lokasi pengambilan,
// jam buka, kontak). Kosongkan ("") field yang belum ada — bagian itu otomatis
// disembunyikan.

export const STORE_INFO = {
  name: "Clucky Taiwan",
  // Alamat lokasi pengambilan pesanan, mis. "Jl. Contoh No. 1, Jakarta"
  address: "",
  // Link Google Maps lokasi toko (opsional)
  mapsUrl: "",
  // Jam buka, mis. "Setiap hari, 10.00–21.00 WIB"
  openingHours: "",
  // Nomor WhatsApp format internasional tanpa "+", mis. "6281234567890"
  whatsapp: "",
  // Akun Instagram tanpa "@" (opsional)
  instagram: "",
};

/** Link wa.me dengan pesan awal (opsional). Kosong jika nomor belum diisi. */
export function whatsappLink(message = "") {
  if (!STORE_INFO.whatsapp) return "";
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${STORE_INFO.whatsapp}${text}`;
}
