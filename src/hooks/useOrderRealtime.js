// src/hooks/useOrderRealtime.js
//
// Memantau status pesanan pelanggan tanpa refresh halaman memakai Supabase Realtime
// (perubahan baris pesanan milik akun, dijaga RLS), dengan pemeriksaan berkala ke
// Edge Function check-order-status sebagai cadangan bila koneksi Realtime terputus.
// Pemantauan berhenti otomatis saat pesanan selesai atau gagal.

import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { pollOrderStatus } from "../utils/orderStatusApi";

const FAILED_STATUSES = ["kadaluarsa", "dibatalkan", "ditolak", "dikembalikan"];

function isTerminal(order) {
  return FAILED_STATUSES.includes(order.status) || order.fulfillment_status === "selesai";
}

/**
 * @param {string|null} orderId     - id (uuid) pesanan yang dipantau
 * @param {string|null} kodePesanan - kode pesanan (untuk pemeriksaan cadangan)
 * @param {Function}   onUpdate     - Callback(patch) berisi bagian pesanan yang berubah
 * @param {Function}   onLiveChange - Callback(isLive: boolean) saat pemantauan aktif/berhenti
 */
export function useOrderRealtime(orderId, kodePesanan, onUpdate, onLiveChange) {
  const onUpdateRef = useRef(onUpdate);
  const onLiveChangeRef = useRef(onLiveChange);

  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onLiveChangeRef.current = onLiveChange; }, [onLiveChange]);

  useEffect(() => {
    if (!orderId || !kodePesanan) return;

    // 1. Realtime: perubahan langsung dari database
    const channel = supabase
      .channel(`pesanan-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pesanan", filter: `id=eq.${orderId}` },
        ({ new: n }) => {
          onUpdateRef.current?.({
            status: n.status_pembayaran,
            fulfillment_status: n.status_pesanan,
            updated_at: n.updated_at,
          });
        },
      )
      .subscribe((status) => onLiveChangeRef.current?.(status === "SUBSCRIBED"));

    // 2. Cadangan: tanya server tiap 15 detik (lebih jarang dari polling lama)
    const stop = pollOrderStatus(
      kodePesanan,
      (order) => {
        onUpdateRef.current?.(order);
        return isTerminal(order);
      },
      15000,
    );

    return () => {
      stop();
      supabase.removeChannel(channel);
      onLiveChangeRef.current?.(false);
    };
  }, [orderId, kodePesanan]);
}
