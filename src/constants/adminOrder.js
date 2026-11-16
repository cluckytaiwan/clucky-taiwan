// src/constants/adminOrder.js
// Konstanta & helper status pesanan untuk panel admin.

export const PAYMENT_STATUS = {
  menunggu_pembayaran: { label: "Menunggu",     badge: "bg-amber-100 text-amber-700 border-amber-200" },
  lunas:               { label: "Lunas",        badge: "bg-green-100 text-green-700 border-green-200" },
  kadaluarsa:          { label: "Kedaluwarsa",  badge: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  dibatalkan:          { label: "Dibatalkan",   badge: "bg-red-100 text-red-600 border-red-200" },
  ditolak:             { label: "Ditolak",      badge: "bg-red-100 text-red-600 border-red-200" },
  dikembalikan:        { label: "Dikembalikan", badge: "bg-blue-100 text-blue-600 border-blue-200" },
};

/** Urutan status pengerjaan (kolom status_pesanan). */
export const FULFILLMENT_STEPS = [
  { key: "diproses", label: "Diproses",     badge: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "dikirim",  label: "Siap Diambil", badge: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "selesai",  label: "Selesai",      badge: "bg-neutral-100 text-neutral-500 border-neutral-200" },
];

export function fulfillmentInfo(key) {
  return FULFILLMENT_STEPS.find((s) => s.key === key) ?? FULFILLMENT_STEPS[0];
}

/** Langkah berikutnya, atau null bila sudah selesai. */
export function nextFulfillment(key) {
  const i = FULFILLMENT_STEPS.findIndex((s) => s.key === key);
  return i >= 0 && i < FULFILLMENT_STEPS.length - 1 ? FULFILLMENT_STEPS[i + 1] : null;
}

/** Pesanan "aktif" = sudah dibayar dan belum selesai — yang perlu dikerjakan dapur. */
export function isActiveOrder(order) {
  return order.status_pembayaran === "lunas" && order.status_pesanan !== "selesai";
}

export function formatOrderCode(order) {
  return order.kode_pesanan ? `#${order.kode_pesanan}` : `#${String(order.id).slice(0, 8)}`;
}

export function formatOrderDate(iso) {
  return new Date(iso)
    .toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(".", ":");
}

/** Link WhatsApp ke pelanggan dengan pesan sesuai status pesanan. */
export function customerWaLink(order) {
  const digits = String(order.no_hp_pelanggan || "").replace(/\D/g, "");
  if (!digits) return "";
  const phone = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  const kode = order.kode_pesanan ?? "";
  const message =
    order.status_pesanan === "dikirim"
      ? `Halo ${order.nama_pelanggan}, pesanan ${kode} di Clucky Taiwan sudah siap diambil. Terima kasih!`
      : `Halo ${order.nama_pelanggan}, terkait pesanan ${kode} di Clucky Taiwan:`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
