-- ============================================================
-- Migration: 0009_dibayar_pada.sql
-- Clucky Taiwan — Kolom tanggal pembayaran untuk laporan omzet
-- ============================================================
--
-- Menambahkan kolom dibayar_pada yang diisi secara otomatis
-- melalui trigger saat status_pembayaran berubah menjadi 'lunas'.
-- Data historis pesanan yang sudah lunas sebelum migration ini
-- akan diisi dengan updated_at sebagai estimasi terbaik.
-- ============================================================

-- 1. Tambah kolom dibayar_pada
ALTER TABLE public.pesanan
  ADD COLUMN IF NOT EXISTS dibayar_pada timestamptz;

-- 2. Isi data historis: pesanan yang sudah lunas sebelum migration ini
--    menggunakan updated_at sebagai proxy (estimasi terbaik yang tersedia)
UPDATE public.pesanan
SET dibayar_pada = updated_at
WHERE status_pembayaran = 'lunas'
  AND dibayar_pada IS NULL;

-- 3. Trigger function: isi dibayar_pada saat status berubah ke 'lunas'
CREATE OR REPLACE FUNCTION set_dibayar_pada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hanya isi saat status_pembayaran baru saja menjadi 'lunas'
  -- dan belum pernah diisi sebelumnya (idempotent)
  IF NEW.status_pembayaran = 'lunas'
    AND (OLD.status_pembayaran IS DISTINCT FROM 'lunas')
    AND NEW.dibayar_pada IS NULL
  THEN
    NEW.dibayar_pada = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Pasang trigger ke tabel pesanan
DROP TRIGGER IF EXISTS trg_pesanan_dibayar_pada ON public.pesanan;

CREATE TRIGGER trg_pesanan_dibayar_pada
BEFORE UPDATE ON public.pesanan
FOR EACH ROW
EXECUTE FUNCTION set_dibayar_pada();

-- 5. Index untuk mempercepat query filter tanggal di Dashboard
CREATE INDEX IF NOT EXISTS idx_pesanan_dibayar_pada
  ON public.pesanan(dibayar_pada)
  WHERE dibayar_pada IS NOT NULL;
