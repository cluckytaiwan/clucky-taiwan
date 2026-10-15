// src/components/ProductCard.jsx
import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "../store/cartStore";
import { useVariantModalStore } from "../store/variantModalStore";
import { formatRupiah } from "../utils/formatCurrency";
import { getOptimizedImageUrl } from "../utils/imageUrl";
import toast from "react-hot-toast";

// Badge status stok — hanya tampil saat ada urgensi (habis / stok menipis)
function getStockBadge(product) {
  if (product.stock <= 0) return { label: "Habis", className: "bg-neutral-900/80 text-white" };
  if (product.stock <= 5) return { label: "Stok Terbatas", className: "bg-secondary text-neutral-900" };
  return null;
}

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem);
  const { openModal } = useVariantModalStore();

  const isOutOfStock = product.stock <= 0;
  const hasVariants = Boolean(product.has_variants);
  const stockBadge = getStockBadge(product);

  const displayPrice = hasVariants ? product.min_price : product.price;

  function handleAdd() {
    if (isOutOfStock) return;
    if (hasVariants) {
      openModal(product.id);
      return;
    }
    addItem(product, 1);
    toast.success("Berhasil ditambahkan ke keranjang!");
  }

  return (
    <div className="group mx-auto flex h-full w-full max-w-[260px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-surface p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
      {/* a. Image wrapper — fixed height 160px */}
      <Link to={`/produk/${product.id}`} className="relative block h-[160px] overflow-hidden rounded-lg bg-neutral-100">
        {product.image_url ? (
          <img
            src={getOptimizedImageUrl(product.image_url, { width: 600 })}
            alt={product.name}
            loading="lazy"
            width={600}
            height={600}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 font-body text-xs text-neutral-400">
            <ShoppingBag size={28} className="text-neutral-300" />
            Foto belum tersedia
          </div>
        )}

        {/* Badge status stok — pojok kiri atas, hanya saat urgensi */}
        {stockBadge && (
          <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 font-body text-[11px] font-bold shadow-sm ${stockBadge.className}`}>
            {stockBadge.label}
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

      {/* b. Info wrapper — margin top 12px */}
      <div className="mt-3 flex min-w-0 flex-1 flex-col">
        <Link to={`/produk/${product.id}`} className="hover:text-primary transition-colors">
          <h3 className="line-clamp-2 font-body text-sm font-bold leading-tight text-neutral-900 sm:text-base">
            {product.name}
          </h3>
        </Link>

        <span className="mt-1 font-display text-base font-extrabold tabular-nums text-primary sm:text-lg">
          {formatRupiah(displayPrice)}
        </span>
      </div>

      {/* c. Action wrapper — margin top 12px, mt-auto agar tombol rata bawah */}
      <div className="mt-3">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-primary font-body text-sm font-bold text-white transition-all hover:bg-primary-dark active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          Tambah
        </button>
      </div>
    </div>
  );
}
