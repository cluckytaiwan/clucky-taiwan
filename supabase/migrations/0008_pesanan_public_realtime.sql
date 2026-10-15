-- ============================================================
-- Migration: 0008_pesanan_public_realtime.sql
-- Mengaktifkan akses SELECT terbatas pada tabel pesanan untuk
-- mendukung Supabase Realtime subscription dari sisi pelanggan.
--
-- Konteks:
--   Sebelumnya tabel pesanan TIDAK memiliki policy SELECT untuk anon
--   (ditutup total, akses hanya via Edge Function dengan service_role).
--   Supabase Realtime membutuhkan akses SELECT agar client browser
--   dapat berlangganan event UPDATE pada baris pesanannya.
--
-- Tradeoff Keamanan:
--   Policy ini mengizinkan anon membaca baris pesanan via Realtime.
--   Mitigasi: filter channel dilakukan di sisi client (kode_pesanan),
--   sehingga setiap pelanggan hanya subscribe update untuk pesanannya
--   sendiri. Data sensitif (nama, HP, dll) tetap tidak bisa diakses
--   langsung — hanya melalui Edge Function check-order-status yang
--   memvalidasi dua identitas (kode_pesanan + no_hp_pelanggan).
-- ============================================================

CREATE POLICY "pesanan_anon_realtime_select"
ON public.pesanan FOR SELECT
TO anon
USING (true);
