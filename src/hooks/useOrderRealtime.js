// src/hooks/useOrderRealtime.js
//
// Hook ini mengelola Supabase Realtime subscription untuk memantau
// perubahan status pesanan secara langsung (tanpa refresh halaman).
//
// Alur kerja:
//   1. Menerima kode_pesanan + no_hp sebagai identifier pelanggan
//   2. Subscribe ke Supabase channel "pesanan" dengan filter kode_pesanan
//   3. Saat event UPDATE diterima, panggil ulang Edge Function check-order-status
//      agar data sensitif tetap aman (melalui validasi dua identitas)
//   4. Callback onUpdate(data) dipanggil dengan data terbaru
//   5. Channel di-cleanup otomatis saat komponen unmount / kode berubah

import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * useOrderRealtime — Subscribe ke perubahan status pesanan secara real time.
 *
 * @param {string|null} kodePesanan - Kode unik pesanan (misal: "CLK-20250918-A1B2")
 * @param {string|null} noHp       - Nomor HP pelanggan, digunakan untuk re-fetch aman
 * @param {Function}   onUpdate    - Callback dipanggil dengan data order terbaru
 * @param {Function}   onLiveChange - Callback(isLive: boolean) saat status koneksi berubah
 */
export function useOrderRealtime(kodePesanan, noHp, onUpdate, onLiveChange) {
  // Gunakan ref agar callback selalu merujuk ke versi terbaru tanpa re-subscribe
  const onUpdateRef = useRef(onUpdate);
  const onLiveChangeRef = useRef(onLiveChange);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onLiveChangeRef.current = onLiveChange;
  }, [onLiveChange]);

  useEffect(() => {
    // Hanya subscribe jika kode pesanan dan nomor HP sudah tersedia
    if (!kodePesanan || !noHp) return;

    /**
     * Re-fetch data pesanan melalui Edge Function yang aman.
     * Tidak langsung membaca dari DB — Edge Function memvalidasi
     * dua identitas (kode_pesanan + no_hp_pelanggan) sebelum mengembalikan data.
     */
    async function refetchOrder() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-order-status`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              kode_pesanan: kodePesanan,
              customer_phone: noHp,
            }),
          }
        );
        const data = await res.json();
        if (data.success && onUpdateRef.current) {
          onUpdateRef.current(data.order);
        }
      } catch (err) {
        console.warn("[useOrderRealtime] refetch gagal:", err.message);
      }
    }

    // Nama channel unik per pesanan — mencegah collision antar pelanggan
    const channelName = `order-status-${kodePesanan}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pesanan",
          // Filter di sisi server: hanya terima event untuk pesanan ini
          filter: `kode_pesanan=eq.${kodePesanan}`,
        },
        (_payload) => {
          // Saat ada perubahan, re-fetch via Edge Function untuk keamanan
          refetchOrder();
        }
      )
      .subscribe((status) => {
        // Notifikasi komponen tentang status koneksi realtime
        const isLive = status === "SUBSCRIBED";
        if (onLiveChangeRef.current) {
          onLiveChangeRef.current(isLive);
        }
      });

    // Cleanup: hapus channel saat komponen unmount atau kode_pesanan berubah
    return () => {
      supabase.removeChannel(channel);
      if (onLiveChangeRef.current) {
        onLiveChangeRef.current(false);
      }
    };
  }, [kodePesanan, noHp]); // Re-subscribe hanya jika identitas pesanan berubah
}
