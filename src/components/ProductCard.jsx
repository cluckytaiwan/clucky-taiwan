// src/components/ProductCard.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Minus, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { useCartStore } from "../store/cartStore";
import { useVariantModalStore } from "../store/variantModalStore";
import { formatRupiah } from "../utils/formatCurrency";
import { getOptimizedImageUrl } from "../utils/imageUrl";
import toast from "react-hot-toast";

// Badge status stok — konsisten dgn pola 3-state di design.md
function getStockBadge(product) {
  if (product.stock <= 0) return { label: "Habis", className: "bg-neutral-900/80 text-white" };
  if (product.stock <= 5) return { label: "Stok Terbatas", className: "bg-secondary text-neutral-900" };
  return { label: "Tersedia", className: "bg-success/90 text-white" };
}

export default function ProductCard({ product }) {
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const { openModal } = useVariantModalStore();

  const isOutOfStock = product.stock <= 0;
  const hasVariants = Boolean(product.has_variants);

  // Preview chip varian — nama opsi (mis. "Original", "Jumbo") dari useProducts.js,
  // tampilkan maksimal 5 biar card tidak melar.
  // Catatan: sebelumnya baca product.sizes/product.flavors, dua field yang tidak
  // pernah dikirim oleh useProducts.js sehingga chip ini selalu kosong.
  const variantPreview = hasVariants ? (product.variant_preview ?? []).slice(0, 5) : [];

  const stockBadge = getStockBadge(product);

  function handleAdd() {
    addItem(product, qty);
    setQty(1);
    toast.success("Berhasil ditambahkan ke keranjang!");
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-surface shadow-sm transition-shadow hover:shadow-md hover:border-primary/30">
      <Link to={`/produk/${product.id}`} className="relative aspect-square overflow-hidden bg-neutral-100 block">
        {product.image_url ? (
          <img
            src={getOptimizedImageUrl(product.image_url, { width: 400 })}
            alt={product.name}
            loading="lazy"
            width={400}
            height={400}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 font-body text-xs text-neutral-400">
            <ShoppingBag size={28} className="text-neutral-300" />
            Foto belum tersedia
          </div>
        )}

        {/* Badge status stok — pojok kiri atas */}
        <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 font-body text-[11px] font-bold shadow-sm ${stockBadge.className}`}>
          {stockBadge.label}
        </span>

        {/* Badge "Ada Varian" — pojok kanan atas */}
        {hasVariants && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 font-body text-[11px] font-bold text-neutral-700 shadow-sm">
            <SlidersHorizontal size={10} />
            Ada Varian
          </span>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50">
            <span className="rounded-full bg-surface px-3 py-1 font-body text-xs font-bold text-neutral-900">
              Stok Habis
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link to={`/produk/${product.id}`} className="hover:text-primary transition-colors">
          <h3 className="font-body text-base font-semibold leading-snug text-neutral-900 line-clamp-1">
            {product.name}
          </h3>
        </Link>

        {hasVariants && product.min_price !== product.max_price ? (
          <span className="mt-1.5 font-display text-lg font-bold tabular-nums text-primary">
            {formatRupiah(product.min_price)}
          </span>
        ) : (
          <span className="mt-1.5 font-display text-lg font-bold tabular-nums text-primary">
            {formatRupiah(hasVariants ? product.min_price : product.price)}
          </span>
        )}

        {/* Preview chip varian */}
        {hasVariants && variantPreview.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variantPreview.map((label) => (
              <span
                key={label}
                className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-body text-[11px] font-medium text-primary"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* CTA area */}
        {!isOutOfStock && (
          <div className="mt-3.5">
            {hasVariants ? (
              <button
                type="button"
                onClick={() => openModal(product.id)}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary font-body text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Plus size={14} />
                Pilih Varian
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Kurangi jumlah"
                    className="flex h-10 w-10 items-center justify-center rounded-l-xl text-neutral-900 transition-colors hover:bg-neutral-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-body text-sm tabular-nums text-neutral-900">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                    aria-label="Tambah jumlah"
                    className="flex h-10 w-10 items-center justify-center rounded-r-xl text-neutral-900 transition-colors hover:bg-neutral-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary font-body text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <ShoppingBag size={14} />
                  Tambah
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}