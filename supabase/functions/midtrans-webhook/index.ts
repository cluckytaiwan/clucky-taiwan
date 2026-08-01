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

    if (expectedSignature !== notification.signature_key) {
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
    // 3. IDEMPOTENCY — jangan proses ulang status final
    // ============================================
    const finalStatuses = ["lunas", "kadaluarsa", "dibatalkan", "ditolak", "dikembalikan"];
    if (finalStatuses.includes(order.status_pembayaran)) {
      console.log(`Order ${order.id} sudah final: ${order.status_pembayaran}`);
      return jsonResponse({ success: true, message: "Already processed" }, 200);
    }

    // ============================================
    // 4. VALIDASI JUMLAH
    // ============================================
    const notifiedAmount = parseFloat(notification.gross_amount);
    if (Math.abs(notifiedAmount - order.total_harga) > 1) {
      console.error(`Amount mismatch order ${order.id}: expected ${order.total_harga}, got ${notifiedAmount}`);
      return jsonResponse({ success: false, error: { code: "AMOUNT_MISMATCH", message: "Nominal tidak cocok" } }, 200);
    }

    // ============================================
    // 5. MAPPING STATUS & UPDATE
    // ============================================
    const newStatus = mapMidtransStatus(notification.transaction_status, notification.fraud_status);
    if (!newStatus) {
      return jsonResponse({ success: true, message: "No action needed" }, 200);
    }

    const { error: updateError } = await supabase
      .from("pesanan")
      .update({ status_pembayaran: newStatus })
      .eq("id", order.id);

    if (updateError) throw updateError;

    // ============================================
    // 6. KEMBALIKAN STOK JIKA GAGAL/BATAL/KADALUARSA
    // ============================================
    if (["kadaluarsa", "dibatalkan", "ditolak"].includes(newStatus)) {
      const { data: items } = await supabase
        .from("detail_pesanan")
        .select("produk_id, jumlah")
        .eq("pesanan_id", order.id);

      if (items) {
        for (const item of items) {
          if (item.produk_id) {
            await supabase.rpc("tambah_stok", { p_produk_id: item.produk_id, p_jumlah: item.jumlah });
          }
        }
      }
    }
    // Jika newStatus === "lunas": stok TIDAK dikurangi lagi (sudah direservasi
    // saat create-order), ini hanya konfirmasi reservasi menjadi permanen.

    return jsonResponse({ success: true, message: "OK" }, 200);
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "Error logged" } }, 200);
  }
});

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
