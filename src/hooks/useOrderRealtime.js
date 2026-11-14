// src/hooks/useOrderRealtime.js
//
// Memantau perubahan status pesanan pelanggan tanpa refresh halaman.
//
// Sebelumnya hook ini memakai Supabase Realtime (postgres_changes) pada tabel
// pesanan, yang mengharuskan role anon punya akses SELECT ke SELURUH tabel
// (bocor PII). Sekarang memakai polling ke Edge Function check-order-status
// yang memvalidasi dua identitas (kode_pesanan + no HP).
//
// Polling berhenti otomatis saat pesanan mencapai kondisi akhir.

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
