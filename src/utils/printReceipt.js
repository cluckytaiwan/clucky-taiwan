// src/utils/printReceipt.js
//
// Cetak struk satu pesanan (lebar 80 mm, cocok untuk printer thermal maupun A4).
// Memakai iframe tersembunyi + window.print(), tanpa library tambahan.
import { formatRupiah } from "./formatCurrency";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUS_BAYAR = {
  menunggu_pembayaran: "MENUNGGU PEMBAYARAN",
  lunas: "LUNAS",
  kadaluarsa: "KEDALUWARSA",
  dibatalkan: "DIBATALKAN",
  ditolak: "DITOLAK",
  dikembalikan: "DIKEMBALIKAN",
};

function buildHtml(order) {
  const tgl = new Date(order.created_at).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).replace(".", ":");
  const kode = order.kode_pesanan ? `#${order.kode_pesanan}` : `#${String(order.id).slice(0, 8)}`;

  const items = (order.detail_pesanan || []).map((d) => {
    const qty = d.jumlah ?? d.kuantitas;
    const varian = Array.isArray(d.varian_terpilih) && d.varian_terpilih.length
      ? `<div class="sub">${esc(d.varian_terpilih.map((v) => v.nama).join(" · "))}</div>` : "";
    return `<div class="row"><div class="nama">${esc(d.nama_produk || "Produk")}<span class="qty"> x${qty}</span>${varian}</div><div class="rp">${formatRupiah(d.subtotal)}</div></div>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Struk ${esc(kode)}</title>
<style>
@page { size: 80mm auto; margin: 4mm; }
* { box-sizing: border-box; }
body { width: 72mm; margin: 0 auto; font: 12px/1.4 "Courier New", monospace; color: #000; }
.c { text-align: center; } .b { font-weight: bold; }
h1 { font-size: 16px; margin: 0; }
hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
.row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
.nama { flex: 1; } .rp { white-space: nowrap; } .sub { font-size: 10px; } .qty { white-space: nowrap; }
.total { font-size: 14px; font-weight: bold; }
</style></head><body>
<div class="c"><h1>Clucky Taiwan</h1><div>Struk Pesanan</div></div>
<hr>
<div class="row"><span>Kode</span><span class="b">${esc(kode)}</span></div>
<div class="row"><span>Tanggal</span><span>${esc(tgl)}</span></div>
<div class="row"><span>Pelanggan</span><span>${esc(order.nama_pelanggan)}</span></div>
<hr>
${items}
<hr>
<div class="row total"><span>TOTAL</span><span>${formatRupiah(order.total_harga)}</span></div>
<div class="row"><span>Pembayaran</span><span class="b">${esc(STATUS_BAYAR[order.status_pembayaran] || order.status_pembayaran)}</span></div>
${order.catatan ? `<hr><div>Catatan: ${esc(order.catatan)}</div>` : ""}
<hr>
<div class="c">Terima kasih sudah memesan!</div>
</body></html>`;
}

export function printReceipt(order) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(buildHtml(order));
  doc.close();
  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  iframe.contentWindow.onafterprint = cleanup;
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(cleanup, 60000); // jaga-jaga bila onafterprint tidak terpanggil
  }, 150);
}
