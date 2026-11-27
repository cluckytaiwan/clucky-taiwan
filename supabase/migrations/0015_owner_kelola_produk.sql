-- ============================================================
-- 0015 — Owner boleh mengelola produk, kategori, varian, dan gambar
--
-- Sebelumnya (0014) hanya role 'admin' yang boleh menulis data katalog.
-- Kini owner juga boleh (is_staff = admin ATAU owner).
-- Memproses pesanan (ubah status_pesanan) TETAP hanya untuk admin.
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- kategori
drop policy if exists "kategori_admin_insert" on public.kategori;
drop policy if exists "kategori_admin_update" on public.kategori;
drop policy if exists "kategori_admin_delete" on public.kategori;
create policy "kategori_admin_insert" on public.kategori for insert to authenticated with check (public.is_staff());
create policy "kategori_admin_update" on public.kategori for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "kategori_admin_delete" on public.kategori for delete to authenticated using (public.is_staff());

-- produk
drop policy if exists "produk_admin_insert" on public.produk;
drop policy if exists "produk_admin_update" on public.produk;
drop policy if exists "produk_admin_delete" on public.produk;
create policy "produk_admin_insert" on public.produk for insert to authenticated with check (public.is_staff());
create policy "produk_admin_update" on public.produk for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "produk_admin_delete" on public.produk for delete to authenticated using (public.is_staff());

-- opsi_varian
drop policy if exists "varian_admin_insert" on public.opsi_varian;
drop policy if exists "varian_admin_update" on public.opsi_varian;
drop policy if exists "varian_admin_delete" on public.opsi_varian;
create policy "varian_admin_insert" on public.opsi_varian for insert to authenticated with check (public.is_staff());
create policy "varian_admin_update" on public.opsi_varian for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "varian_admin_delete" on public.opsi_varian for delete to authenticated using (public.is_staff());

-- gambar produk (storage)
drop policy if exists "product_images_admin_insert" on storage.objects;
drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());
create policy "product_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
create policy "product_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
