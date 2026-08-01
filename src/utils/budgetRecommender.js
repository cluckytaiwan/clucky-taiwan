/**
 * src/utils/budgetRecommender.js
 *
 * Algoritma rekomendasi produk berdasarkan budget.
 * Diperbarui untuk menggunakan `min_price` (harga efektif setelah varian) 
 * dan mengizinkan kombinasi menu ganda (A+A) dengan pengecekan stok.
 */

/**
 * Mendapatkan harga efektif produk. 
 * Memprioritaskan min_price (harga dasar + varian termurah) jika ada.
 */
const getEffPrice = (p) => p.min_price ?? p.price;

/**
 * Mengembalikan array rekomendasi kombinasi menu dalam budget.
 * Maks 3 rekomendasi, diurutkan dari yang paling mendekati budget.
 *
 * @param {Array} products — hasil dari useProducts() (sudah termapping ke field Inggris)
 * @param {number} budget  — nominal budget dalam Rupiah
 * @returns {Array} kombinasi: [{ items, totalPrice, leftover, type, isEstimate }]
 */
export function getRecommendations(products, budget) {
  if (!budget || budget <= 0) return [];

  // Hanya ambil produk yang aktif, ada stok, dan harga efektifnya masuk budget
  const available = products.filter(
    (p) => p.is_active && p.stock > 0 && getEffPrice(p) <= budget,
  );

  if (available.length === 0) return [];

  // Urutkan dari harga tertinggi ke terendah (greedy: ambil item paling mahal dulu)
  const sorted = [...available].sort((a, b) => getEffPrice(b) - getEffPrice(a));
  const combinations = [];

  // Helper untuk format combo
  const pushCombo = (items, type) => {
    const total = items.reduce((sum, item) => sum + getEffPrice(item), 0);
    if (total <= budget) {
      combinations.push({
        items,
        totalPrice: total,
        leftover: budget - total,
        type,
        // Jika ada produk bervarian, harga ini adalah "Mulai dari" (estimasi)
        isEstimate: items.some(item => item.has_variants),
      });
    }
  };

  // ── Strategi 1: Paket 2 item ─────────────
  // Loop menggunakan `j = i` untuk mengizinkan produk ganda (contoh: 2 Ayam)
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i; j < sorted.length; j++) {
      // Cek stok jika itemnya sama
      if (i === j && sorted[i].stock < 2) continue;
      
      pushCombo([sorted[i], sorted[j]], "Paket Berdua");
    }
  }

  // ── Strategi 2: Paket 3 item ───────────────────────────────────────────
  // Loop menggunakan indeks sama (memungkinkan A+A+B atau A+A+A)
  const minAvailablePrice = getEffPrice(sorted[sorted.length - 1] ?? { price: Infinity });
  if (budget >= minAvailablePrice * 3 && sorted.length >= 1) {
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i; j < sorted.length; j++) {
        for (let k = j; k < sorted.length; k++) {
          // Validasi limitasi stok
          if (i === j && j === k && sorted[i].stock < 3) continue;
          if (i === j && j !== k && sorted[i].stock < 2) continue;
          if (j === k && i !== j && sorted[j].stock < 2) continue;
          
          pushCombo([sorted[i], sorted[j], sorted[k]], "Paket Bertiga");
        }
      }
    }
  }

  // ── Strategi 3: Item tunggal ─────────────────────────
  for (const item of sorted) {
    pushCombo([item], "Menu Satuan");
  }

  // Urutkan: leftover terkecil dulu (paling efisien memakai budget)
  combinations.sort((a, b) => a.leftover - b.leftover);

  // Deduplikasi berdasarkan signature ID (misal: 1_2_2)
  const seen = new Set();
  const unique = [];

  for (const combo of combinations) {
    const sig = combo.items
      .map((i) => i.id)
      .sort()
      .join("_");

    if (!seen.has(sig)) {
      seen.add(sig);
      unique.push(combo);
    }

    if (unique.length >= 3) break; // Maks 3 rekomendasi
  }

  return unique;
}

/**
 * Harga produk terendah dari daftar yang tersedia.
 * Dipakai untuk membatasi nilai slider terbawah.
 */
export function getMinAvailablePrice(products) {
  const available = products.filter((p) => p.is_active && p.stock > 0);
  if (available.length === 0) return 0;
  return Math.min(...available.map((p) => p.min_price ?? p.price));
}
