// src/constants/orderStatus.js
//
// Key mengikuti NILAI enum status_pembayaran di database (§7 Master Planning).

export const statusLabel = {
  menunggu_pembayaran: { text: "Menunggu Pembayaran", color: "bg-secondary-light text-neutral-900" },
  lunas: { text: "Pembayaran Berhasil", color: "bg-green-100 text-success" },
  kadaluarsa: { text: "Kedaluwarsa", color: "bg-neutral-200 text-neutral-500" },
  dibatalkan: { text: "Dibatalkan", color: "bg-red-100 text-danger" },
  ditolak: { text: "Ditolak", color: "bg-red-100 text-danger" },
  dikembalikan: { text: "Dana Dikembalikan", color: "bg-blue-100 text-blue-600" },
};

export const fulfillmentLabel = {
  diproses: "Sedang Diproses",
  dikirim: "Siap Diambil",
  selesai: "Selesai",
};
