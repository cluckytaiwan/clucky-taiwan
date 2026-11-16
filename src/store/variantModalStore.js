// src/store/variantModalStore.js
import { create } from "zustand";

export const useVariantModalStore = create((set) => ({
  isOpen: false,
  productId: null,
  preselectVariantIds: [],
  referenceBudget: null,
  otherVariantItems: [],
  // Antrean produk bervarian berikutnya dari paket rekomendasi:
  // [{ id, name, preselectVariantIds }] — dibuka otomatis setelah "Tambah".
  queue: [],
  
  openModal: (productId, options = {}) => set({
    isOpen: true,
    productId,
    preselectVariantIds: options.preselectVariantIds || [],
    referenceBudget: options.referenceBudget || null,
    otherVariantItems: options.otherVariantItems || [],
    queue: options.queue || [],
  }),
  
  closeModal: () => set({
    isOpen: false,
    // Kita biarkan state lainnya agar animasi tutup (drawer ke bawah) 
    // tidak langsung kosong melompong (flicker).
  }),
}));
