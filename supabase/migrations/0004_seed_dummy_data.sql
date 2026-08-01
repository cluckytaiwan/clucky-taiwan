-- ============================================================
-- Migration: 0004_seed_dummy_data.sql
-- Memasukkan data awal (kategori dan produk) ke database
-- ============================================================

-- 1. Insert Kategori
-- Gunakan ON CONFLICT DO NOTHING agar aman jika sudah ada
INSERT INTO kategori (nama_kategori)
VALUES 
  ('Ayam Goreng'),
  ('Paket Hemat'),
  ('Minuman'),
  ('Pelengkap')
ON CONFLICT (nama_kategori) DO NOTHING;

-- 2. Insert Produk Dummy (Menggunakan Subquery untuk UUID Kategori)
INSERT INTO produk (nama_produk, deskripsi, harga, stok, url_gambar, kategori_id, aktif)
VALUES 
  (
    'Ayam Geprek Original', 
    'Ayam goreng tepung ala Taiwan dengan baluran sambal geprek bawang super pedas.', 
    18000, 
    20, 
    'https://placehold.co/400x400/D6293B/FFF8F1?text=Ayam+Original', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Ayam Goreng' LIMIT 1), 
    true
  ),
  (
    'Ayam Saus Madu Pedas', 
    'Perpaduan rasa pedas dan manis dari saus madu pilihan yang membalut ayam crispy.', 
    22000, 
    15, 
    'https://placehold.co/400x400/B01F2E/FFF8F1?text=Saus+Madu', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Ayam Goreng' LIMIT 1), 
    true
  ),
  (
    'Ayam Geprek Keju Meleleh', 
    'Ayam geprek pedas dengan topping lelehan saus keju cheddar premium.', 
    25000, 
    12, 
    'https://placehold.co/400x400/D6293B/FFF8F1?text=Keju', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Ayam Goreng' LIMIT 1), 
    true
  ),
  (
    'Paket Nasi Puas (Berdua)', 
    '2 Ayam Geprek Original + 2 Nasi Putih + 2 Es Teh Manis.', 
    55000, 
    8, 
    'https://placehold.co/400x400/2B211D/FFF8F1?text=Paket+Berdua', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Paket Hemat' LIMIT 1), 
    true
  ),
  (
    'Es Teh Manis', 
    'Teh melati seduh segar dengan gula tebu asli.', 
    6000, 
    50, 
    'https://placehold.co/400x400/F5A623/2B211D?text=Es+Teh', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Minuman' LIMIT 1), 
    true
  ),
  (
    'Es Lemon Tea', 
    'Perpaduan teh melati dan perasan jeruk lemon segar penghilang dahaga.', 
    8000, 
    30, 
    'https://placehold.co/400x400/F5A623/2B211D?text=Lemon+Tea', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Minuman' LIMIT 1), 
    true
  ),
  (
    'Nasi Putih', 
    'Nasi pulen hangat porsi pas.', 
    5000, 
    100, 
    'https://placehold.co/400x400/EBE1D8/2B211D?text=Nasi', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Pelengkap' LIMIT 1), 
    true
  ),
  (
    'Kol Goreng Crispy', 
    'Kol goreng garing dengan bumbu tabur gurih rahasia.', 
    7000, 
    25, 
    'https://placehold.co/400x400/D6293B/FFF8F1?text=Kol+Goreng', 
    (SELECT id FROM kategori WHERE nama_kategori = 'Pelengkap' LIMIT 1), 
    true
  );
