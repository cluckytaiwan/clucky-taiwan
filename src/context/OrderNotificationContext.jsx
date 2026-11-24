// src/context/OrderNotificationContext.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabaseClient";
import OrderToast from "../components/admin/OrderToast";
import notifSound from "../assets/notification.mp3";

const OrderNotificationContext = createContext(null);

const MUTE_KEY = "clucky_notif_muted";
const NOTIFIED_STORAGE_KEY = "clucky_notified_order_ids";

// Set in-memory global untuk melacak order yang sudah ditangani/dinotifikasi
export const handledOrderIds = new Set();

// Helper untuk menandai order sudah diproses (dapat dipanggil dari ordersStore saat update status)
export function markOrderHandled(orderId) {
  if (!orderId) return;
  handledOrderIds.add(orderId);
  try {
    const raw = sessionStorage.getItem(NOTIFIED_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.includes(orderId)) {
      sessionStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify([...list.slice(-500), orderId]));
    }
  } catch {}
}

// Inisialisasi dari sessionStorage saat modul dimuat
try {
  const raw = sessionStorage.getItem(NOTIFIED_STORAGE_KEY);
  if (raw) {
    const list = JSON.parse(raw);
    list.forEach((id) => handledOrderIds.add(id));
  }
} catch {}

/**
 * playNotifSound — Generates a pleasant "ding" notification using Web Audio API.
 * Falls back silently if AudioContext is not available (e.g. in tests).
 */
function playNotifSound() {
  try {
    const audio = new Audio(notifSound);
    audio.volume = 0.7; // 0.0 – 1.0
    audio.play();
  } catch (err) {
    console.warn("[OrderNotif] Audio playback blocked:", err.message);
  }
}

export function OrderNotificationProvider({ children }) {
  const [isMuted, setIsMuted] = useState(
    () => localStorage.getItem(MUTE_KEY) === "true"
  );
  const [lastOrder, setLastOrder] = useState(null);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  // 1. Inisialisasi: daftarkan semua order yang SUDAH lunas di database ke handledOrderIds
  // agar order yang sudah ada sebelum sesi ini TIDAK PERNAH memicu notifikasi saat statusnya diubah.
  useEffect(() => {
    supabase
      .from("pesanan")
      .select("id")
      .eq("status_pembayaran", "lunas")
      .then(({ data, error }) => {
        if (!error && data) {
          data.forEach((o) => handledOrderIds.add(o.id));
        }
      });
  }, []);

  // 2. Realtime listener: hanya picu notifikasi SEKALI untuk pesanan yang BARU saja lunas
  useEffect(() => {
    const channel = supabase
      .channel("global-order-notif")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pesanan" },
        (payload) => {
          const newOrder = payload.new;
          const oldOrder = payload.old ?? {};

          // Guard 1: Status baru harus 'lunas'
          if (newOrder.status_pembayaran !== "lunas") return;

          // Guard 2: Jika ID ini sudah pernah dinotifikasi atau ditangani, abaikan!
          if (handledOrderIds.has(newOrder.id)) return;

          // Guard 3: Jika data status lama tersedia dan sebelumnya sudah 'lunas',
          // berarti update ini BUKAN pembayaran baru (hanya status pesanan/fulfillment yang berubah)
          if (oldOrder && oldOrder.status_pembayaran === "lunas") {
            handledOrderIds.add(newOrder.id);
            return;
          }

          // Guard 4: Jika status pesanan berubah, berarti aksi fulfillment admin
          if (oldOrder && oldOrder.status_pesanan && oldOrder.status_pesanan !== newOrder.status_pesanan) {
            handledOrderIds.add(newOrder.id);
            return;
          }

          // Guard 5: Verifikasi waktu transaksi (hanya pesanan baru dalam 10 menit terakhir)
          const ts = new Date(newOrder.dibayar_pada || newOrder.updated_at || newOrder.created_at).getTime();
          if (!isNaN(ts) && Date.now() - ts > 10 * 60 * 1000) {
            // Pesanan lama yang baru ter-update, tandai dan abaikan
            handledOrderIds.add(newOrder.id);
            return;
          }

          // Tandai sudah diproses (sekali untuk selamanya)
          markOrderHandled(newOrder.id);
          setLastOrder(newOrder);

          // Bunyikan suara jika tidak di-mute
          if (!isMutedRef.current) {
            playNotifSound();
          }

          // Tampilkan popup notifikasi
          toast.custom(
            (t) => <OrderToast t={t} order={newOrder} />,
            { duration: 6000, position: "top-right" }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref to isMuted so the realtime callback always sees the latest value
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  return (
    <OrderNotificationContext.Provider value={{ isMuted, toggleMute, lastOrder }}>
      {children}
    </OrderNotificationContext.Provider>
  );
}

export function useOrderNotification() {
  const ctx = useContext(OrderNotificationContext);
  if (!ctx) throw new Error("useOrderNotification must be used inside OrderNotificationProvider");
  return ctx;
}
