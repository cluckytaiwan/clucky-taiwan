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

/**
 * Menampilkan status satu pesanan milik pelanggan yang sedang login.
 * Dipanggil halaman "Pesanan Saya" (dan pemeriksaan berkala setelah checkout).
 * Wajib membawa token login (JWT); pesanan hanya ditampilkan bila milik akun tersebut.
 * Hasil: status pembayaran, status pesanan, dan daftar item pesanan tersebut.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Tabel pesanan tertutup bagi browser, jadi dibaca lewat server dengan service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identitas dari token login yang diverifikasi Supabase Auth
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = bearer
      ? await supabase.auth.getUser(bearer)
      : { data: null, error: new Error("no token") };
    if (userError || !userData?.user) {
      return errorResponse("UNAUTHORIZED", "Silakan login untuk melihat pesanan", 401);
    }

    const { kode_pesanan } = await req.json();

    if (!kode_pesanan) {
      return errorResponse("VALIDATION_ERROR", "Kode Pesanan wajib diisi", 400);
    }

    // Pesanan hanya ditemukan bila kodenya cocok DAN milik akun yang login,
    // sehingga orang lain tidak bisa melihatnya walau menebak kodenya
    const { data: rawOrder, error } = await supabase
      .from("pesanan")
      .select("id, status_pembayaran, status_pesanan, total_harga, created_at, updated_at, nama_pelanggan, catatan, kode_pesanan, snap_token")
      .eq("kode_pesanan", kode_pesanan.trim().toUpperCase())
      .eq("user_id", userData.user.id)
      .single();

    if (error || !rawOrder) {
      return errorResponse("ORDER_NOT_FOUND", "Pesanan tidak ditemukan", 404);
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
      // Token bayar hanya dikirim selagi belum dibayar, untuk tombol "Bayar Sekarang"
      snap_token: rawOrder.status_pembayaran === "menunggu_pembayaran" ? rawOrder.snap_token : null,
    };

    const { data: rawItems } = await supabase
      .from("detail_pesanan")
      .select("nama_produk, harga_satuan, jumlah, subtotal, varian_terpilih")
      .eq("pesanan_id", order.id);

    const items = (rawItems || []).map((i) => ({
      product_name: i.nama_produk,
      price: i.harga_satuan,
      qty: i.jumlah,
      subtotal: i.subtotal,
      // Label varian dari snapshot saat checkout, mis. "Large · Pedas"
      variant_label: Array.isArray(i.varian_terpilih)
        ? i.varian_terpilih.map((v: { nama?: string }) => v?.nama).filter(Boolean).join(" · ")
        : "",
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
