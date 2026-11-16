#!/usr/bin/env node
// scripts/optimize-product-images.mjs
//
// Mengecilkan foto produk lama di Supabase Storage (bucket product-images).
//
// AMAN secara desain:
//   - Default hanya DRY-RUN: menampilkan rencana dan perkiraan hemat, tidak mengubah apa pun.
//   - Dengan --apply: foto asli dicadangkan ke ./backup-product-images/ (lokal),
//     versi kecil diunggah sebagai file BARU, lalu produk.url_gambar diarahkan ke file baru.
//   - Foto asli di Storage TIDAK dihapus (bisa dibersihkan manual setelah dicek).
//   - Hanya menyentuh foto yang berada di bucket project ini; URL eksternal dilewati.
//
// Pemakaian:
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<kunci> \
//     node scripts/optimize-product-images.mjs            # dry-run
//   ... node scripts/optimize-product-images.mjs --apply  # jalankan sungguhan
//   Opsi: --max=800 (sisi terpanjang, px)  --quality=82  --min-kb=120
//
// Kunci service role JANGAN ditulis di chat/commit: berikan lewat environment saja.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const APPLY = Boolean(args.apply);
const MAX = Number(args.max ?? 800);
const QUALITY = Number(args.quality ?? 82);
const MIN_KB = Number(args["min-kb"] ?? 120);
const BUCKET = "product-images";

const BASE = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!BASE || !KEY) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi lewat environment.");
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const PUBLIC_PREFIX = `${BASE}/storage/v1/object/public/${BUCKET}/`;
const BACKUP_DIR = path.resolve("backup-product-images");
const kb = (n) => `${Math.round(n / 1024)} KB`;

async function api(pathAndQuery, init = {}) {
  const res = await fetch(`${BASE}${pathAndQuery}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${pathAndQuery.split("?")[0]} → ${res.status} ${await res.text()}`);
  return res;
}

const products = await (await api("/rest/v1/produk?select=id,nama_produk,url_gambar&order=created_at")).json();
console.log(`${APPLY ? "MODE: APPLY" : "MODE: DRY-RUN (tidak ada yang diubah)"} — ${products.length} produk, sisi terpanjang ${MAX}px, WebP q${QUALITY}\n`);

let before = 0;
let after = 0;
let changed = 0;

for (const p of products) {
  const url = p.url_gambar ?? "";
  if (!url.startsWith(PUBLIC_PREFIX)) {
    console.log(`- ${p.nama_produk}: dilewati (${url ? "bukan foto di Storage project ini" : "tanpa foto"})`);
    continue;
  }

  const original = Buffer.from(await (await fetch(url)).arrayBuffer());
  const meta = await sharp(original).metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);

  if (longest <= MAX && original.length <= MIN_KB * 1024) {
    console.log(`- ${p.nama_produk}: sudah kecil (${meta.width}x${meta.height}, ${kb(original.length)}), dilewati`);
    continue;
  }

  const optimized = await sharp(original)
    .rotate() // hormati orientasi EXIF dari kamera HP
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  if (optimized.length >= original.length) {
    console.log(`- ${p.nama_produk}: hasil tidak lebih kecil, dilewati`);
    continue;
  }

  before += original.length;
  after += optimized.length;
  changed++;
  console.log(`- ${p.nama_produk}: ${meta.width}x${meta.height} ${kb(original.length)} → ${kb(optimized.length)}`);

  if (!APPLY) continue;

  // 1) cadangan lokal
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const oldName = decodeURIComponent(url.slice(PUBLIC_PREFIX.length));
  await fs.writeFile(path.join(BACKUP_DIR, `${p.id.slice(0, 8)}-${path.basename(oldName)}`), original);

  // 2) unggah file baru (bukan menimpa)
  const newName = `opt-${Date.now()}-${p.id.slice(0, 8)}.webp`;
  await api(`/storage/v1/object/${BUCKET}/${newName}`, {
    method: "POST",
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000" },
    body: optimized,
  });

  // 3) arahkan produk ke file baru
  await api(`/rest/v1/produk?id=eq.${p.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ url_gambar: `${PUBLIC_PREFIX}${newName}` }),
  });
}

console.log(`\n${changed} foto ${APPLY ? "dioptimalkan" : "akan dioptimalkan"}: ${kb(before)} → ${kb(after)} (hemat ${kb(before - after)})`);
if (!APPLY && changed > 0) console.log("Jalankan ulang dengan --apply untuk melakukannya.");
if (APPLY && changed > 0) console.log(`Cadangan foto asli: ${BACKUP_DIR}\nFoto asli di Storage tidak dihapus.`);
