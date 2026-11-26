# Peran, Akun, dan Keranjang (migrasi 0014)

Ringkasan perubahan untuk revisi tugas akhir: login pelanggan, tiga peran, keranjang di database.

## Peran
| Peran | Cara dikenali | Akses |
|---|---|---|
| Pelanggan | akun login yang **tidak** ada di tabel `admin` | Lihat katalog tanpa login. Keranjang, checkout, dan Pesanan Saya wajib login. Hanya melihat pesanan miliknya (RLS `user_id`). |
| Admin | baris tabel `admin` dengan `role = 'admin'` | Pesanan Hari Ini (+ omzet harian), ubah status pesanan, kelola produk/varian/kategori. |
| Owner | baris tabel `admin` dengan `role = 'owner'` | Dasbor laporan, Penjualan (hanya baca), kelola akun admin. **Tidak** memproses pesanan dan tidak bisa menulis produk/kategori (RLS). |

## Perubahan basis data (`supabase/migrations/0014_peran_pelanggan_keranjang.sql`)
- `admin`: kolom `role`, `nama`, `email`; fungsi RLS `is_staff()`, `is_admin_role()`, `is_owner()`.
- Policy tulis produk/kategori/varian/gambar/status pesanan → hanya `role = 'admin'`; baca pesanan → admin & owner.
- `profil` (nama pelanggan, dibuat otomatis oleh trigger saat daftar).
- `pesanan.user_id`; `no_hp_pelanggan` dan `alamat_pelanggan` tidak wajib lagi (checkout hanya meminta nama).
- `keranjang_item`: keranjang per akun (menggantikan `localStorage`).

## Edge Function
- `create-order` — wajib JWT login; pemilik pesanan diambil dari token; tanpa nomor HP.
- `check-order-status` — wajib JWT; hanya pesanan milik akun.
- `manage-admin` (baru) — tambah/ubah/hapus akun admin; hanya Owner.
- Perbaikan: bila Midtrans tidak terjangkau, pesanan dibatalkan dan stok dikembalikan.

## Langkah rilis (production) — urutan penting
1. `supabase db push` → menerapkan `0014` (jalankan **sebelum** deploy function).
2. Jadikan akun pemilik sebagai Owner (ganti email):
   ```sql
   insert into public.admin (user_id, role, nama, email)
   select id, 'owner', 'Nama Pemilik', email from auth.users where email = 'email-pemilik@...'
   on conflict (user_id) do update set role = 'owner';
   ```
3. `supabase functions deploy create-order check-order-status manage-admin`
4. Deploy frontend (Vercel).
5. Cek: daftar pelanggan → tambah keranjang → checkout QRIS; login Admin → ubah status; login Owner → buat akun admin.

> Migrasi `0013_explicit_table_grants.sql` ada di branch `chore/local-dev` dan belum di `main`. `0014` sudah memberi GRANT eksplisit untuk tabel yang disentuhnya, jadi tidak bergantung pada 0013.

## Uji lokal
Supabase lokal (OrbStack): terapkan migrasi, buat akun owner lewat Auth API/SQL di atas, jalankan `supabase functions serve --env-file supabase/functions/.env.local --no-verify-jwt`. Midtrans tidak tersedia secara lokal; alamat Snap bisa diarahkan ke server tiruan.
