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
  customer_address?: string;
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

// Batas pesanan belum dibayar per nomor HP dalam jendela waktu — mencegah stok
// "dikunci" oleh pesanan berulang yang tidak pernah dibayar.
const MAX_PENDING_PER_PHONE = 3;
const PENDING_WINDOW_MINUTES = 45;
// Masa berlaku Snap. Cron kedaluwarsakan_pesanan_lama() membatalkan setelah 45 menit.
const SNAP_EXPIRY_MINUTES = 30;

// Alfabet tanpa karakter yang mudah tertukar (0/O, 1/I/L)
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateOrderCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `CTX-${out}`;
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

    const name = payload.customer_name.trim();
    const notes = payload.customer_notes?.trim() ?? "";
    const address = payload.customer_address?.trim() ?? "";
    if (name.length > 60 || notes.length > 255 || address.length > 200) {
      return errorResponse("VALIDATION_ERROR", "Nama, catatan, atau alamat terlalu panjang", 400);
    }
    if (payload.items.length > 20) {
      return errorResponse("VALIDATION_ERROR", "Terlalu banyak item dalam satu pesanan", 400);
    }

    // Produk yang sama boleh muncul lebih dari sekali asalkan kombinasi variannya
    // berbeda (mis. Ayam Large dan Ayam Small = dua baris keranjang).
    const lineKeys = payload.items.map(
      (i) => `${i.product_id}::${[...(i.variant_ids ?? [])].sort().join("_")}`,
    );
    if (new Set(lineKeys).size !== lineKeys.length) {
      return errorResponse("VALIDATION_ERROR", "Item duplikat dalam keranjang", 400);
    }
    for (const item of payload.items) {
      const ids = item.variant_ids ?? [];
      if (new Set(ids).size !== ids.length) {
        return errorResponse("VALIDATION_ERROR", "Varian duplikat dalam satu item", 400);
      }
    }
    const productIds = [...new Set(payload.items.map((i) => i.product_id))];
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
    // Unik: varian yang sama bisa dipakai beberapa baris (mis. "Large · Pedas" & "Large · Original")
    const allVariantIds = [...new Set(payload.items.flatMap((i) => i.variant_ids ?? []))];
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

    // ── Batasi pesanan belum dibayar per nomor HP ───────────────────────────
    const since = new Date(Date.now() - PENDING_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: pendingCount, error: pendingError } = await supabase
      .from("pesanan")
      .select("id", { count: "exact", head: true })
      .eq("no_hp_pelanggan", payload.customer_phone.trim())
      .eq("status_pembayaran", "menunggu_pembayaran")
      .gte("created_at", since);
    if (pendingError) throw pendingError;
    if ((pendingCount ?? 0) >= MAX_PENDING_PER_PHONE) {
      return errorResponse(
        "TOO_MANY_PENDING",
        "Masih ada beberapa pesanan yang belum dibayar. Selesaikan pembayaran di menu Pesanan Saya, atau tunggu beberapa saat.",
        429,
      );
    }

    // ── Kurangi stok (atomic, dengan rollback jika gagal) ───────────────────
    // Stok dihitung per produk (varian berbagi stok produk), jadi jumlahkan
    // dulu semua baris dengan produk yang sama.
    const qtyPerProduct = new Map<string, { qty: number; name: string }>();
    for (const item of orderItems) {
      const entry = qtyPerProduct.get(item.product_id);
      if (entry) entry.qty += item.qty;
      else qtyPerProduct.set(item.product_id, { qty: item.qty, name: item.product_name });
    }

    const decrementedItems: { product_id: string; qty: number }[] = [];

    for (const [productId, { qty, name: productName }] of qtyPerProduct) {
      const { error: rpcError } = await supabase.rpc("kurangi_stok", {
        p_produk_id: productId,
        p_jumlah: qty,
      });

      if (rpcError) {
        await rollbackStock(supabase, decrementedItems);
        if (rpcError.message?.includes("STOK_TIDAK_CUKUP")) {
          return errorResponse(
            "INSUFFICIENT_STOCK",
            `Stok produk ${productName} tidak mencukupi`,
            409,
          );
        }
        throw rpcError;
      }
      decrementedItems.push({ product_id: productId, qty });
    }

    // ── Buat pesanan ────────────────────────────────────────────────────────
    const midtransOrderId = `CLUCKY-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // Kode pendek untuk pelanggan; ulangi bila (sangat jarang) bentrok dengan kode lain
    let order: { id: string; kode_pesanan: string } | null = null;
    let orderError: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await supabase
        .from("pesanan")
        .insert({
          nama_pelanggan: name,
          no_hp_pelanggan: payload.customer_phone.trim(),
          alamat_pelanggan: address || "-",
          catatan: notes || null,
          total_harga: totalAmount,
          status_pembayaran: "menunggu_pembayaran",
          midtrans_order_id: midtransOrderId,
          kode_pesanan: generateOrderCode(),
        })
        .select("id, kode_pesanan")
        .single();
      order = res.data;
      orderError = res.error;
      if (!orderError || orderError.code !== "23505") break; // 23505 = unique_violation
    }

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
        expiry: { unit: "minutes", duration: SNAP_EXPIRY_MINUTES },
        customer_details: {
          first_name: name,
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
