// supabase/functions/midtrans-webhook/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type: string;
}

// Pemetaan status Midtrans -> enum status_pembayaran (Bahasa Indonesia, §7.1)
function mapMidtransStatus(transactionStatus: string, fraudStatus?: string): string | null {
  switch (transactionStatus) {
    case "capture":
      if (fraudStatus === "accept") return "lunas";
      if (fraudStatus === "challenge") return null; // tunggu review manual
      return "ditolak";
    case "settlement":
      return "lunas";
    case "pending":
      return null;
    case "deny":
      return "ditolak";
    case "cancel":
      return "dibatalkan";
    case "expire":
      return "kadaluarsa";
    case "refund":
    case "partial_refund":
      return "dikembalikan";
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const notification: MidtransNotification = await req.json();

    // ============================================
    // 1. VERIFIKASI SIGNATURE — WAJIB
    // ============================================
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const expectedSignature = await sha512(
      notification.order_id + notification.status_code + notification.gross_amount + serverKey,
    );

    if (!safeEqual(expectedSignature, String(notification.signature_key ?? ""))) {
      console.error("Invalid signature for order:", notification.order_id);
      return jsonResponse({ success: false, error: { code: "INVALID_SIGNATURE", message: "Signature tidak valid" } }, 200);
    }

    // ============================================
    // 2. AMBIL pesanan BERDASARKAN midtrans_order_id
    // ============================================
    const { data: order, error: orderError } = await supabase
      .from("pesanan")
      .select("id, status_pembayaran, total_harga")
      .eq("midtrans_order_id", notification.order_id)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", notification.order_id);
      return jsonResponse({ success: false, error: { code: "ORDER_NOT_FOUND", message: "Pesanan tidak ditemukan" } }, 200);
    }

    // ============================================
    // 3. VALIDASI JUMLAH
    // ============================================
    const notifiedAmount = parseFloat(notification.gross_amount);
    if (Math.abs(notifiedAmount - Number(order.total_harga)) > 1) {
      console.error(`Amount mismatch order ${order.id}: expected ${order.total_harga}, got ${notifiedAmount}`);
      return jsonResponse({ success: false, error: { code: "AMOUNT_MISMATCH", message: "Nominal tidak cocok" } }, 200);
    }

    // ============================================
    // 4. MAPPING STATUS
    // ============================================
    const newStatus = mapMidtransStatus(notification.transaction_status, notification.fraud_status);
    if (!newStatus) {
      return jsonResponse({ success: true, message: "No action needed" }, 200);
    }

    // ============================================
    // 5. UPDATE ATOMIK (status + pengembalian stok dalam satu transaksi DB)
    //    Fungsi mengunci baris pesanan dan hanya mengizinkan transisi yang sah,
    //    sehingga notifikasi ganda/bersamaan tidak memproses dua kali.
    // ============================================
    const { data: result, error: rpcError } = await supabase.rpc("proses_status_pembayaran", {
      p_pesanan_id: order.id,
      p_status: newStatus,
    });
    if (rpcError) throw rpcError;

    if (result === "ignored") {
      if (newStatus === "lunas" && order.status_pembayaran !== "lunas") {
        // Pembayaran masuk untuk pesanan yang sudah dibatalkan/kedaluwarsa —
        // perlu ditangani manual (refund atau proses pesanan).
        console.error(
          `PAID_AFTER_FINAL: order ${order.id} (${order.status_pembayaran}) menerima settlement Midtrans ${notification.order_id}`,
        );
      }
      return jsonResponse({ success: true, message: "Already processed" }, 200);
    }

    return jsonResponse({ success: true, message: "OK" }, 200);
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "Error logged" } }, 200);
  }
});

/** Perbandingan string waktu-konstan (mencegah timing attack pada signature). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha512(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
