-- 0011_fix_anon_pesanan_and_stock_rpc.sql
--
-- Perbaikan keamanan P0:
--
-- 1. Hapus policy "pesanan_anon_realtime_select" (0008) yang membuat SELURUH
--    tabel pesanan (nama, no HP, alamat, catatan, snap_token) bisa dibaca
--    siapa pun yang memegang anon key. Pelanggan kini memantau status lewat
--    Edge Function check-order-status (validasi kode + no HP), bukan
--    Realtime postgres_changes.
--
-- 2. Pastikan policy admin untuk pesanan/detail_pesanan tercatat di migrasi
--    (sebelumnya hanya ada di file .applied_bak). Idempotent: aman dijalankan
--    di DB yang sudah memilikinya.
--
-- 3. Cabut hak EXECUTE anon/authenticated atas RPC stok. Di Supabase, default
--    privileges memberi EXECUTE langsung ke role anon & authenticated, sehingga
--    `revoke ... from public` di 0001 TIDAK cukup. Fungsi ini SECURITY DEFINER,
--    jadi tanpa revoke siapa pun bisa mengubah stok via /rest/v1/rpc/.
--    Tambahkan juga validasi p_jumlah > 0.

-- ── 1. RLS pesanan ─────────────────────────────────────────────────────────
drop policy if exists "pesanan_anon_realtime_select" on public.pesanan;

-- ── 2. Policy admin (idempotent) ───────────────────────────────────────────
drop policy if exists "pesanan_admin_select" on public.pesanan;
create policy "pesanan_admin_select"
on public.pesanan for select
to authenticated
using (exists (select 1 from public.admin where admin.user_id = auth.uid()));

drop policy if exists "pesanan_admin_update" on public.pesanan;
create policy "pesanan_admin_update"
on public.pesanan for update
to authenticated
using (exists (select 1 from public.admin where admin.user_id = auth.uid()))
with check (exists (select 1 from public.admin where admin.user_id = auth.uid()));

drop policy if exists "detail_pesanan_admin_select" on public.detail_pesanan;
create policy "detail_pesanan_admin_select"
on public.detail_pesanan for select
to authenticated
using (exists (select 1 from public.admin where admin.user_id = auth.uid()));

-- ── 3. RPC stok ────────────────────────────────────────────────────────────
create or replace function public.kurangi_stok(p_produk_id uuid, p_jumlah int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stok_saat_ini int;
begin
  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'JUMLAH_TIDAK_VALID: p_jumlah harus > 0';
  end if;

  select stok into v_stok_saat_ini
  from produk
  where id = p_produk_id
  for update;

  if v_stok_saat_ini is null then
    raise exception 'PRODUK_TIDAK_DITEMUKAN: produk % tidak ditemukan', p_produk_id;
  end if;

  if v_stok_saat_ini < p_jumlah then
    raise exception 'STOK_TIDAK_CUKUP: stok produk % tidak mencukupi (tersedia %, diminta %)',
      p_produk_id, v_stok_saat_ini, p_jumlah;
  end if;

  update produk
  set stok = stok - p_jumlah,
      updated_at = now()
  where id = p_produk_id;
end;
$$;

create or replace function public.tambah_stok(p_produk_id uuid, p_jumlah int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'JUMLAH_TIDAK_VALID: p_jumlah harus > 0';
  end if;

  update produk
  set stok = stok + p_jumlah,
      updated_at = now()
  where id = p_produk_id;

  if not found then
    raise exception 'PRODUK_TIDAK_DITEMUKAN: produk % tidak ditemukan', p_produk_id;
  end if;
end;
$$;

revoke all on function public.kurangi_stok(uuid, int) from public, anon, authenticated;
revoke all on function public.tambah_stok(uuid, int) from public, anon, authenticated;
grant execute on function public.kurangi_stok(uuid, int) to service_role;
grant execute on function public.tambah_stok(uuid, int) to service_role;
