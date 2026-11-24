// src/hooks/useOrderRealtime.js
//
// Memantau status pesanan pelanggan tanpa refresh halaman, dengan polling ke
// Edge Function check-order-status (kode + no HP). Tidak memakai Supabase Realtime
// karena Realtime mengharuskan tabel pesanan bisa dibaca publik.
// Polling berhenti otomatis saat pesanan selesai atau gagal.

import { useEffect, useRef } from "react";
import { pollOrderStatus } from "../utils/orderStatusApi";

const FAILED_STATUSES = ["kadaluarsa", "dibatalkan", "ditolak", "dikembalikan"];

function isTerminal(order) {
  return FAILED_STATUSES.includes(order.status) || order.fulfillment_status === "selesai";
}

/**
 * @param {string|null} kodePesanan
 * @param {string|null} noHp
 * @param {Function}   onUpdate     - Callback dengan data order terbaru
 * @param {Function}   onLiveChange - Callback(isLive: boolean) saat pemantauan aktif/berhenti
 */
export function useOrderRealtime(kodePesanan, noHp, onUpdate, onLiveChange) {
  const onUpdateRef = useRef(onUpdate);
  const onLiveChangeRef = useRef(onLiveChange);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onLiveChangeRef.current = onLiveChange;
  }, [onLiveChange]);

  useEffect(() => {
    if (!kodePesanan || !noHp) return;

    onLiveChangeRef.current?.(true);

    const stop = pollOrderStatus(kodePesanan, noHp, (order) => {
      onUpdateRef.current?.(order);
      if (isTerminal(order)) {
        onLiveChangeRef.current?.(false);
        return true;
      }
      return false;
    });

    return () => {
      stop();
      onLiveChangeRef.current?.(false);
    };
  }, [kodePesanan, noHp]);
}
