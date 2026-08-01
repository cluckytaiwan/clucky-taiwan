-- ============================================================
-- Migration: 0002_add_variants.sql
-- Clucky Taiwan — Fitur Varian Produk (Size & Rasa)
-- ============================================================

-- 1. Tabel opsi_varian
-- Menyimpan pilihan varian (ukuran/rasa) per produk.
-- Tipe enum: 'ukuran' | 'rasa' — dapat diperluas di migration berikutnya.
create table opsi_varian (
  id             uuid          primary key default gen_random_uuid(),
  produk_id      uuid          not null references produk(id) on delete cascade,
  tipe           text          not null check (tipe in ('ukuran', 'rasa')),
  nama           text          not null,
  harga_tambahan numeric(12,2) not null default 0 check (harga_tambahan >= 0),
  urutan         integer       not null default 0,
  aktif          boolean       not null default true,
  created_at     timestamptz   not null default now(),
  unique (produk_id, tipe, nama)
);

comment on table opsi_varian is
  'Pilihan varian per produk (ukuran/rasa). Single select per tipe, wajib dipilih jika ada.';
comment on column opsi_varian.harga_tambahan is
  'Harga tambahan di atas harga dasar produk. 0 = tidak ada penambahan harga.';
comment on column opsi_varian.urutan is
  'Urutan tampil di UI. Diurutkan ascending.';

-- 2. Tambah kolom snapshot varian ke detail_pesanan
-- Null = produk tidak punya varian saat checkout.
-- Array JSON snapshot: [{"id":"...","tipe":"ukuran","nama":"Large","harga_tambahan":6000}]
alter table detail_pesanan
  add column varian_terpilih jsonb;

comment on column detail_pesanan.varian_terpilih is
  'Snapshot varian yang dipilih saat checkout. Tidak berubah meski admin edit varian.';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table opsi_varian enable row level security;

-- Anon & authenticated dapat membaca varian yang aktif (untuk halaman produk publik)
create policy "varian_public_select"
on opsi_varian for select
to anon, authenticated
using (aktif = true);

-- Admin dapat melakukan semua operasi (CRUD varian dari dashboard)
create policy "varian_admin_insert"
on opsi_varian for insert
to authenticated
with check (exists (select 1 from admin where admin.user_id = auth.uid()));

create policy "varian_admin_update"
on opsi_varian for update
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()))
with check (exists (select 1 from admin where admin.user_id = auth.uid()));

create policy "varian_admin_delete"
on opsi_varian for delete
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()));

-- ============================================================
-- REALTIME (untuk live update di admin saat kelola varian)
-- ============================================================
alter publication supabase_realtime add table opsi_varian;
