// src/store/cartStore.js
//
// Keranjang belanja tersimpan di DATABASE per akun (tabel keranjang_item), bukan di
// perangkat. Pelanggan harus login untuk menambah ke keranjang; keranjang yang sama
// terlihat di perangkat mana pun. Tampilan diperbarui langsung (optimistic), lalu
// disimpan ke database di latar belakang; bila gagal, keranjang dimuat ulang dari database.
import { create } from "zustand";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabaseClient";
import { useAuthGateStore } from "./authGateStore";

/**
 * Menghasilkan cart_key unik per kombinasi produk + varian.
 * Produk yang sama dengan varian berbeda = baris terpisah di keranjang.
 * Produk tanpa varian = key = product_id saja.
 */
function makeCartKey(productId, variantIds = []) {
  if (!variantIds || variantIds.length === 0) return productId;
  return `${productId}::${[...variantIds].sort().join("_")}`;
}

function toRow(userId, item) {
  return {
    user_id: userId,
    cart_key: item.cart_key,
    produk_id: item.product_id,
    varian_ids: item.variant_ids ?? [],
    jumlah: item.qty,
  };
}

export const useCartStore = create((set, get) => {
  /** Simpan gagal → tampilkan pesan dan samakan lagi dengan database. */
  function onSaveError(error) {
    console.error("[cart] gagal menyimpan:", error);
    toast.error("Keranjang gagal disimpan. Memuat ulang…");
    const { userId } = get();
    if (userId) get().loadCart(userId);
  }

  async function persistUpsert(items) {
    const { userId } = get();
    if (!userId || items.length === 0) return;
    const { error } = await supabase
      .from("keranjang_item")
      .upsert(items.map((i) => toRow(userId, i)), { onConflict: "user_id,cart_key" });
    if (error) onSaveError(error);
  }

  async function persistDelete(cartKeys) {
    const { userId } = get();
    if (!userId) return;
    let q = supabase.from("keranjang_item").delete().eq("user_id", userId);
    if (cartKeys) q = q.in("cart_key", cartKeys);
    const { error } = await q;
    if (error) onSaveError(error);
  }

  return {
    /**
     * Struktur tiap item:
     * {
     *   cart_key, product_id, name,
     *   base_price,    harga dasar produk sebelum varian
     *   price,         harga final = base_price + sum(harga_tambahan varian)
     *   qty, stock, image_url,
     *   variant_ids,   ID opsi_varian yang dipilih (kosong jika tanpa varian)
     *   variant_label  "Large · Pedas Level 2" (kosong jika tanpa varian)
     * }
     * Harga, stok, dan nama selalu diambil terbaru dari database saat keranjang dimuat.
     */
    items: [],
    userId: null,
    loading: false,

    /** Muat keranjang milik akun dari database. Dipanggil AuthContext saat login. */
    loadCart: async (userId) => {
      set({ userId, loading: true });
      const { data: rows, error } = await supabase
        .from("keranjang_item")
        .select("cart_key, produk_id, varian_ids, jumlah, produk(nama_produk, harga, stok, url_gambar, aktif)")
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[cart] gagal memuat:", error);
        set({ items: [], loading: false });
        return;
      }

      const variantIds = [...new Set((rows ?? []).flatMap((r) => r.varian_ids ?? []))];
      const variantMap = new Map();
      if (variantIds.length > 0) {
        const { data: variants } = await supabase
          .from("opsi_varian")
          .select("id, nama, harga_tambahan")
          .in("id", variantIds);
        for (const v of variants ?? []) variantMap.set(v.id, v);
      }

      const items = [];
      const staleKeys = [];
      for (const r of rows ?? []) {
        const ids = r.varian_ids ?? [];
        const variants = ids.map((id) => variantMap.get(id));
        // Produk dihapus/nonaktif atau varian sudah tidak ada: baris keranjang dibuang
        if (!r.produk || !r.produk.aktif || variants.some((v) => !v)) {
          staleKeys.push(r.cart_key);
          continue;
        }
        const base = Number(r.produk.harga);
        const extra = variants.reduce((s, v) => s + Number(v.harga_tambahan || 0), 0);
        items.push({
          cart_key: r.cart_key,
          product_id: r.produk_id,
          name: r.produk.nama_produk,
          base_price: base,
          price: base + extra,
          image_url: r.produk.url_gambar ?? undefined,
          stock: r.produk.stok,
          qty: r.produk.stok > 0 ? Math.min(r.jumlah, r.produk.stok) : r.jumlah,
          variant_ids: ids,
          variant_label: variants.map((v) => v.nama).join(" · "),
        });
      }
      // Hindari menimpa keranjang bila akun sudah berganti selama memuat
      if (get().userId !== userId) return;
      set({ items, loading: false });
      if (staleKeys.length > 0) persistDelete(staleKeys);
    },

    /** Kosongkan keranjang di memori saat logout (data di database tetap ada). */
    reset: () => set({ items: [], userId: null, loading: false }),

    /**
     * Tambah produk ke keranjang. Wajib login: tamu diminta masuk/daftar dulu.
     * @param {Object} product - id, name, price, stock, image_url; opsional variant_ids[], variant_label, base_price
     * @param {number} qty
     * @returns {number} jumlah yang benar-benar ditambahkan (0 bila stok habis atau belum login)
     */
    addItem: (product, qty = 1) => {
      if (!get().userId) {
        useAuthGateStore.getState().openGate("Masuk atau daftar dulu untuk menambahkan menu ke keranjang.");
        return 0;
      }
      const variantIds = product.variant_ids ?? [];
      const cartKey = makeCartKey(product.id, variantIds);
      const items = get().items;
      const existing = items.find((i) => i.cart_key === cartKey);

      if (existing) {
        // Merge: tambah qty, tidak melebihi stok
        const newQty = Math.min(existing.qty + qty, product.stock);
        const updated = { ...existing, qty: newQty };
        set({ items: items.map((i) => (i.cart_key === cartKey ? updated : i)) });
        if (newQty !== existing.qty) persistUpsert([updated]);
        return newQty - existing.qty;
      }

      const added = Math.min(qty, product.stock);
      if (added <= 0) return 0;
      const item = {
        cart_key: cartKey,
        product_id: product.id,
        name: product.name,
        base_price: product.base_price ?? product.price,
        price: product.price, // sudah dihitung di ProductDetailPage
        image_url: product.image_url,
        stock: product.stock,
        qty: added,
        variant_ids: variantIds,
        variant_label: product.variant_label ?? "",
      };
      set({ items: [...items, item] });
      persistUpsert([item]);
      return added;
    },

    /** Ubah jumlah item; qty <= 0 menghapus item. */
    updateQty: (cartKey, qty) => {
      if (qty <= 0) {
        get().removeItem(cartKey);
        return;
      }
      let changed = null;
      set({
        items: get().items.map((i) => {
          if (i.cart_key !== cartKey) return i;
          changed = { ...i, qty: Math.min(qty, i.stock) };
          return changed;
        }),
      });
      if (changed) persistUpsert([changed]);
    },

    removeItem: (cartKey) => {
      set({ items: get().items.filter((i) => i.cart_key !== cartKey) });
      persistDelete([cartKey]);
    },

    clearCart: () => {
      set({ items: [] });
      persistDelete(null);
    },

    /** Kembalikan isi keranjang (dipakai untuk "Urungkan" setelah dikosongkan). */
    restoreItems: (items) => {
      set({ items });
      persistUpsert(items);
    },

    getTotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),

    getItemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
  };
});
