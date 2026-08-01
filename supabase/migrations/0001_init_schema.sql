-- ============================================================
-- Migration: 0001_init_schema.sql
-- Clucky Taiwan — Skema final Bahasa Indonesia (Master Planning v2.4 §7)
-- ============================================================

-- 1. Tipe ENUM Status
create type status_pembayaran as enum (
  'menunggu_pembayaran', 'lunas', 'kadaluarsa', 'dibatalkan', 'ditolak', 'dikembalikan'
);
create type status_pesanan as enum ('diproses', 'dikirim', 'selesai');

-- 2. Tabel Kategori
create table kategori (
  id uuid primary key default gen_random_uuid(),
  nama_kategori text not null unique,
  created_at timestamptz not null default now()
);

-- 3. Tabel Produk
create table produk (
  id uuid primary key default gen_random_uuid(),
  kategori_id uuid references kategori(id) on delete set null,
  nama_produk text not null,
  deskripsi text,
  harga numeric(12,2) not null check (harga >= 0),
  stok integer not null default 0 check (stok >= 0),
  url_gambar text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Tabel Pesanan
create table pesanan (
  id uuid primary key default gen_random_uuid(),
  nama_pelanggan text not null,
  no_hp_pelanggan text not null,
  alamat_pelanggan text not null,
  total_harga numeric(12,2) not null check (total_harga >= 0),
  status_pembayaran status_pembayaran not null default 'menunggu_pembayaran',
  status_pesanan status_pesanan not null default 'diproses',
  midtrans_order_id text unique,
  snap_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Tabel Detail Pesanan (snapshot item saat transaksi)
create table detail_pesanan (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null references pesanan(id) on delete cascade,
  produk_id uuid references produk(id) on delete set null,
  nama_produk text not null,
  harga_satuan numeric(12,2) not null,
  jumlah integer not null check (jumlah > 0),
  subtotal numeric(12,2) not null
);

-- 6. Tabel Admin (whitelist)
create table admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (§14.1)
-- ============================================================

-- kategori
alter table kategori enable row level security;

create policy "kategori_public_select"
on kategori for select
to anon, authenticated
using (true);

create policy "kategori_admin_insert"
on kategori for insert
to authenticated
with check (exists (select 1 from admin where admin.user_id = auth.uid()));

create policy "kategori_admin_update"
on kategori for update
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()))
with check (exists (select 1 from admin where admin.user_id = auth.uid()));

create policy "kategori_admin_delete"
on kategori for delete
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()));

-- produk
alter table produk enable row level security;

create policy "produk_public_select"
on produk for select
to anon, authenticated
using (true);

create policy "produk_admin_insert"
on produk for insert
to authenticated
with check (exists (select 1 from admin where admin.user_id = auth.uid()));

create policy "produk_admin_update"
on produk for update
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()))
with check (exists (select 1 from admin where admin.user_id = auth.uid()));

create policy "produk_admin_delete"
on produk for delete
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()));

-- pesanan — TERTUTUP TOTAL dari akses client SDK.
-- Tidak ada policy anon/authenticated -> default deny all.
-- Akses hanya lewat Edge Function memakai Secret Key (bypass RLS by design).
alter table pesanan enable row level security;

-- detail_pesanan — sama seperti pesanan, tertutup total.
alter table detail_pesanan enable row level security;

-- admin
alter table admin enable row level security;

create policy "admin_self_select"
on admin for select
to authenticated
using (auth.uid() = user_id);
-- Tidak ada policy insert/update/delete untuk client.
-- Penambahan admin baru wajib manual via SQL Editor (§14.7).

-- ============================================================
-- RPC ATOMIC STOK (§14.2)
-- ============================================================

create or replace function kurangi_stok(p_produk_id uuid, p_jumlah int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stok_saat_ini int;
begin
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

create or replace function tambah_stok(p_produk_id uuid, p_jumlah int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update produk
  set stok = stok + p_jumlah,
      updated_at = now()
  where id = p_produk_id;

  if not found then
    raise exception 'PRODUK_TIDAK_DITEMUKAN: produk % tidak ditemukan', p_produk_id;
  end if;
end;
$$;

revoke all on function kurangi_stok(uuid, int) from public;
revoke all on function tambah_stok(uuid, int) from public;
grant execute on function kurangi_stok(uuid, int) to service_role;
grant execute on function tambah_stok(uuid, int) to service_role;

-- ============================================================
-- TRIGGER updated_at
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_produk_updated_at
before update on produk
for each row execute function set_updated_at();

create trigger trg_pesanan_updated_at
before update on pesanan
for each row execute function set_updated_at();

-- ============================================================
-- REALTIME (khusus dashboard Admin)
-- ============================================================
alter publication supabase_realtime add table pesanan;
alter publication supabase_realtime add table detail_pesanan;
