// src/pages/public/ProductDetailPage.jsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useCartStore } from "../../store/cartStore";
import { formatRupiah } from "../../utils/formatCurrency";
import { getOptimizedImageUrl } from "../../utils/imageUrl";
import { ShoppingBag, ArrowLeft, Plus, Minus, CheckCircle2, Sparkles, Tag } from "lucide-react";
import CartDrawer from "../../components/CartDrawer";
import toast from "react-hot-toast";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // User datang dari kartu rekomendasi budget yang berisi item simple + item ini
  // (bervarian). Item simple-nya sudah dimasukkan ke keranjang oleh BudgetRecommender
  // sebelum redirect ke sini — tampilkan notifikasi supaya user tidak bingung kenapa
  // ada isi keranjang yang tidak mereka tambahkan sendiri di halaman ini.
  const addedFromPackage = location.state?.addedFromPackage ?? 0;
  // Id varian (kombinasi termurah, satu per tipe) yang dijanjikan di kartu
  // rekomendasi budget. Dipakai untuk auto-select begitu data varian selesai
  // dimuat, supaya harga yang tampil di halaman ini sama dengan yang dijanjikan.
  const preselectVariantIds = location.state?.preselectVariantIds ?? [];
  // Budget asal yang diinput user di BudgetRecommender — dipakai untuk
  // menampilkan peringatan kalau user mengganti varian jadi lebih mahal.
  const referenceBudget = location.state?.referenceBudget ?? null;
  const otherVariantItems = location.state?.otherVariantItems ?? [];
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]); // array dari opsi_varian, grouped nanti
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  /**
   * selectedVariants: { [tipe]: varianObj | null }
   * Contoh: { ukuran: { id, tipe, nama, harga_tambahan, ... }, rasa: null }
   */
  const [selectedVariants, setSelectedVariants] = useState({});

  const { addItem, getItemCount } = useCartStore();
  const itemCount = getItemCount();

  // ── Fetch produk + varian ──────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);

      // Paralel: fetch produk dan varian sekaligus
      const [productRes, variantRes] = await Promise.all([
        supabase
          .from("produk")
          .select("id, nama_produk, deskripsi, harga, stok, url_gambar, aktif, kategori(nama_kategori)")
          .eq("id", id)
          .single(),
        supabase
          .from("opsi_varian")
          .select("id, tipe, nama, harga_tambahan, urutan")
          .eq("produk_id", id)
          .eq("aktif", true)
          .order("tipe", { ascending: true })
          .order("urutan", { ascending: true }),
      ]);

      if (productRes.error || !productRes.data || !productRes.data.aktif) {
        setError("Produk tidak ditemukan atau tidak aktif.");
        setLoading(false);
        return;
      }

      const p = productRes.data;
      setProduct({
        id: p.id,
        name: p.nama_produk,
        description: p.deskripsi,
        price: Number(p.harga),
        stock: p.stok,
        image_url: p.url_gambar,
        category: p.kategori?.nama_kategori || "-",
      });

      const variantList = variantRes.data || [];
      setVariants(variantList);

      // Inisialisasi selectedVariants: kalau ada preselectVariantIds (datang dari
      // kartu rekomendasi budget), auto-select varian tersebut per tipe. Kalau
      // tidak ada (user buka halaman produk secara normal), tetap null seperti semula.
      const tipeSet = [...new Set(variantList.map((v) => v.tipe))];
      const initialSelection = Object.fromEntries(
        tipeSet.map((t) => {
          const preselected = variantList.find(
            (v) => v.tipe === t && preselectVariantIds.includes(v.id),
          );
          return [t, preselected ?? null];
        }),
      );
      setSelectedVariants(initialSelection);

      setLoading(false);
    }
    fetchAll();
  }, [id]);

  // ── Grouped varian berdasarkan tipe ────────────────────────────────────
  const groupedVariants = useMemo(() => {
    const groups = {};
    for (const v of variants) {
      if (!groups[v.tipe]) groups[v.tipe] = [];
      groups[v.tipe].push(v);
    }
    return groups; // { ukuran: [...], rasa: [...] }
  }, [variants]);

  const variantTypes = Object.keys(groupedVariants); // ['ukuran', 'rasa']

  // ── Harga dinamis berdasarkan pilihan varian ───────────────────────────
  const extraPrice = useMemo(
    () =>
      Object.values(selectedVariants).reduce(
        (sum, v) => sum + (v ? Number(v.harga_tambahan) : 0),
        0,
      ),
    [selectedVariants],
  );
  const finalPrice = (product?.price ?? 0) + extraPrice;

  // ── Validasi: semua tipe varian wajib dipilih sebelum add to cart ──────
  const allVariantsSelected = variantTypes.every((t) => selectedVariants[t] !== null);
  const canAdd = product && product.stock > 0 && (variantTypes.length === 0 || allVariantsSelected);

  // ── Label varian untuk tampilan di keranjang ───────────────────────────
  const variantLabel = variantTypes
    .filter((t) => selectedVariants[t])
    .map((t) => selectedVariants[t].nama)
    .join(" · "); // "Large · Pedas Level 2"

  // ── Handler pilih varian ───────────────────────────────────────────────
  function selectVariant(tipe, varianObj) {
    setSelectedVariants((prev) => ({ ...prev, [tipe]: varianObj }));
  }

  // ── Add to cart ────────────────────────────────────────────────────────
  function handleAdd() {
    if (!canAdd) return;

    const selectedVariantIds = variantTypes
      .filter((t) => selectedVariants[t])
      .map((t) => selectedVariants[t].id);

    addItem(
      {
        id: product.id,
        name: product.name,
        base_price: product.price,
        price: finalPrice,
        stock: product.stock,
        image_url: product.image_url,
        variant_ids: selectedVariantIds,
        variant_label: variantLabel,
      },
      qty,
    );

    setQty(1);
    toast.success("Berhasil ditambahkan ke keranjang!");

    // Feedback visual sesaat
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  }

  function handleCheckout() {
    setCartOpen(false);
    navigate("/checkout");
  }

  // ── Label tipe varian untuk UI ─────────────────────────────────────────
  const tipeLabel = { ukuran: "Ukuran", rasa: "Rasa" };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-primary transition-opacity hover:opacity-80">
            <ArrowLeft size={20} className="text-neutral-600" />
            <span>Clucky<span className="text-secondary">Taiwan</span></span>
          </Link>

          <button
            onClick={() => setCartOpen(true)}
            aria-label={`Buka keranjang, ${itemCount} item`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-neutral-900 transition-colors hover:bg-neutral-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ShoppingBag size={22} />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-body text-[11px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Notifikasi: sebagian item paket rekomendasi sudah masuk keranjang */}
      {(addedFromPackage > 0 || preselectVariantIds.length > 0) && !loading && !error && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8 space-y-2">
          {addedFromPackage > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>
                {addedFromPackage} item lain dari paket rekomendasi sudah masuk keranjang.
                Lengkapi pilihan varian di bawah untuk melanjutkan.
              </span>
            </div>
          )}
          {preselectVariantIds.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              <Sparkles size={16} className="shrink-0" />
              <span>
                Varian sudah dipilihkan otomatis sesuai budget kamu. Kamu tetap bisa
                mengganti pilihan, tapi harga akhirnya bisa berubah.
              </span>
            </div>
          )}
          {otherVariantItems.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Tag size={16} className="shrink-0" />
              <span>
                Paket ini juga berisi {otherVariantItems.join(", ")} — tambahkan manual
                ke keranjang setelah ini karena masing-masing perlu pilih varian sendiri.
              </span>
            </div>
          )}
        </div>
      )}

      {/* CONTENT */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-danger font-semibold text-lg">{error}</p>
            <Link to="/" className="mt-4 inline-block text-primary hover:underline">Kembali ke Beranda</Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden lg:flex">

            {/* GAMBAR */}
            <div className="w-full lg:w-1/2 aspect-square lg:aspect-auto relative bg-neutral-100">
              {product.image_url ? (
                <img
                  src={getOptimizedImageUrl(product.image_url, { width: 600 })}
                  alt={product.name}
                  width={600}
                  height={600}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex w-full h-full min-h-[300px] items-center justify-center text-neutral-400 font-medium">
                  Belum Ada Gambar
                </div>
              )}
              {product.stock <= 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm">
                  <span className="rounded-full bg-white px-4 py-1.5 font-display text-sm font-bold text-neutral-900 uppercase tracking-widest shadow-lg">
                    Stok Habis
                  </span>
                </div>
              )}
            </div>

            {/* DETAIL */}
            <div className="w-full lg:w-1/2 p-6 sm:p-10 lg:p-12 flex flex-col">
              <span className="inline-block rounded-full bg-primary/10 text-primary px-3 py-1 font-body text-xs font-bold uppercase tracking-wider w-fit mb-4">
                {product.category}
              </span>

              <h1 className="font-display text-3xl sm:text-4xl font-bold text-neutral-900 mb-2">
                {product.name}
              </h1>

              {/* Harga dinamis */}
              <div className="mb-6">
                <p className="font-display text-2xl font-bold text-primary">
                  {formatRupiah(finalPrice)}
                </p>
                {extraPrice > 0 && (
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Harga dasar {formatRupiah(product.price)} + varian {formatRupiah(extraPrice)}
                  </p>
                )}
                {/* Peringatan kalau pilihan varian user membuat harga melebihi
                    budget yang dia input di BudgetRecommender. Cuma tampil kalau
                    referenceBudget ada (artinya user datang dari kartu rekomendasi). */}
                {referenceBudget != null && finalPrice > referenceBudget && (
                  <p className="text-xs text-danger font-medium mt-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 inline-block">
                    Melebihi budget kamu ({formatRupiah(referenceBudget)}) sebesar{" "}
                    {formatRupiah(finalPrice - referenceBudget)}
                  </p>
                )}
              </div>

              <div className="flex-1 space-y-6">
                {/* Deskripsi */}
                {product.description && (
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-2">Deskripsi</h3>
                    <p className="text-neutral-600 leading-relaxed font-body text-sm sm:text-base">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* ── Selector Varian ─────────────────────────────────── */}
                {variantTypes.map((tipe) => (
                  <div key={tipe}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-neutral-900">
                        {tipeLabel[tipe] ?? tipe}
                      </h3>
                      <span className="text-xs font-medium text-danger">*wajib</span>
                      {selectedVariants[tipe] && (
                        <CheckCircle2 size={14} className="text-green-500 ml-auto" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {groupedVariants[tipe].map((v) => {
                        const isSelected = selectedVariants[tipe]?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => selectVariant(tipe, v)}
                            className={`px-4 py-2 rounded-xl border-2 font-body text-sm font-semibold transition-all ${
                              isSelected
                                ? "border-primary bg-primary text-white shadow-sm"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-primary/50 hover:bg-primary/5"
                            }`}
                          >
                            {v.nama}
                            {Number(v.harga_tambahan) > 0 && (
                              <span className={`ml-1.5 text-xs font-normal ${isSelected ? "text-white/80" : "text-primary"}`}>
                                +{formatRupiah(v.harga_tambahan)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Action Area ─────────────────────────────────────── */}
              <div className="border-t border-neutral-200 pt-6 mt-6">
                <p className="text-sm text-neutral-500 mb-3">
                  Ketersediaan: <span className="font-semibold text-neutral-900">{product.stock} porsi</span>
                </p>

                {/* Hint jika varian belum dipilih semua */}
                {variantTypes.length > 0 && !allVariantsSelected && (
                  <p className="text-xs text-amber-600 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Pilih{" "}
                    {variantTypes
                      .filter((t) => !selectedVariants[t])
                      .map((t) => tipeLabel[t] ?? t)
                      .join(" & ")}{" "}
                    terlebih dahulu
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Qty Stepper */}
                  <div className="flex items-center rounded-xl border-2 border-neutral-200 bg-neutral-50 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      disabled={!canAdd}
                      className="flex h-12 w-12 items-center justify-center text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
                    >
                      <Minus size={18} />
                    </button>
                    <span className="w-10 text-center font-body text-base font-semibold tabular-nums text-neutral-900">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                      disabled={!canAdd}
                      className="flex h-12 w-12 items-center justify-center text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {/* Tombol Add to Cart */}
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!canAdd}
                    className={`flex-1 flex h-12 items-center justify-center gap-2 rounded-xl font-body text-base font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      addedFeedback
                        ? "bg-green-500"
                        : "bg-primary hover:bg-primary-dark"
                    }`}
                  >
                    {addedFeedback ? (
                      <>
                        <CheckCircle2 size={18} />
                        Ditambahkan!
                      </>
                    ) : (
                      <>
                        <ShoppingBag size={18} />
                        Tambah ke Keranjang — {formatRupiah(finalPrice)}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckout} />
    </div>
  );
}