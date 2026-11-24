-- 0011_fix_anon_pesanan_and_stock_rpc.sql
--
-- Mengunci akses data pesanan dan fungsi stok:
-- 1. Data pesanan (nama, no HP, catatan) tidak lagi bisa dibaca publik.
-- 2. Hanya admin yang boleh membaca dan mengubah pesanan dari aplikasi.
-- 3. Fungsi ubah stok hanya boleh dipanggil server (Edge Function), bukan browser.

-- ── 1. RLS pesanan ─────────────────────────────────────────────────────────
-- RLS = aturan akses per baris di database. Policy baca publik dihapus; pelanggan
-- melihat pesanannya lewat Edge Function check-order-status (kode + no HP).
drop policy if exists "pesanan_anon_realtime_select" on public.pesanan;

-- ── 2. Policy admin ────────────────────────────────────────────────────────
-- Login saja tidak cukup: user harus terdaftar di tabel admin.
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

-- ── 3. Fungsi stok ─────────────────────────────────────────────────────────
-- Mengurangi stok satu produk saat checkout (dipanggil create-order).
-- Gagal dengan STOK_TIDAK_CUKUP bila stok kurang; stok tidak pernah minus.
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

  -- FOR UPDATE mengunci baris produk: checkout lain untuk produk yang sama
  -- menunggu sampai ini selesai, jadi stok terakhir tidak terjual dua kali.
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

-- Mengembalikan stok bila pembuatan pesanan gagal di tengah jalan (rollback di create-order).
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

-- Fungsi ini berjalan dengan hak pemilik database (security definer), jadi
-- browser (anon/authenticated) dilarang memanggilnya; hanya server yang boleh.
revoke all on function public.kurangi_stok(uuid, int) from public, anon, authenticated;
revoke all on function public.tambah_stok(uuid, int) from public, anon, authenticated;
grant execute on function public.kurangi_stok(uuid, int) to service_role;
grant execute on function public.tambah_stok(uuid, int) to service_role;
