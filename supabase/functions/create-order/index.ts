import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartItem {
  product_id: string;
  qty: number;
  variant_ids?: string[]; // array ID dari opsi_varian yang dipilih — kosong jika produk tanpa varian
}

interface CheckoutPayload {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_notes?: string;
  items: CartItem[];
}

interface VariantRow {
  id: string;
  produk_id: string;
  tipe: string;
  nama: string;
  harga_tambahan: number;
}

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

    const payload: CheckoutPayload = await req.json();

    // ── Validasi payload dasar ──────────────────────────────────────────────
    if (
      !payload.customer_name?.trim() ||
      !payload.customer_phone?.trim() ||
      !payload.customer_address?.trim() ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      return errorResponse("VALIDATION_ERROR", "Data checkout tidak lengkap", 400);
    }

    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    if (!phoneRegex.test(payload.customer_phone.trim())) {
      return errorResponse(
        "VALIDATION_ERROR",
        "customer_phone wajib diisi dengan format 08xxxxxxxxxx",
        400,
      );
    }

    const productIds = payload.items.map((i) => i.product_id);
    if (new Set(productIds).size !== productIds.length) {
      return errorResponse("VALIDATION_ERROR", "Produk duplikat dalam keranjang", 400);
    }
    for (const item of payload.items) {
      if (!Number.isInteger(item.qty) || item.qty <= 0 || item.qty > 50) {
        return errorResponse("VALIDATION_ERROR", "Jumlah item tidak valid", 400);
      }
    }

    // ── Fetch & validasi produk ─────────────────────────────────────────────
    const { data: rawProducts, error: productError } = await supabase
      .from("produk")
      .select("id, nama_produk, harga, stok, aktif")
      .in("id", productIds);

    if (productError) throw productError;

    const products = (rawProducts || []).map((p) => ({
      id: p.id,
      name: p.nama_produk,
      price: Number(p.harga),
      stock: p.stok,
      is_active: p.aktif,
    }));

    if (products.length !== productIds.length) {
      return errorResponse("VALIDATION_ERROR", "Ada produk yang tidak ditemukan", 400);
    }
    const inactiveProduct = products.find((p) => !p.is_active);
    if (inactiveProduct) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Produk "${inactiveProduct.name}" sedang tidak tersedia`,
        400,
      );
    }

    // ── Fetch & validasi varian (satu query untuk semua items) ──────────────
    const allVariantIds = payload.items.flatMap((i) => i.variant_ids ?? []);
    const variantMap = new Map<string, VariantRow>();

    if (allVariantIds.length > 0) {
      const { data: rawVariants, error: variantError } = await supabase
        .from("opsi_varian")
        .select("id, produk_id, tipe, nama, harga_tambahan")
        .in("id", allVariantIds)
        .eq("aktif", true);

      if (variantError) throw variantError;

      // Validasi: semua variant_id yang dikirim harus ada dan aktif
      if ((rawVariants?.length ?? 0) !== allVariantIds.length) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Satu atau lebih varian tidak valid atau tidak tersedia",
          400,
        );
      }

      for (const v of rawVariants!) {
        variantMap.set(v.id, { ...v, harga_tambahan: Number(v.harga_tambahan) });
      }

      // Validasi: setiap variant_id harus milik produk yang benar
      for (const item of payload.items) {
        for (const vId of item.variant_ids ?? []) {
          const variant = variantMap.get(vId);
          if (!variant || variant.produk_id !== item.product_id) {
            return errorResponse(
              "VALIDATION_ERROR",
              "Varian tidak sesuai dengan produk yang dipilih",
              400,
            );
          }
        }
      }
    }

    // ── Hitung harga final per item (base price + variant extras) ───────────
    const orderItems = payload.items.map((item) => {
      const product = products.find((p) => p.id === item.product_id)!;
      const selectedVariants = (item.variant_ids ?? []).map((id) => variantMap.get(id)!);
      const variantExtra = selectedVariants.reduce((s, v) => s + v.harga_tambahan, 0);
      const finalPrice = product.price + variantExtra;
      const subtotal = finalPrice * item.qty;

      // Label varian untuk nama item di Midtrans (max 50 karakter total)
      const variantLabel = selectedVariants.map((v) => v.nama).join(", ");
      const itemName = variantLabel
        ? `${product.name} (${variantLabel})`.slice(0, 50)
        : product.name.slice(0, 50);

      return {
        product_id: product.id,
        product_name: product.name,
        item_name: itemName,         // nama untuk Midtrans (dengan varian)
        base_price: product.price,
        price: finalPrice,           // harga final termasuk varian
        qty: item.qty,
        subtotal,
        variants: selectedVariants.map((v) => ({
          id: v.id,
          tipe: v.tipe,
          nama: v.nama,
          harga_tambahan: v.harga_tambahan,
        })),
      };
    });

    const totalAmount = orderItems.reduce((sum, i) => sum + i.subtotal, 0);

    if (totalAmount <= 0) {
      return errorResponse("VALIDATION_ERROR", "Total pesanan tidak valid", 400);
    }

    // ── Kurangi stok (atomic, dengan rollback jika gagal) ───────────────────
    const decrementedItems: { product_id: string; qty: number }[] = [];

    for (const item of orderItems) {
      const { error: rpcError } = await supabase.rpc("kurangi_stok", {
        p_produk_id: item.product_id,
        p_jumlah: item.qty,
      });

      if (rpcError) {
        await rollbackStock(supabase, decrementedItems);
        if (rpcError.message?.includes("STOK_TIDAK_CUKUP")) {
          return errorResponse(
            "INSUFFICIENT_STOCK",
            `Stok produk ${item.product_name} tidak mencukupi`,
            409,
          );
        }
        throw rpcError;
      }
      decrementedItems.push({ product_id: item.product_id, qty: item.qty });
    }

    // ── Buat pesanan ────────────────────────────────────────────────────────
    const midtransOrderId = `CLUCKY-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const shortCode = `CTX-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from("pesanan")
      .insert({
        nama_pelanggan: payload.customer_name.trim(),
        no_hp_pelanggan: payload.customer_phone.trim(),
        alamat_pelanggan: payload.customer_address.trim(),
        catatan: payload.customer_notes?.trim() || null,
        total_harga: totalAmount,
        status_pembayaran: "menunggu_pembayaran",
        midtrans_order_id: midtransOrderId,
        kode_pesanan: shortCode,
      })
      .select("id, kode_pesanan")
      .single();

    if (orderError || !order) {
      await rollbackStock(supabase, decrementedItems);
      throw orderError ?? new Error("Gagal membuat pesanan");
    }

    // ── Insert detail pesanan (dengan snapshot varian) ──────────────────────
    const { error: itemsError } = await supabase.from("detail_pesanan").insert(
      orderItems.map((i) => ({
        pesanan_id: order.id,
        produk_id: i.product_id,
        nama_produk: i.product_name,
        harga_satuan: i.price,             // harga sudah include varian
        jumlah: i.qty,
        subtotal: i.subtotal,
        varian_terpilih: i.variants.length > 0 ? i.variants : null, // snapshot JSON
      })),
    );

    if (itemsError) {
      await supabase.from("pesanan").delete().eq("id", order.id);
      await rollbackStock(supabase, decrementedItems);
      throw itemsError;
    }

    // ── Minta Snap Token dari Midtrans ──────────────────────────────────────
    const midtransServerKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const midtransBaseUrl = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true"
      ? Deno.env.get("MIDTRANS_SNAP_URL_PRODUCTION")!
      : Deno.env.get("MIDTRANS_SNAP_URL_SANDBOX")!;

    const snapResponse = await fetch(midtransBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(midtransServerKey + ":"),
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: midtransOrderId,
          gross_amount: totalAmount,
        },
        customer_details: {
          first_name: payload.customer_name.trim(),
          phone: payload.customer_phone.trim(),
        },
        item_details: orderItems.map((i) => ({
          id: i.product_id,
          price: i.price,
          quantity: i.qty,
          name: i.item_name, // nama include label varian, max 50 char
        })),
        enabled_payments: ["other_qris"],
      }),
    });

    if (!snapResponse.ok) {
      await supabase.from("pesanan").delete().eq("id", order.id);
      await rollbackStock(supabase, decrementedItems);
      const errText = await snapResponse.text();
      console.error("Midtrans error:", errText);
      return errorResponse("PAYMENT_GATEWAY_ERROR", "Gagal memperoleh Snap Token dari Midtrans", 502);
    }

    const snapData = await snapResponse.json();
    await supabase.from("pesanan").update({ snap_token: snapData.token }).eq("id", order.id);

    return jsonResponse({
      success: true,
      order_id: order.id,
      kode_pesanan: order.kode_pesanan,
      midtrans_order_id: midtransOrderId,
      snap_token: snapData.token,
      total_amount: totalAmount,
    });

  } catch (err) {
    console.error("create-order error:", err);
    return errorResponse("INTERNAL_ERROR", "Terjadi kesalahan server internal", 500);
  }
});

async function rollbackStock(supabase: any, items: { product_id: string; qty: number }[]) {
  for (const item of items) {
    try {
      await supabase.rpc("tambah_stok", { p_produk_id: item.product_id, p_jumlah: item.qty });
    } catch (err) {
      console.error(`Gagal rollback stok untuk produk ${item.product_id}:`, err);
    }
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
