// supabase/functions/check-order-status/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { kode_pesanan, customer_phone } = await req.json();

    if (!kode_pesanan || !customer_phone) {
      return errorResponse("VALIDATION_ERROR", "Kode Pesanan dan nomor HP wajib diisi", 400);
    }

    // Wajib DUA identitas — mencegah enumeration
    const { data: rawOrder, error } = await supabase
      .from("pesanan")
      .select("id, status_pembayaran, status_pesanan, total_harga, created_at, updated_at, nama_pelanggan, catatan, kode_pesanan, snap_token")
      .eq("kode_pesanan", kode_pesanan.trim().toUpperCase())
      .eq("no_hp_pelanggan", customer_phone.trim())
      .single();

    if (error || !rawOrder) {
      return errorResponse("ORDER_NOT_FOUND", "Pesanan tidak ditemukan atau nomor telepon tidak cocok", 404);
    }

    const order = {
      id: rawOrder.id,
      kode_pesanan: rawOrder.kode_pesanan,
      status: rawOrder.status_pembayaran,
      fulfillment_status: rawOrder.status_pesanan,
      total_amount: rawOrder.total_harga,
      created_at: rawOrder.created_at,
      updated_at: rawOrder.updated_at, // dipakai sebagai estimasi waktu bayar (paidAt)
      customer_name: rawOrder.nama_pelanggan,
      customer_notes: rawOrder.catatan,
      // snap_token hanya dikembalikan jika pembayaran masih pending
      snap_token: rawOrder.status_pembayaran === "menunggu_pembayaran" ? rawOrder.snap_token : null,
    };

    const { data: rawItems } = await supabase
      .from("detail_pesanan")
      .select("nama_produk, harga_satuan, jumlah, subtotal")
      .eq("pesanan_id", order.id);

    const items = (rawItems || []).map((i) => ({
      product_name: i.nama_produk,
      price: i.harga_satuan,
      qty: i.jumlah,
      subtotal: i.subtotal,
    }));

    return jsonResponse({
      success: true,
      order: { ...order, items: items || [] },
    });
  } catch (err) {
    console.error("check-order-status error:", err);
    return errorResponse("INTERNAL_ERROR", "Terjadi kesalahan server", 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
