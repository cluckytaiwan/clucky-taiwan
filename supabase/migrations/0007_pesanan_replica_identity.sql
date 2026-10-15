-- Migration: 0007_pesanan_replica_identity.sql
-- Aktifkan REPLICA IDENTITY FULL pada tabel pesanan agar Supabase Realtime
-- menyertakan nilai kolom LAMA (old.*) secara lengkap pada event UPDATE.
-- Tanpa ini, payload "old" hanya berisi primary key (id), sehingga tidak bisa
-- membedakan perubahan kolom tertentu (misal: status_pembayaran).

ALTER TABLE public.pesanan REPLICA IDENTITY FULL;
