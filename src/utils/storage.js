// src/utils/storage.js

const ORDERS_KEY = "clucky_order_history";
const PROFILE_KEY = "clucky_customer_profile";

// --- Profile Storage ---
export function saveCustomerProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Failed to save profile", err);
  }
}

export function getCustomerProfile() {
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
}

// --- Order History Storage ---
// Format order: { kode, hp, total, date }
export function saveOrderToHistory(order) {
  try {
    const existing = getOrderHistory();
    // Cek apakah order dengan kode yang sama sudah ada (hindari duplikat)
    const filtered = existing.filter((o) => o.kode !== order.kode);
    
    // Tambahkan di urutan pertama (paling baru)
    const updated = [order, ...filtered];
    
    // Simpan maksimal 20 pesanan terakhir agar tidak memberatkan localStorage
    localStorage.setItem(ORDERS_KEY, JSON.stringify(updated.slice(0, 20)));
  } catch (err) {
    console.error("Failed to save order history", err);
  }
}

export function getOrderHistory() {
  try {
    const data = localStorage.getItem(ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    return [];
  }
}
