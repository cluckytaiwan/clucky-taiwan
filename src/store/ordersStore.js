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
  // Filter server-side untuk halaman Sales: pencarian & status bayar berlaku
  // ke SELURUH pesanan, bukan hanya 25 baris di halaman aktif.
  // status: "aktif" (lunas & belum selesai — default, antrean dapur), "all",
  // atau salah satu nilai status_pembayaran.
  filters:      { search: "", status: "aktif" },
  // Hitungan seluruh pesanan (bukan hanya halaman aktif) untuk statistik ringkas
  counts:       { diproses: 0, siap: 0, menunggu: 0 },

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

    const { search, status } = get().filters;

    let query = supabase
      .from("pesanan")
      .select("*, detail_pesanan(*, produk(nama_produk))", { count: "exact" })
      .range(from, to);

    if (status === "aktif") {
      // Antrean kerja: paling lama di atas supaya dikerjakan berurutan
      query = query
        .eq("status_pembayaran", "lunas")
        .neq("status_pesanan", "selesai")
        .order("created_at", { ascending: true });
    } else if (status !== "all") {
      query = query.eq("status_pembayaran", status);
    }

    // Buang karakter yang punya arti khusus di filter PostgREST (koma, kurung, dll.)
    const q = search.replace(/[^\p{L}\p{N}\s+-]/gu, "").trim();
    if (q) {
      query = query.or(
        `nama_pelanggan.ilike.%${q}%,no_hp_pelanggan.ilike.%${q}%,kode_pesanan.ilike.%${q}%`,
      );
    }

    if (status !== "aktif") query = query.order("created_at", { ascending: false });

    const { data, count, error } = await query;
    if (error) console.error("[ordersStore] fetchSales:", error.message);

    set({
      orders:       data || [],
      totalCount:   count ?? get().totalCount,
      salesLoading: false,
    });
  },

  /* ─── Action: hitungan untuk statistik ringkas (seluruh pesanan) ─── */
  fetchCounts: async () => {
    const head = { count: "exact", head: true };
    const [diproses, siap, menunggu] = await Promise.all([
      supabase.from("pesanan").select("id", head).eq("status_pembayaran", "lunas").eq("status_pesanan", "diproses"),
      supabase.from("pesanan").select("id", head).eq("status_pembayaran", "lunas").eq("status_pesanan", "dikirim"),
      supabase.from("pesanan").select("id", head).eq("status_pembayaran", "menunggu_pembayaran"),
    ]);
    set({
      counts: {
        diproses: diproses.count ?? 0,
        siap:     siap.count ?? 0,
        menunggu: menunggu.count ?? 0,
      },
    });
  },

  /* ─── Action: tandai selesai semua pesanan lunas yang dibayar > 1 hari lalu ─── */
  completeOldOrders: async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("pesanan")
      .update({ status_pesanan: "selesai" })
      .eq("status_pembayaran", "lunas")
      .neq("status_pesanan", "selesai")
      .lt("created_at", cutoff)
      .select("id");
    if (!error) {
      (data || []).forEach((o) => markOrderHandled(o.id));
      get().fetchSales(0);
      get().fetchCounts();
    }
    return { count: data?.length ?? 0, error };
  },

  /* ─── Action: ubah filter lalu muat ulang dari halaman pertama ─── */
  setFilters: (patch) => {
    set(state => ({ filters: { ...state.filters, ...patch } }));
    get().fetchSales(0);
  },

  /* ─── Action: update fulfillment (optimistic + DB) ──────── */
  updateFulfillment: async (orderId, newStatus) => {
    // Tandai agar tidak memicu notifikasi pesanan masuk saat event realtime UPDATE tiba
    markOrderHandled(orderId);

    const previous = get().orders.find(o => o.id === orderId)?.status_pesanan;

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

    if (error) {
      // Gagal (mis. koneksi putus): kembalikan tampilan — tidak akan ada event
      // realtime yang mengoreksi karena data di server memang tidak berubah.
      set(state => ({
        orders: state.orders.map(o =>
          o.id === orderId ? { ...o, status_pesanan: previous } : o
        ),
      }));
    } else {
      get().fetchCounts();
    }
    return error;
  },

  /* ─── Internal: sinyal perubahan ke Dashboard ───────────── */
  _signalChange: () => {
    set({ lastChangeAt: Date.now() });
    get().fetchCounts();
  },

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
