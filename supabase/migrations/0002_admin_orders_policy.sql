-- ============================================================
-- Migration: 0002_admin_orders_policy.sql
-- Menambahkan policy agar Admin bisa membaca dan update pesanan 
-- dari Dashboard Admin (menggunakan Client SDK).
-- ============================================================

-- Policy untuk tabel pesanan
create policy "pesanan_admin_select"
on pesanan for select
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()));

create policy "pesanan_admin_update"
on pesanan for update
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()))
with check (exists (select 1 from admin where admin.user_id = auth.uid()));

-- Policy untuk tabel detail_pesanan
create policy "detail_pesanan_admin_select"
on detail_pesanan for select
to authenticated
using (exists (select 1 from admin where admin.user_id = auth.uid()));
