-- ============================================================
-- Migration: 0006_kode_pesanan.sql
-- Menambahkan kolom kode_pesanan ke tabel pesanan
-- ============================================================

-- Tambahkan kolom kode_pesanan 
ALTER TABLE public.pesanan
ADD COLUMN IF NOT EXISTS kode_pesanan VARCHAR(15);

-- Secara opsional, buat UNIQUE constraint agar kode pesanan tidak mungkin duplikat
ALTER TABLE public.pesanan
ADD CONSTRAINT pesanan_kode_pesanan_key UNIQUE (kode_pesanan);

-- Buat index untuk mempercepat pencarian oleh tracker
CREATE INDEX IF NOT EXISTS idx_pesanan_kode_pesanan ON public.pesanan(kode_pesanan);
