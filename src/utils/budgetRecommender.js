/**
 * src/utils/budgetRecommender.js
 *
 * Rekomendasi paket menu berdasarkan budget.
 *
 * Prinsip:
 * - Setiap paket wajib berisi minimal satu MENU UTAMA (lihat MAIN_CATEGORIES),
 *   supaya tidak muncul paket "2× Kentang Goreng" saja. Pengecualian: kalau
 *   budget belum cukup untuk menu utama apa pun, paket camilan/pelengkap tetap
 *   ditawarkan dan ditandai `isSnackOnly`.
 * - Produk yang sama boleh muncul lebih dari sekali (mis. 2× Ayam untuk berdua)
 *   asal stoknya cukup.
 * - Jumlah rekomendasi 1–3, TIDAK selalu 3: tiap slot hanya diisi bila ada paket
 *   yang benar-benar berbeda dan layak.
 *     • best  — paling pas memakai budget ("Paling Pas")
 *     • more  — item lebih banyak dari "best", tetap memakai budget dengan baik ("Lebih Banyak")
 *     • saver — total jelas lebih murah dari "best", sisa budget berarti ("Lebih Hemat")
 */

/** Kategori yang dihitung sebagai menu utama. */
export const MAIN_CATEGORIES = ["Ayam Goreng", "Paket Hemat"];
/** Kategori minuman — jumlahnya dibatasi agar paket tidak berisi minuman saja. */
export const DRINK_CATEGORIES = ["Minuman"];

const MAX_ITEMS = 3;
const MIN_EFFICIENCY_BEST = 0.6;  // paket terbaik minimal memakai 60% budget
const MIN_EFFICIENCY_MORE = 0.75; // "Lebih Banyak" harus tetap efisien
const MIN_SAVING_RATIO = 0.15;    // "Lebih Hemat" minimal hemat 15% budget dari "best"
const MIN_EFFICIENCY_SAVER = 0.45;

/** Harga efektif: harga dasar + varian termurah (jika ada). */
const getEffPrice = (p) => p.min_price ?? p.price;

const isMain = (p) => MAIN_CATEGORIES.includes(p.category);
const isDrink = (p) => DRINK_CATEGORIES.includes(p.category);

/** Paket masuk akal: minuman tidak lebih banyak dari makanan (minimal 1 minuman boleh). */
function isSensible(items) {
  const drinks = items.filter(isDrink).length;
  const foods = items.length - drinks;
  return drinks <= Math.max(1, foods);
}

const distinctCount = (items) => new Set(items.map((i) => i.id)).size;

const signature = (items) => items.map((i) => i.id).sort().join("_");

/** Semua multiset 1..MAX_ITEMS produk yang muat di budget dan stoknya cukup. */
function enumerateCombos(products, budget) {
  const sorted = [...products].sort((a, b) => getEffPrice(b) - getEffPrice(a));
  const combos = [];

  function walk(start, items, total) {
    if (items.length > 0) combos.push({ items: [...items], totalPrice: total });
    if (items.length === MAX_ITEMS) return;

    for (let i = start; i < sorted.length; i++) {
      const p = sorted[i];
      const price = getEffPrice(p);
      if (total + price > budget) continue;
      const alreadyTaken = items.filter((it) => it.id === p.id).length;
      if (alreadyTaken + 1 > p.stock) continue;
      items.push(p);
      walk(i, items, total + price); // i (bukan i+1) → boleh produk yang sama lagi
      items.pop();
    }
  }

  walk(0, [], 0);
  return combos;
}

function toResult(combo, budget, kind, isSnackOnly) {
  return {
    items: combo.items,
    totalPrice: combo.totalPrice,
    leftover: budget - combo.totalPrice,
    kind,
    isSnackOnly,
    type: combo.items.length === 1 ? "Menu Satuan" : `Paket ${combo.items.length} Item`,
    // Ada produk bervarian → harga adalah "mulai dari"
    isEstimate: combo.items.some((item) => item.has_variants),
  };
}

/**
 * @param {Array} products — hasil useProducts()
 * @param {number} budget
 * @returns {Array} 0–3 rekomendasi: { items, totalPrice, leftover, kind, isSnackOnly, type, isEstimate }
 */
export function getRecommendations(products, budget) {
  if (!budget || budget <= 0) return [];

  const available = products.filter(
    (p) => p.is_active && p.stock > 0 && getEffPrice(p) <= budget,
  );
  if (available.length === 0) return [];

  const all = enumerateCombos(available, budget).filter((c) => isSensible(c.items));
  const withMain = all.filter((c) => c.items.some(isMain));
  const isSnackOnly = withMain.length === 0;
  const pool = isSnackOnly ? all : withMain;

  const eff = (c) => c.totalPrice / budget;
  // Urutan "paling pas": total terbesar; bila sama, lebih bervariasi, lalu item lebih sedikit
  const byFit = (a, b) =>
    b.totalPrice - a.totalPrice ||
    distinctCount(b.items) - distinctCount(a.items) ||
    a.items.length - b.items.length;

  const ranked = [...pool].sort(byFit);
  const best = ranked[0];
  if (!best || eff(best) < MIN_EFFICIENCY_BEST) {
    // Budget terlalu jauh di atas kombinasi termahal (mis. Rp 1 juta): tetap tawarkan
    // satu paket terbaik, tapi jangan mengisi slot lain dengan paket asal-asalan.
    return best ? [toResult(best, budget, "best", isSnackOnly)] : [];
  }

  const results = [toResult(best, budget, "best", isSnackOnly)];
  const used = new Set([signature(best.items)]);

  // "Lebih Banyak": item lebih banyak dari best, tetap efisien
  const more = ranked.find(
    (c) =>
      c.items.length > best.items.length &&
      eff(c) >= MIN_EFFICIENCY_MORE &&
      !used.has(signature(c.items)),
  );
  if (more) {
    results.push(toResult(more, budget, "more", isSnackOnly));
    used.add(signature(more.items));
  }

  // "Lebih Hemat": jelas lebih murah dari best, ambil yang paling mendekati batas hemat
  const saverCeiling = best.totalPrice - budget * MIN_SAVING_RATIO;
  const saver = ranked.find(
    (c) =>
      c.totalPrice <= saverCeiling &&
      eff(c) >= MIN_EFFICIENCY_SAVER &&
      !used.has(signature(c.items)),
  );
  if (saver) results.push(toResult(saver, budget, "saver", isSnackOnly));

  return results;
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

/** Gabungkan item yang sama: [{ product, qty }] — untuk tampilan "2× Ayam". */
export function groupComboItems(items) {
  const map = new Map();
  for (const item of items) {
    const entry = map.get(item.id);
    if (entry) entry.qty += 1;
    else map.set(item.id, { product: item, qty: 1 });
  }
  return [...map.values()];
}
