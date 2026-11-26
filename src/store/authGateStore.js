// src/store/authGateStore.js
//
// Penanda "perlu login dulu". Dipanggil dari mana saja (mis. cartStore saat tamu
// menekan Tambah ke keranjang); AuthGateModal di App yang menampilkannya.
import { create } from "zustand";

export const useAuthGateStore = create((set) => ({
  isOpen: false,
  message: "",
  openGate: (message = "Masuk atau daftar dulu untuk memesan.") => set({ isOpen: true, message }),
  closeGate: () => set({ isOpen: false }),
}));
