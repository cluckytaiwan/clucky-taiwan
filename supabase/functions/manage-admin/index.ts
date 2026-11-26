// supabase/functions/manage-admin/index.ts
//
// Pengelolaan akun admin (tambah, ubah, hapus) oleh Owner.
// Berjalan di server karena membuat/menghapus akun login butuh service role key,
// yang tidak boleh ada di browser. Hanya akun ber-role 'owner' yang diizinkan;
// peran dicek ulang di sini dari tabel admin, bukan dari isi permintaan.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", "Gunakan POST", 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Identitas dari token login (JWT) yang diverifikasi Supabase Auth
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = bearer
      ? await supabase.auth.getUser(bearer)
      : { data: null, error: new Error("no token") };
    if (userError || !userData?.user) {
      return errorResponse("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);
    }
    const caller = userData.user;

    // 2. Hanya Owner
    const { data: callerRow } = await supabase
      .from("admin")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (callerRow?.role !== "owner") {
      return errorResponse("FORBIDDEN", "Hanya Owner yang dapat mengelola akun admin", 403);
    }

    const body = await req.json();
    const aksi = body?.aksi;

    // ── Tambah ──────────────────────────────────────────────────────────────
    if (aksi === "tambah") {
      const nama = String(body.nama ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (nama.length < 3 || nama.length > 60) {
        return errorResponse("VALIDATION_ERROR", "Nama 3–60 karakter", 400);
      }
      if (!EMAIL_REGEX.test(email)) {
        return errorResponse("VALIDATION_ERROR", "Format email tidak valid", 400);
      }
      if (password.length < 8) {
        return errorResponse("VALIDATION_ERROR", "Kata sandi minimal 8 karakter", 400);
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nama },
      });
      if (createError || !created?.user) {
        const exists = /already|registered|exists/i.test(createError?.message ?? "");
        return errorResponse(
          exists ? "EMAIL_EXISTS" : "CREATE_FAILED",
          exists ? "Email sudah terdaftar" : "Gagal membuat akun",
          exists ? 409 : 400,
        );
      }

      const { error: insertError } = await supabase
        .from("admin")
        .insert({ user_id: created.user.id, role: "admin", nama, email });
      if (insertError) {
        await supabase.auth.admin.deleteUser(created.user.id); // batalkan agar tidak ada akun yatim
        throw insertError;
      }
      return jsonResponse({ success: true, user_id: created.user.id });
    }

    // Aksi ubah/hapus memerlukan target yang berperan 'admin' (Owner tidak bisa
    // mengubah/menghapus Owner lain atau dirinya sendiri lewat sini)
    const targetId = String(body?.user_id ?? "");
    if (!targetId) return errorResponse("VALIDATION_ERROR", "user_id wajib diisi", 400);
    const { data: target } = await supabase
      .from("admin")
      .select("user_id, role")
      .eq("user_id", targetId)
      .maybeSingle();
    if (!target || target.role !== "admin") {
      return errorResponse("NOT_FOUND", "Akun admin tidak ditemukan", 404);
    }

    // ── Ubah ────────────────────────────────────────────────────────────────
    if (aksi === "ubah") {
      const updates: Record<string, unknown> = {};
      const rowUpdates: Record<string, string> = {};

      if (body.nama !== undefined) {
        const nama = String(body.nama).trim();
        if (nama.length < 3 || nama.length > 60) {
          return errorResponse("VALIDATION_ERROR", "Nama 3–60 karakter", 400);
        }
        updates.user_metadata = { nama };
        rowUpdates.nama = nama;
      }
      if (body.email !== undefined) {
        const email = String(body.email).trim().toLowerCase();
        if (!EMAIL_REGEX.test(email)) {
          return errorResponse("VALIDATION_ERROR", "Format email tidak valid", 400);
        }
        updates.email = email;
        updates.email_confirm = true;
        rowUpdates.email = email;
      }
      if (body.password) {
        const password = String(body.password);
        if (password.length < 8) {
          return errorResponse("VALIDATION_ERROR", "Kata sandi minimal 8 karakter", 400);
        }
        updates.password = password;
      }
      if (Object.keys(updates).length === 0) {
        return errorResponse("VALIDATION_ERROR", "Tidak ada data yang diubah", 400);
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(targetId, updates);
      if (updateError) {
        const exists = /already|registered|exists/i.test(updateError.message ?? "");
        return errorResponse(
          exists ? "EMAIL_EXISTS" : "UPDATE_FAILED",
          exists ? "Email sudah dipakai akun lain" : "Gagal mengubah akun",
          exists ? 409 : 400,
        );
      }
      if (Object.keys(rowUpdates).length > 0) {
        const { error: rowError } = await supabase.from("admin").update(rowUpdates).eq("user_id", targetId);
        if (rowError) throw rowError;
        if (rowUpdates.nama) {
          await supabase.from("profil").update({ nama: rowUpdates.nama }).eq("user_id", targetId);
        }
      }
      return jsonResponse({ success: true });
    }

    // ── Hapus ───────────────────────────────────────────────────────────────
    if (aksi === "hapus") {
      // Baris admin & profil ikut terhapus (ON DELETE CASCADE dari auth.users);
      // pesanan yang pernah diproses tetap tersimpan.
      const { error: deleteError } = await supabase.auth.admin.deleteUser(targetId);
      if (deleteError) throw deleteError;
      return jsonResponse({ success: true });
    }

    return errorResponse("VALIDATION_ERROR", "Aksi tidak dikenal", 400);
  } catch (err) {
    console.error("manage-admin error:", err);
    return errorResponse("INTERNAL_ERROR", "Terjadi kesalahan server", 500);
  }
});
