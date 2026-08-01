// src/hooks/useProducts.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Menghitung total tambahan harga minimum & maksimum dari varian produk,
 * SEKALIGUS id varian mana saja yang membentuk kombinasi termurah itu.
 *
 * Karena user WAJIB memilih 1 opsi per tipe varian (lihat ProductDetailPage:
 * allVariantsSelected mensyaratkan semua tipe terisi), harga akhir minimum
 * bukan cuma "varian termurah", tapi jumlah opsi termurah DARI SETIAP GRUP tipe.
 * Contoh: tipe "ukuran" termurah +Rp0, tipe "rasa" termurah +Rp2.000
 *   → minExtra = 0 + 2000, bukan cuma 0.
 *
 * `minVariantIds` penting untuk BudgetRecommender: begitu user pilih kartu
 * rekomendasi, kombinasi varian TERMURAH inilah yang harus otomatis terpilih
 * di ProductDetailPage — kalau dibiarkan kosong, user bisa pilih varian lain
 * yang lebih mahal dan harga yang dijanjikan di kartu rekomendasi jadi tidak valid.
 *
 * @param {Array} variants — [{ id, tipe, harga_tambahan }]
 * @returns {{ minExtra: number, maxExtra: number, minVariantIds: string[] }}
 */
function computeVariantPriceRange(variants) {
  if (!variants || variants.length === 0) return { minExtra: 0, maxExtra: 0, minVariantIds: [] };

  const byType = {};
  for (const v of variants) {
    const t = v.tipe ?? "default";
    if (!byType[t]) byType[t] = [];
    byType[t].push(v);
  }

  let minExtra = 0;
  let maxExtra = 0;
  const minVariantIds = [];
  for (const opts of Object.values(byType)) {
    const cheapest = opts.reduce((a, b) => (Number(a.harga_tambahan) <= Number(b.harga_tambahan) ? a : b));
    const priciest = opts.reduce((a, b) => (Number(a.harga_tambahan) >= Number(b.harga_tambahan) ? a : b));
    minExtra += Number(cheapest.harga_tambahan) || 0;
    maxExtra += Number(priciest.harga_tambahan) || 0;
    minVariantIds.push(cheapest.id);
  }
  return { minExtra, maxExtra, minVariantIds };
}

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      // Query ke tabel Bahasa Indonesia (produk, kategori), di-alias ke
      // bentuk Inggris (§7.1) agar komponen (ProductCard, dsb) tidak perlu
      // tahu soal bahasa skema database.
      // opsi_varian(id) — hanya ambil id untuk cek has_variants, tidak load semua data varian.
      // opsi_varian(id, tipe, nama, harga_tambahan, aktif) — 'nama' wajib ikut di-fetch
      // karena dipakai untuk chip preview varian di ProductCard (mis. "Original", "Jumbo").
      const { data, error } = await supabase
        .from("produk")
        .select("id, nama_produk, deskripsi, harga, stok, url_gambar, aktif, kategori(nama_kategori), opsi_varian(id, tipe, nama, harga_tambahan, aktif)")
        .eq("aktif", true)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        const flattened = (data || []).map((p) => {
          const activeVariants = (p.opsi_varian || []).filter((v) => v.aktif);
          const basePrice = Number(p.harga);
          const { minExtra, maxExtra, minVariantIds } = computeVariantPriceRange(activeVariants);

          return {
            id: p.id,
            name: p.nama_produk,
            description: p.deskripsi,
            price: basePrice,
            stock: p.stok,
            image_url: p.url_gambar,
            is_active: p.aktif,
            category: p.kategori?.nama_kategori ?? null,
            // true jika produk punya minimal 1 varian aktif — dipakai BudgetRecommender
            // untuk memutuskan apakah langsung add-to-cart atau arahkan ke detail page.
            has_variants: activeVariants.length > 0,
            // Rentang harga realistis setelah varian dipilih. Untuk produk tanpa varian,
            // min_price === max_price === price. Dipakai budgetRecommender.js & ProductCard
            // agar tidak lagi menganggap harga dasar sebagai harga final produk bervarian.
            min_price: basePrice + minExtra,
            max_price: basePrice + maxExtra,
            // Id varian (satu per tipe) yang membentuk kombinasi TERMURAH — dipakai
            // BudgetRecommender untuk auto-select varian saat user pilih rekomendasi,
            // supaya harga yang benar-benar ditambahkan ke keranjang sama dengan
            // harga yang dijanjikan di kartu rekomendasi budget.
            min_variant_ids: minVariantIds,
            // Nama-nama opsi varian (mis. ["Original", "Pedas", "Reguler", "Jumbo"]) untuk
            // chip preview di ProductCard. Ini MENGGANTIKAN product.sizes/product.flavors
            // yang dipakai sebelumnya — field tersebut tidak pernah diisi oleh hook ini,
            // jadi chip preview di ProductCard selalu kosong sebelum perbaikan ini.
            variant_preview: activeVariants.map((v) => v.nama),
          };
        });
        setProducts(flattened);
      }
      setLoading(false);
    }

    fetchProducts();
  }, []);

  return { products, loading, error };
}