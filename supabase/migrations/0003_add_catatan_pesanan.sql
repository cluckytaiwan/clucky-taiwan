-- ============================================================
-- Migration: 0003_add_catatan_pesanan.sql
-- Menambahkan kolom catatan pada tabel pesanan.
-- ============================================================

ALTER TABLE pesanan ADD COLUMN catatan TEXT;
