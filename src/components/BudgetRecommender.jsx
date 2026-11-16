// src/components/BudgetRecommender.jsx
import { useState, useMemo, useCallback, useRef } from "react";
import { formatRupiah } from "../utils/formatCurrency";
import { getRecommendations, getMinAvailablePrice, groupComboItems, MAIN_CATEGORIES } from "../utils/budgetRecommender";
import { useCartStore } from "../store/cartStore";
import { useVariantModalStore } from "../store/variantModalStore";
import { getOptimizedImageUrl } from "../utils/imageUrl";
import toast from "react-hot-toast";
import {
  Sparkles, ShoppingBag, ArrowRight, Tag,
  ChevronRight, ChevronLeft, Star, Zap, TrendingUp,
} from "lucide-react";
import "./BudgetRecommender.css";

// ── Konstanta ──────────────────────────────────────────────────────────────
const BUDGET_PRESETS = [15_000, 25_000, 50_000, 75_000];
const SLIDER_MAX = 100_000; // batas atas slider (bisa diketik lebih)
const SLIDER_MIN_FALLBACK = 5_000;
const MAX_BUDGET = 1_000_000; // batas input manual — di atas ini rekomendasi tidak bermakna

// Label per jenis rekomendasi (ditentukan algoritma, bukan urutan tampil)
const KIND_CONFIG = {
  best:  { label: "Paling Pas",   icon: Star,       color: "text-amber-600 bg-amber-100 border-amber-200",       btnClass: "bg-primary hover:bg-primary-dark" },
  more:  { label: "Lebih Banyak", icon: TrendingUp, color: "text-violet-700 bg-violet-100 border-violet-200",    btnClass: "bg-violet-600 hover:bg-violet-700" },
  saver: { label: "Lebih Hemat",  icon: Zap,        color: "text-emerald-700 bg-emerald-100 border-emerald-200", btnClass: "bg-emerald-600 hover:bg-emerald-700" },
};

// Warna progress bar berdasarkan efisiensi budget
function getEfficiencyColor(efficiency) {
  if (efficiency >= 90) return "bg-emerald-500";
  if (efficiency >= 70) return "bg-primary";
  if (efficiency >= 50) return "bg-amber-400";
  return "bg-neutral-300";
}

export default function BudgetRecommender({ products, onCartOpen }) {
  const [budget, setBudget] = useState(0);
  const [inputRaw, setInputRaw] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [inputError, setInputError] = useState("");
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  // Status "sudah di keranjang" diturunkan dari isi keranjang (bukan disimpan
  // terpisah), supaya tombol paket kembali aktif saat item dihapus/keranjang dikosongkan.
  const cartProductIds = useMemo(
    () => new Set(cartItems.map((i) => i.product_id)),
    [cartItems],
  );
  const { openModal } = useVariantModalStore();
  const sliderRef = useRef(null);

  // Geser slider horizontal rekomendasi (kiri/kanan)
  const scrollSlider = useCallback((dir) => {
    sliderRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }, []);

  // ── Harga minimum produk tersedia ─────────────────────────────────────────
  const minPrice = useMemo(() => getMinAvailablePrice(products) || SLIDER_MIN_FALLBACK, [products]);
  const maxPrice = useMemo(() => {
    const prices = products.filter((p) => p.is_active && p.stock > 0).map((p) => p.price);
    return prices.length ? Math.min(Math.max(...prices) * 3, SLIDER_MAX) : SLIDER_MAX;
  }, [products]);

  // ── Rekomendasi (dihitung ulang saat budget berubah) ──────────────────────
  const recommendations = useMemo(() => {
    if (!budget || budget < minPrice) return [];
    return getRecommendations(products, budget);
  }, [budget, products, minPrice]);

  // Harga menu utama termurah — untuk menjelaskan kenapa yang muncul hanya camilan
  const minMainPrice = useMemo(() => {
    const prices = products
      .filter((p) => p.is_active && p.stock > 0 && MAIN_CATEGORIES.includes(p.category))
      .map((p) => p.min_price ?? p.price);
    return prices.length ? Math.min(...prices) : null;
  }, [products]);

  // ── Fill persen slider ────────────────────────────────────────────────────
  const sliderFillPercent = useMemo(
    () => Math.round(((Math.min(budget, maxPrice) - minPrice) / (maxPrice - minPrice)) * 100),
    [budget, minPrice, maxPrice],
  );

  // ── Handler slider ────────────────────────────────────────────────────────
  const handleSliderChange = useCallback((e) => {
    const val = Number(e.target.value);
    setBudget(val);
    setInputRaw(val.toLocaleString("id-ID"));
    setInputError("");
    if (!hasSearched) setHasSearched(true);
  }, [hasSearched]);

  // ── Handler input manual ──────────────────────────────────────────────────
  const handleInputChange = useCallback((e) => {
    const raw = e.target.value.replace(/\D/g, "");
    let num = Number(raw);
    if (num > MAX_BUDGET) {
      num = MAX_BUDGET;
      setInputError(`Budget maksimal ${formatRupiah(MAX_BUDGET)}`);
    } else {
      setInputError("");
    }
    setInputRaw(raw ? num.toLocaleString("id-ID") : "");
    if (num > 0) {
      setBudget(num);
      if (!hasSearched) setHasSearched(true);
    } else {
      // Kolom dikosongkan → reset, jangan diam-diam memakai budget lama
      setBudget(0);
      setHasSearched(false);
    }
  }, [hasSearched]);

  const handlePreset = useCallback((val) => {
    setBudget(val);
    setInputRaw(val.toLocaleString("id-ID"));
    setInputError("");
    if (!hasSearched) setHasSearched(true);
  }, [hasSearched]);

  // ── Add to cart atau redirect ─────────────────────────────────────────────
  // Kombinasi bisa berisi campuran produk simple + produk bervarian. Produk
  // simple langsung bisa dimasukkan ke keranjang; produk bervarian butuh user
  // memilih ukuran/rasa dulu di halaman detail, jadi kita redirect ke sana.
  // Sebelumnya: kalau ada 1 saja produk bervarian dalam kombo, SEMUA item lain
  // (termasuk yang simple) diabaikan dan tidak pernah masuk keranjang.
  const handleBuyPackage = useCallback((comboItems) => {
    // Hanya item yang belum ada di keranjang yang ditambahkan — mencegah qty dobel
    // saat pelanggan menghapus sebagian item paket lalu memesan paket yang sama lagi.
    const missingItems = comboItems.filter((item) => !cartProductIds.has(item.id));

    if (missingItems.length === 0) {
      if (onCartOpen) onCartOpen();
      return;
    }

    const variantItems = missingItems.filter((item) => item.has_variants);
    const simpleItems = missingItems.filter((item) => !item.has_variants);

    simpleItems.forEach((item) =>
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        base_price: item.price,
        stock: item.stock,
        image_url: item.image_url,
        variant_ids: [],
        variant_label: "",
      }, 1),
    );

    if (variantItems.length > 0) {
      if (simpleItems.length > 0) {
        toast.success(`${simpleItems.length} menu ditambahkan, pilih varian untuk menu lainnya`);
      }

      const target = variantItems[0];
      openModal(target.id, {
        preselectVariantIds: target.min_variant_ids ?? [],
        referenceBudget: budget,
        otherVariantItems: variantItems.slice(1).map((v) => v.name),
        queue: variantItems.slice(1).map((v) => ({
          id: v.id,
          name: v.name,
          preselectVariantIds: v.min_variant_ids ?? [],
        })),
      });
      return;
    }

    toast.success("Berhasil ditambahkan ke keranjang!");
    if (onCartOpen) onCartOpen();
  }, [addItem, openModal, onCartOpen, cartProductIds, budget]);

  // ── Apakah combo butuh pilih varian dulu? ────────────────────────────────
  const comboNeedsVariant = (items) => items.some((i) => i.has_variants);

  return (
    <section id="rekomendasi" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 scroll-mt-20">
      {/* ── Judul section ──────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-sm mb-4">
          Rekomendasi Sesuai Budget
        </div>
        {/* <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-neutral-900 mb-3">
          Berapa Uangmu Hari Ini?
        </h2> */}
        <p className="text-neutral-500 font-body text-base max-w-lg mx-auto">
          Geser slider atau ketik nominal budget — kami otomatis carikan kombinasi menu terbaik untukmu.
        </p>
      </div>

      {/* ── Panel Utama ─────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/8 via-white to-secondary/8 border border-neutral-200/80 shadow-sm overflow-hidden">

        {/* ── Budget Input Area ───────────────────────────────────────────── */}
        <div className="px-6 pt-8 pb-6 sm:px-10 bg-white/60 border-b border-neutral-100">
          {/* Angka budget besar di tengah */}
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-neutral-400 mb-1">Budget kamu</p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="font-display text-4xl sm:text-5xl font-extrabold text-neutral-900 tabular-nums tracking-tight">
                {budget > 0 ? formatRupiah(budget) : "Rp —"}
              </span>
            </div>
          </div>

          {/* Range Slider */}
          <div className="px-2 mb-4">
            <input
              type="range"
              min={minPrice}
              max={maxPrice}
              step={1000}
              value={Math.min(budget || minPrice, maxPrice)}
              onChange={handleSliderChange}
              className="budget-slider w-full"
              style={{ "--fill-percent": `${sliderFillPercent}%` }}
              aria-label="Pilih budget"
              aria-valuetext={budget > 0 ? formatRupiah(budget) : "Belum dipilih"}
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-1.5 px-0.5">
              <span>{formatRupiah(minPrice)}</span>
              <span>{formatRupiah(maxPrice)}</span>
            </div>
          </div>

          {/* Input manual + preset chips */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* Input ketik manual */}
            <div className="relative w-full sm:w-52 shrink-0">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={inputRaw}
                onChange={handleInputChange}
                placeholder="Ketik nominal"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-semibold font-body outline-none transition-all ${inputError
                  ? "border-danger bg-red-50 focus:ring-1 focus:ring-danger"
                  : "border-neutral-200 bg-white focus:border-primary focus:ring-1 focus:ring-primary"
                  }`}
              />
            </div>

            {/* Quick preset chips */}
            {/* <div className="flex flex-wrap gap-2">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${budget === preset
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-primary/60 hover:text-primary"
                    }`}
                >
                  {formatRupiah(preset)}
                </button>
              ))}
            </div> */}
          </div>

          {inputError && (
            <p className="text-xs text-danger mt-2 font-medium">{inputError}</p>
          )}
        </div>

        {/* ── Area Hasil Rekomendasi ──────────────────────────────────────── */}
        <div className="px-6 py-6 sm:px-10">
          {!hasSearched || budget === 0 ? (
            /* Empty state — belum isi budget */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {/* <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-primary" />
              </div> */}
              <p className="font-semibold text-neutral-700 mb-1">Geser slider di atas untuk mulai</p>
              <p className="text-sm text-neutral-400">Rekomendasi paket menu akan langsung muncul di sini</p>
            </div>
          ) : budget < minPrice ? (
            /* Budget terlalu kecil */
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-4xl mb-3">😢</div>
              <p className="font-bold text-neutral-800 mb-1">Budget belum cukup</p>
              <p className="text-sm text-neutral-500">
                Minimal <span className="font-semibold text-primary">{formatRupiah(minPrice)}</span> untuk 1 porsi menu termurah kami.
              </p>
            </div>
          ) : recommendations.length === 0 ? (
            /* Budget ada tapi tidak ada yang cocok */
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-4xl mb-3">🤔</div>
              <p className="font-bold text-neutral-800 mb-1">Belum ada kombinasi yang pas</p>
              <p className="text-sm text-neutral-500">Coba naikkan sedikit budget-mu.</p>
            </div>
          ) : (
            /* Ada rekomendasi */
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  {recommendations.length} Rekomendasi untuk {formatRupiah(budget)}
                </p>
                {recommendations.length > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => scrollSlider(-1)}
                    aria-label="Rekomendasi sebelumnya"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-primary hover:text-primary"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollSlider(1)}
                    aria-label="Rekomendasi selanjutnya"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-primary hover:text-primary"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                )}
              </div>

              {recommendations[0]?.isSnackOnly && minMainPrice && (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  Menu ayam mulai {formatRupiah(minMainPrice)}. Dengan budget ini, berikut pilihan camilan &amp; minuman.
                </p>
              )}

              <div className="relative">
                <div
                  ref={sliderRef}
                  className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-4 sm:-mx-10 sm:px-10"
                >
                  {recommendations.map((combo, idx) => {
                    const rank = KIND_CONFIG[combo.kind] ?? KIND_CONFIG.best;
                    const RankIcon = rank.icon;
                    const needsVariant = comboNeedsVariant(combo.items);
                    const efficiency = Math.round((combo.totalPrice / budget) * 100);
                    const isAdded = combo.items.every((i) => cartProductIds.has(i.id));

                    return (
                      <div
                        key={`${combo.items.map(i => i.id).join("-")}-${idx}`}
                        className="rec-card snap-start shrink-0 w-[280px] sm:w-[320px] bg-white rounded-2xl border border-neutral-100 shadow-sm flex flex-col overflow-hidden"
                      >
                      {/* Card header dengan badge ranking */}
                      <div className="px-4 pt-4 pb-3 border-b border-neutral-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${rank.color} ${combo.kind === "best" ? "badge-best" : ""}`}>
                            <RankIcon size={10} />
                            {rank.label}
                          </span>
                          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                            {combo.type}
                          </span>
                        </div>

                        {/* Badge ada varian */}
                        {needsVariant && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full mt-1">
                            <Tag size={9} />
                            Pilih Varian di Detail
                          </span>
                        )}
                      </div>

                      {/* Daftar item */}
                      <div className="px-4 py-3 flex-1 space-y-3">
                        {groupComboItems(combo.items).map(({ product: item, qty }) => (
                          <div key={item.id} className="flex items-center gap-3">
                            {/* Thumbnail produk */}
                            {item.image_url ? (
                              <img
                                src={getOptimizedImageUrl(item.image_url, { width: 150 })}
                                alt={item.name}
                                loading="lazy"
                                className="w-11 h-11 rounded-xl object-cover bg-neutral-100 shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <ShoppingBag size={16} className="text-primary/50" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-neutral-800 truncate">
                                {qty > 1 && <span className="text-primary">{qty}× </span>}
                                {item.name}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs text-primary font-bold">
                                  {formatRupiah((item.min_price ?? item.price) * qty)}
                                </p>
                                {item.has_variants && (
                                  <span className="text-[10px] text-amber-500 font-semibold">+varian</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer card */}
                      <div className="px-4 pb-4 mt-1">
                        {/* Progress bar efisiensi budget */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[11px] text-neutral-400 mb-1.5">
                            <span>Efisiensi budget</span>
                            <span className="font-bold text-neutral-600">{efficiency}%</span>
                          </div>
                          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className={`budget-bar-fill h-full rounded-full ${getEfficiencyColor(efficiency)}`}
                              style={{ width: `${efficiency}%` }}
                            />
                          </div>
                        </div>

                        {/* Total & sisa */}
                        <div className="flex justify-between items-end mb-3">
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-0.5">
                              {combo.isEstimate ? "Mulai dari" : "Total"}
                            </p>
                            <p className="font-display font-extrabold text-xl text-neutral-900">
                              {formatRupiah(combo.totalPrice)}
                            </p>
                            {combo.isEstimate && (
                              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                                Bisa berubah sesuai varian pilihanmu
                              </p>
                            )}
                          </div>
                          {combo.leftover > 0 && !combo.isEstimate && (
                            <div className="text-right">
                              <p className="text-[11px] text-neutral-400 mb-0.5">Sisa budget</p>
                              <p className="text-sm font-bold text-success">{formatRupiah(combo.leftover)}</p>
                            </div>
                          )}
                        </div>

                        {/* CTA Button */}
                        {isAdded ? (
                          <button
                            onClick={() => handleBuyPackage(combo.items)}
                            className="w-full flex items-center justify-center gap-2 bg-neutral-500 hover:bg-neutral-600 shadow-inner active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm"
                          >
                            <ShoppingBag size={15} />
                            Lihat Keranjang
                          </button>
                        ) : needsVariant ? (
                          <button
                            onClick={() => handleBuyPackage(combo.items)}
                            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm"
                          >
                            Pilih Varian Dulu
                            <ArrowRight size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBuyPackage(combo.items)}
                            className={`w-full flex items-center justify-center gap-2 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm ${rank.btnClass}`}
                          >
                            <ShoppingBag size={15} />
                            Pesan Sekarang
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>

              {/* Hint tambahan jika ada produk bervarian */}
              {/* {recommendations.some((c) => comboNeedsVariant(c.items)) && (
                <p className="text-center text-xs text-neutral-400 mt-4 flex items-center justify-center gap-1.5">
                  <Tag size={11} />
                  Produk bertanda <span className="font-semibold text-amber-600">+varian</span> perlu pilih ukuran/rasa di halaman detail
                </p>
              )} */}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}