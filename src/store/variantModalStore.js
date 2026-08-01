// src/store/variantModalStore.js
import { create } from "zustand";

export const useVariantModalStore = create((set) => ({
  isOpen: false,
  productId: null,
  preselectVariantIds: [],
  referenceBudget: null,
  otherVariantItems: [],
  
  openModal: (productId, options = {}) => set({
    isOpen: true,
    productId,
    preselectVariantIds: options.preselectVariantIds || [],
    referenceBudget: options.referenceBudget || null,
    otherVariantItems: options.otherVariantItems || [],
  }),
  
  closeModal: () => set({
    isOpen: false,
    // Kita biarkan state lainnya agar animasi tutup (drawer ke bawah) 
    // tidak langsung kosong melompong (flicker).
  }),
}));
