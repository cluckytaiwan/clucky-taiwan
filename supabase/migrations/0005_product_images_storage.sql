-- ============================================================
-- Migration: 0005_product_images_storage.sql
-- Bucket Supabase Storage untuk Gambar Produk
-- ============================================================

-- Insert bucket product-images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
 
-- Policy: Publik bisa membaca (select)
create policy "product_images_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');
 
-- Policy: Admin bisa insert (upload)
create policy "product_images_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (select 1 from admin where admin.user_id = auth.uid())
);
 
-- Policy: Admin bisa update
create policy "product_images_admin_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (select 1 from admin where admin.user_id = auth.uid())
);
 
-- Policy: Admin bisa delete
create policy "product_images_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (select 1 from admin where admin.user_id = auth.uid())
);
