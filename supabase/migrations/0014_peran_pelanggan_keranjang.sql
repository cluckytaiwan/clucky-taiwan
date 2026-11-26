-- ============================================================
-- 0014 — Peran (pelanggan / admin / owner), akun pelanggan, keranjang di database
--
-- Perubahan:
--   1. Tabel admin diberi kolom role ('admin' | 'owner'), nama, email.
--      Owner = pemilik usaha: melihat laporan & pesanan (hanya baca) serta
--      mengelola akun admin, TIDAK memproses pesanan.
--   2. Fungsi pembantu is_staff / is_admin_role / is_owner untuk RLS.
--   3. Policy tulis (produk, kategori, varian, status pesanan, gambar) dibatasi
--      ke role 'admin'; baca pesanan dibuka untuk admin DAN owner.
--   4. Tabel profil (nama pelanggan) otomatis dibuat saat akun baru terdaftar.
--   5. pesanan.user_id (pemilik pesanan); no_hp_pelanggan & alamat_pelanggan
--      tidak lagi wajib (checkout hanya meminta nama). Pelanggan boleh membaca
--      pesanan miliknya sendiri (dasar riwayat pesanan & Realtime).
--   6. Tabel keranjang_item: keranjang tersimpan per akun di database
--      (menggantikan localStorage).
-- Aman dijalankan ulang (idempotent). Jalankan SEBELUM men-deploy Edge Function baru.
-- ============================================================

-- 1. Peran pada tabel admin ----------------------------------
alter table public.admin
  add column if not exists role  text not null default 'admin',
  add column if not exists nama  text,
  add column if not exists email text;

alter table public.admin drop constraint if exists admin_role_check;
alter table public.admin add constraint admin_role_check check (role in ('admin', 'owner'));

-- Akun admin yang sudah ada: lengkapi email & nama dari akun login
update public.admin a
set email = coalesce(a.email, u.email),
    nama  = coalesce(a.nama, nullif(trim(u.raw_user_meta_data->>'nama'), ''), split_part(u.email, '@', 1))
from auth.users u
where u.id = a.user_id and (a.email is null or a.nama is null);

-- 2. Fungsi pembantu RLS -------------------------------------
-- security definer + search_path tetap: aman dipanggil dari policy tanpa memicu
-- rekursi RLS pada tabel admin.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin where user_id = auth.uid());
$$;

create or replace function public.is_admin_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin where user_id = auth.uid() and role = 'owner');
$$;

revoke all on function public.is_staff(), public.is_admin_role(), public.is_owner() from public;
grant execute on function public.is_staff(), public.is_admin_role(), public.is_owner() to anon, authenticated, service_role;

-- Owner boleh melihat seluruh daftar akun admin (tulis hanya lewat Edge Function manage-admin)
drop policy if exists "admin_owner_select_all" on public.admin;
create policy "admin_owner_select_all"
on public.admin for select to authenticated
using (public.is_owner());

-- 3. Policy tulis hanya untuk role 'admin' -------------------
-- kategori
drop policy if exists "kategori_admin_insert" on public.kategori;
drop policy if exists "kategori_admin_update" on public.kategori;
drop policy if exists "kategori_admin_delete" on public.kategori;
create policy "kategori_admin_insert" on public.kategori for insert to authenticated with check (public.is_admin_role());
create policy "kategori_admin_update" on public.kategori for update to authenticated using (public.is_admin_role()) with check (public.is_admin_role());
create policy "kategori_admin_delete" on public.kategori for delete to authenticated using (public.is_admin_role());

-- produk
drop policy if exists "produk_admin_insert" on public.produk;
drop policy if exists "produk_admin_update" on public.produk;
drop policy if exists "produk_admin_delete" on public.produk;
create policy "produk_admin_insert" on public.produk for insert to authenticated with check (public.is_admin_role());
create policy "produk_admin_update" on public.produk for update to authenticated using (public.is_admin_role()) with check (public.is_admin_role());
create policy "produk_admin_delete" on public.produk for delete to authenticated using (public.is_admin_role());

-- opsi_varian
drop policy if exists "varian_admin_insert" on public.opsi_varian;
drop policy if exists "varian_admin_update" on public.opsi_varian;
drop policy if exists "varian_admin_delete" on public.opsi_varian;
create policy "varian_admin_insert" on public.opsi_varian for insert to authenticated with check (public.is_admin_role());
create policy "varian_admin_update" on public.opsi_varian for update to authenticated using (public.is_admin_role()) with check (public.is_admin_role());
create policy "varian_admin_delete" on public.opsi_varian for delete to authenticated using (public.is_admin_role());

-- gambar produk (storage)
drop policy if exists "product_images_admin_insert" on storage.objects;
drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin_role());
create policy "product_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin_role());
create policy "product_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin_role());

-- pesanan: admin & owner membaca; hanya admin mengubah status
drop policy if exists "pesanan_admin_select" on public.pesanan;
drop policy if exists "pesanan_admin_update" on public.pesanan;
create policy "pesanan_admin_select" on public.pesanan for select to authenticated using (public.is_staff());
create policy "pesanan_admin_update" on public.pesanan for update to authenticated
  using (public.is_admin_role()) with check (public.is_admin_role());

drop policy if exists "detail_pesanan_admin_select" on public.detail_pesanan;
create policy "detail_pesanan_admin_select" on public.detail_pesanan for select to authenticated using (public.is_staff());

-- 4. Profil pelanggan -----------------------------------------
create table if not exists public.profil (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nama       text not null,
  created_at timestamptz not null default now()
);
alter table public.profil enable row level security;

drop policy if exists "profil_self_select" on public.profil;
drop policy if exists "profil_self_update" on public.profil;
create policy "profil_self_select" on public.profil for select to authenticated using (auth.uid() = user_id);
create policy "profil_self_update" on public.profil for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profil dibuat otomatis saat akun baru terdaftar (nama dari data pendaftaran)
create or replace function public.buat_profil_baru()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profil (user_id, nama)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nama'), ''), split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_buat_profil_baru on auth.users;
create trigger trg_buat_profil_baru
after insert on auth.users
for each row execute function public.buat_profil_baru();

-- Akun yang sudah ada sebelum migrasi ini (mis. admin) ikut diberi profil
insert into public.profil (user_id, nama)
select u.id, coalesce(nullif(trim(u.raw_user_meta_data->>'nama'), ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (user_id) do nothing;

-- 5. Pesanan milik akun ---------------------------------------
alter table public.pesanan
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_pesanan_user_id on public.pesanan (user_id, created_at desc);

alter table public.pesanan alter column no_hp_pelanggan drop not null;
alter table public.pesanan alter column alamat_pelanggan drop not null;

drop policy if exists "pesanan_pelanggan_select" on public.pesanan;
create policy "pesanan_pelanggan_select" on public.pesanan for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "detail_pesanan_pelanggan_select" on public.detail_pesanan;
create policy "detail_pesanan_pelanggan_select" on public.detail_pesanan for select to authenticated
  using (exists (select 1 from public.pesanan p where p.id = pesanan_id and p.user_id = auth.uid()));

-- 6. Keranjang per akun ---------------------------------------
create table if not exists public.keranjang_item (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  cart_key   text not null,                          -- produk_id atau produk_id::varian_id_varian_id
  produk_id  uuid not null references public.produk(id) on delete cascade,
  varian_ids uuid[] not null default '{}',
  jumlah     integer not null check (jumlah > 0 and jumlah <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cart_key)
);
create index if not exists idx_keranjang_user on public.keranjang_item (user_id);
alter table public.keranjang_item enable row level security;

drop policy if exists "keranjang_self_all" on public.keranjang_item;
create policy "keranjang_self_all" on public.keranjang_item for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists trg_keranjang_updated_at on public.keranjang_item;
create trigger trg_keranjang_updated_at before update on public.keranjang_item
for each row execute function public.set_updated_at();

-- 7. Hak akses tabel (eksplisit, tidak bergantung pada default Supabase) -------
grant select on public.profil, public.pesanan, public.detail_pesanan to authenticated;
grant update (nama) on public.profil to authenticated;
grant update (status_pesanan) on public.pesanan to authenticated;
grant select, insert, update, delete on public.keranjang_item to authenticated;
grant select on public.admin to authenticated;
