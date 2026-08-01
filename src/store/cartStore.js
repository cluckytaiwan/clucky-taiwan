// src/store/cartStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Menghasilkan cart_key unik per kombinasi produk + varian.
 * Produk yang sama dengan varian berbeda = baris terpisah di keranjang.
 * Produk tanpa varian = key = product_id saja.
 */
function makeCartKey(productId, variantIds = []) {
  if (!variantIds || variantIds.length === 0) return productId;
  return `${productId}::${[...variantIds].sort().join("_")}`;
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      /**
       * Struktur tiap item:
       * {
       *   cart_key,      string — unique key (productId atau productId::variantIds)
       *   product_id,    string
       *   name,          string
       *   base_price,    number — harga dasar produk sebelum varian
       *   price,         number — harga final = base_price + sum(variant harga_tambahan)
       *   qty,           number
       *   stock,         number — stok snapshot saat ditambahkan
       *   image_url,     string | undefined
       *   variant_ids,   string[] — array ID dari opsi_varian yang dipilih (kosong jika tidak ada)
       *   variant_label, string — "Large · Pedas Level 2" (kosong jika tidak ada varian)
       * }
       */
      items: [],

      /**
       * Tambah produk ke keranjang.
       * @param {Object} product - harus include: id, name, price, stock, image_url
       *                           opsional: variant_ids[], variant_label, base_price
       * @param {number} qty
       */
      addItem: (product, qty = 1) => {
        const variantIds = product.variant_ids ?? [];
        const cartKey = makeCartKey(product.id, variantIds);
        const basePrice = product.base_price ?? product.price;
        const finalPrice = product.price; // sudah dihitung di ProductDetailPage

        const items = get().items;
        const existing = items.find((i) => i.cart_key === cartKey);

        if (existing) {
          // Merge: tambah qty, tidak melebihi stok
          const newQty = Math.min(existing.qty + qty, product.stock);
          set({
            items: items.map((i) =>
              i.cart_key === cartKey ? { ...i, qty: newQty } : i,
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                cart_key: cartKey,
                product_id: product.id,
                name: product.name,
                base_price: basePrice,
                price: finalPrice,
                image_url: product.image_url,
                stock: product.stock,
                qty: Math.min(qty, product.stock),
                variant_ids: variantIds,
                variant_label: product.variant_label ?? "",
              },
            ],
          });
        }
      },

      /**
       * Update jumlah item berdasarkan cart_key.
       * Jika qty <= 0, hapus item.
       * @param {string} cartKey
       * @param {number} qty
       */
      updateQty: (cartKey, qty) => {
        if (qty <= 0) {
          get().removeItem(cartKey);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.cart_key === cartKey ? { ...i, qty: Math.min(qty, i.stock) } : i,
          ),
        });
      },

      /**
       * Hapus item berdasarkan cart_key.
       * @param {string} cartKey
       */
      removeItem: (cartKey) => {
        set({ items: get().items.filter((i) => i.cart_key !== cartKey) });
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: "clucky-cart" },
  ),
);
