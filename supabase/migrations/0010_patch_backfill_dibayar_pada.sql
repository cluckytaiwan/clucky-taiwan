-- ============================================================
-- PATCH: Backfill dibayar_pada untuk pesanan lunas yang sudah ada
-- Jalankan di Supabase SQL Editor: https://supabase.com/dashboard
-- ============================================================

-- Cek berapa pesanan lunas yang belum punya dibayar_pada
SELECT
  COUNT(*) FILTER (WHERE dibayar_pada IS NOT NULL)  AS sudah_terisi,
  COUNT(*) FILTER (WHERE dibayar_pada IS NULL)      AS belum_terisi,
  COUNT(*)                                          AS total_lunas
FROM public.pesanan
WHERE status_pembayaran = 'lunas';

-- Isi dibayar_pada dari updated_at untuk semua pesanan lunas yang masih NULL
-- (updated_at = waktu terakhir baris diubah, estimasi terbaik waktu pembayaran)
UPDATE public.pesanan
SET dibayar_pada = updated_at
WHERE status_pembayaran = 'lunas'
  AND dibayar_pada IS NULL;

-- Verifikasi setelah update
SELECT
  COUNT(*) FILTER (WHERE dibayar_pada IS NOT NULL)  AS sudah_terisi,
  COUNT(*) FILTER (WHERE dibayar_pada IS NULL)      AS masih_null,
  MIN(dibayar_pada)                                 AS paling_lama,
  MAX(dibayar_pada)                                 AS paling_baru
FROM public.pesanan
WHERE status_pembayaran = 'lunas';
