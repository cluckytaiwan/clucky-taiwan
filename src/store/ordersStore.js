// src/store/ordersStore.js
//
// Shared Zustand store untuk data pesanan admin.
// Tujuan utama: satu sumber data (single source of truth) dan satu realtime
// channel yang dibagi antara AdminDashboard dan AdminSales, sehingga:
//   – Perubahan order di Sales langsung terlihat di Dashboard (via lastChangeAt)
//   – Perubahan order di Dashboard realtime langsung memperbarui list di Sales
//   – Tidak ada duplikasi realtime channel
//
// Arsitektur:
//   - orders[]         → state untuk halaman Sales (paginated)
//   - totalCount       → total row di DB untuk pagination Sales
//   - salesLoading     → loading indicator Sales
//   - lastChangeAt     → timestamp yang berubah setiap ada event realtime;
//                        Dashboard watch ini via useEffect untuk re-fetch aggregasi
//   - _channel         → referensi channel Supabase (private, dikelola store)
//
// Setup/teardown realtime dilakukan dari AdminLayout (parent semua admin page)
// sehingga channel hidup selama user berada di area admin.

import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import { markOrderHandled } from "../context/OrderNotificationContext";

export const PAGE_SIZE = 25;

export const useOrdersStore = create((set, get) => ({
  /* ─── State Sales ────────────────────────────────────────── */
  orders:       [],
  totalCount:   0,
  page:         0,
  salesLoading: true,

  /* ─── Sync signal untuk Dashboard ───────────────────────── */
  // Dashboard memonitor ini; setiap ada perubahan realtime → Dashboard refetch
  lastChangeAt: null,

  /* ─── Internal realtime channel ─────────────────────────── */
  _channel: null,

  /* ─── Action: fetch halaman penjualan ───────────────────── */
  fetchSales: async (page) => {
    const pg = page ?? get().page;
    set({ salesLoading: true, page: pg });

    const from = pg * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from("pesanan")
      .select("*, detail_pesanan(*, produk(nama_produk))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    set({
      orders:       data || [],
      totalCount:   count ?? get().totalCount,
      salesLoading: false,
    });
  },

  /* ─── Action: update fulfillment (optimistic + DB) ──────── */
  updateFulfillment: async (orderId, newStatus) => {
    // Tandai agar tidak memicu notifikasi pesanan masuk saat event realtime UPDATE tiba
    markOrderHandled(orderId);

    // Optimistic update di store
    set(state => ({
      orders: state.orders.map(o =>
        o.id === orderId ? { ...o, status_pesanan: newStatus } : o
      ),
    }));

    const { error } = await supabase
      .from("pesanan")
      .update({ status_pesanan: newStatus })
      .eq("id", orderId);

    // Rollback tidak dilakukan — realtime UPDATE akan mengoreksi jika gagal
    return error;
  },

  /* ─── Internal: sinyal perubahan ke Dashboard ───────────── */
  _signalChange: () => set({ lastChangeAt: Date.now() }),

  /* ─── Realtime handlers ──────────────────────────────────── */
  _handleInsert: async (n) => {
    // Fetch ulang dengan relasi (detail_pesanan + produk) karena realtime
    // INSERT hanya membawa kolom pesanan, bukan join-nya
    const { data } = await supabase
      .from("pesanan")
      .select("*, detail_pesanan(*, produk(nama_produk))")
      .eq("id", n.id)
      .single();

    if (data) {
      set(state => ({
        orders: [data, ...state.orders.filter(o => o.id !== data.id)],
        totalCount: state.totalCount + 1,
      }));
    }
    get()._signalChange();
  },

  _handleUpdate: (n) => {
    set(state => ({
      orders: state.orders.map(o => o.id === n.id ? { ...o, ...n } : o),
    }));
    get()._signalChange();
  },

  _handleDelete: (o) => {
    set(state => ({
      orders: state.orders.filter(r => r.id !== o.id),
      totalCount: Math.max(0, state.totalCount - 1),
    }));
    get()._signalChange();
  },

  /* ─── Realtime lifecycle (dipanggil dari AdminLayout) ────── */
  setupRealtime: () => {
    if (get()._channel) return; // sudah aktif, jangan duplikat

    const channel = supabase
      .channel("admin-orders-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pesanan" },
        ({ eventType, new: n, old: o }) => {
          if      (eventType === "INSERT") get()._handleInsert(n);
          else if (eventType === "UPDATE") get()._handleUpdate(n);
          else if (eventType === "DELETE") get()._handleDelete(o);
        }
      )
      .subscribe();

    set({ _channel: channel });
  },

  teardownRealtime: () => {
    const ch = get()._channel;
    if (ch) {
      supabase.removeChannel(ch);
      set({ _channel: null });
    }
  },
}));
