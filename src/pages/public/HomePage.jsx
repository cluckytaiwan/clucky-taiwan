import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import ProductCard from "../../components/ProductCard";
import CartDrawer from "../../components/CartDrawer";
import BudgetRecommender from "../../components/BudgetRecommender";
import { useCartStore } from "../../store/cartStore";
import { useProducts } from "../../hooks/useProducts";
import heroImage from "../../assets/hero.jpg";


export default function HomePage() {
  const [cartOpen, setCartOpen] = useState(false);
  const itemCount = useCartStore((s) => s.getItemCount());
  const navigate = useNavigate();
  const { products, loading, error } = useProducts();
  const [activeCategory, setActiveCategory] = useState("Semua");

  const categories = useMemo(() => {
    const cats = products.map((p) => p.category).filter(Boolean);
    return ["Semua", ...new Set(cats)];
  }, [products]);

  const displayedProducts = useMemo(() => {
    if (activeCategory === "Semua") return products;
    return products.filter((p) => p.category === activeCategory);
  }, [activeCategory, products]);

  function handleCheckout() {
    setCartOpen(false);
    navigate("/checkout");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to content - accessibility */}
      <a href="#katalog" className="skip-to-content font-body">
        Langsung ke Menu
      </a>

      {/* ===== HEADER / NAVBAR ===== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <span className="font-display text-xl font-extrabold tracking-tight text-primary">
            Clucky<span className="text-secondary">Taiwan</span>
          </span>

          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => navigate("/cek-pesanan")}
              className="font-body text-sm font-semibold text-neutral-600 hover:text-primary transition-colors"
            >
              Pesanan Saya
            </button>
            <button
              onClick={() => setCartOpen(true)}
              aria-label={`Buka keranjang, ${itemCount} item`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-neutral-800 bg-neutral-100 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-body text-[11px] font-bold text-white shadow-sm ring-2 ring-white">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[500px] sm:min-h-[600px] flex items-center overflow-hidden bg-neutral-900">
        <img
          src={heroImage}
          alt="Ayam Goreng Taiwan"
          className="absolute inset-0 w-full h-full object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="inline-block rounded-full bg-primary px-4 py-1.5 font-body text-[13px] font-bold text-white tracking-wide">
            Autentik Taiwan
          </span>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-[64px] font-extrabold text-white leading-[1.1] max-w-[700px] tracking-tight">
            Rasakan Kelezatan Ayam Goreng Taiwan
          </h1>
          <p className="mt-6 font-body text-base sm:text-lg text-white/90 max-w-[500px] leading-relaxed">
            Renyah di luar, juicy di dalam. Dibuat dengan resep asli Taiwan yang bikin ketagihan!
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a href="#katalog" className="h-[52px] px-8 flex items-center justify-center rounded-2xl bg-primary font-body text-[15px] font-bold text-white hover:bg-primary-dark transition-all active:scale-95 shadow-lg shadow-primary/20">
              Pesan Sekarang
            </a>
            <a href="#katalog" className="h-[52px] px-8 flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 backdrop-blur-md font-body text-[15px] font-bold text-white hover:bg-white/10 transition-all active:scale-95">
              Lihat Menu
            </a>
          </div>
        </div>
      </section>

      {/* Signature divider — gaya tiket robek */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-hidden="true">
        <div className="border-t-2 border-dashed border-neutral-200" />
      </div>

      {/* ===== BUDGET RECOMMENDER ===== */}
      {/* Fitur baru: rekomendasi sesuai budget pelanggan. Disembunyikan saat loading/error agar UX rapi */}
      {!loading && !error && products.length > 0 && (
        <BudgetRecommender products={products} onCartOpen={() => setCartOpen(true)} />
      )}

      {/* ===== GRID KATALOG PRODUK ===== */}
      <section id="katalog" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-display text-2xl font-bold text-neutral-900">Menu Kami</h2>

          {/* Kategori Filter */}
          {!loading && !error && categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors ${activeCategory === cat
                      ? "bg-primary text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-neutral-200/60 h-64" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <p className="text-center font-body text-sm text-danger">
            Gagal memuat menu: {error}
          </p>
        )}

        {/* Produk dari database (Kosong Total) */}
        {!loading && !error && products.length === 0 && (
          <p className="text-center font-body text-sm text-neutral-500">
            Belum ada menu tersedia saat ini.
          </p>
        )}

        {/* Produk filter kosong */}
        {!loading && !error && products.length > 0 && displayedProducts.length === 0 && (
          <p className="text-center font-body text-sm text-neutral-500 py-10">
            Tidak ada menu di kategori ini.
          </p>
        )}

        {!loading && !error && displayedProducts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-neutral-200 py-8 text-center">
        <p className="font-body text-sm text-neutral-500">
          © {new Date().getFullYear()} Clucky Taiwan. Selera autentik Taiwan.
        </p>
      </footer>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckout} />
    </div>
  );
}
