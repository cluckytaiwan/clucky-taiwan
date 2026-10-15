# Activity Diagram Aplikasi Clucky Taiwan

Dokumen ini berisi **11 activity diagram** untuk sistem pemesanan makanan
**Clucky Taiwan** (React + Supabase + Midtrans). Setiap diagram menggunakan
format **PlantUML** dengan **swimlane** untuk menggambarkan peran masing-masing
aktor secara jelas.

**Cara render diagram:**
Salin kode di dalam blok ` ```plantuml ` ke salah satu tools berikut:
- [plantuml.com/plantuml/uml/](https://www.plantuml.com/plantuml/uml/)
- Ekstensi **PlantUML** di VS Code (Jebbs)
- Plugin PlantUML di IntelliJ / WebStorm

**Daftar Diagram:**
1. Pemesanan dan Pembayaran (Pelanggan)
2. Cek Status Pesanan (Pelanggan)
3. Login Admin
4. Kelola Kategori (Admin)
5. Kelola Produk dan Varian (Admin)
6. Kelola Pesanan (Admin)
7. Rekomendasi Budget (Pelanggan)
8. Melihat Detail & Memilih Varian Produk (Pelanggan)
9. Mengelola Keranjang Belanja (Pelanggan)
10. Pemrosesan Webhook Pembayaran (Sistem)
11. Melihat Katalog & Filter Kategori (Pelanggan)

---
## Bagian 1: Activity Diagram Pemesanan dan Pembayaran (Pelanggan)

**Aktor:** Pelanggan | Sistem | Server (Edge Function) | Midtrans

**Tujuan:** Menggambarkan alur lengkap pemesanan — dari memilih produk & varian,
mengisi checkout, proses server-side (validasi stok atomik, pesanan, Snap Token),
pembayaran via QRIS, hingga konfirmasi webhook dari Midtrans.

**Deskripsi Alur:**

Pelanggan membuka katalog, memilih produk, dan memilih varian (ukuran/rasa) yang
wajib dipilih jika tersedia. Harga berubah dinamis sesuai varian. Item disimpan ke
keranjang (Zustand + localStorage). Saat checkout, sistem memvalidasi form dan
melakukan pre-flight check stok. Jika lolos, Edge Function `create-order` dipanggil:
memvalidasi ulang, mengurangi stok atomik via RPC (dengan rollback jika gagal),
menyimpan pesanan, meminta Snap Token ke Midtrans, dan mengembalikan token.
Keranjang dikosongkan setelah pesanan masuk database. Pelanggan membayar via Snap
QRIS. Midtrans mengirim webhook; server memverifikasi signature, idempotency, dan
nominal — lalu memperbarui status pembayaran. Stok dikembalikan jika gagal/batal.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightYellow|Pelanggan|
start
:Buka halaman utama;

|#LightCyan|Sistem|
:Tampilkan katalog produk;

|#LightYellow|Pelanggan|
:Pilih produk dari katalog;

|#LightCyan|Sistem|
:Fetch detail produk & opsi_varian\n(paralel dari Supabase);
if (Produk aktif & stok > 0?) then (Ya)
else (Tidak)
  :Tampilkan pesan error / overlay Stok Habis;
  stop
endif
:Tampilkan detail, varian, harga;

|#LightYellow|Pelanggan|
:Pilih varian per tipe (ukuran / rasa);
note right: Wajib pilih semua tipe\nyang tersedia

|#LightCyan|Sistem|
:Hitung harga final = harga dasar\n+ sum(harga_tambahan varian);
if (Semua varian terpilih?) then (Ya)
else (Tidak)
  :Disable tombol, tampilkan hint;
  |#LightYellow|Pelanggan|
  :Perbaiki pilihan varian;
  |#LightCyan|Sistem|
endif

|#LightYellow|Pelanggan|
:Atur jumlah (qty), klik\n"Tambah ke Keranjang";

|#LightCyan|Sistem|
:Simpan item ke keranjang\n(Zustand + localStorage);

|#LightYellow|Pelanggan|
:Buka keranjang, klik "Checkout";

|#LightCyan|Sistem|
:Tampilkan form data pelanggan\n& ringkasan belanja;

|#LightYellow|Pelanggan|
:Isi nama, nomor HP, alamat,\ncatatan (opsional);
:Klik "Bayar Sekarang";

|#LightCyan|Sistem|
if (Validasi form: nama, HP format,\nalamat min. 10 karakter?) then (Valid)
else (Tidak Valid)
  :Tampilkan error per field;
  |#LightYellow|Pelanggan|
  :Perbaiki data;
  |#LightCyan|Sistem|
endif
:Pre-flight: cek stok terbaru ke Supabase;
if (Stok cukup & produk aktif?) then (Ya)
else (Tidak)
  :Tampilkan error stok, hentikan;
  stop
endif
:Panggil Edge Function create-order;

|#LightGreen|Server (create-order)|
:Validasi payload: format HP,\nproduk valid, varian cocok, qty;
if (Payload valid?) then (Ya)
else (Tidak)
  :Return VALIDATION_ERROR;
  |#LightCyan|Sistem|
  :Tampilkan error;
  stop
endif
:Kurangi stok per produk\nvia RPC kurangi_stok (atomik);
if (Stok cukup semua item?) then (Ya)
else (Tidak — race condition)
  :Rollback stok yang sudah dikurangi;
  :Return INSUFFICIENT_STOCK;
  |#LightCyan|Sistem|
  :Tampilkan error;
  stop
endif
:INSERT pesanan ke tabel pesanan;
:INSERT detail_pesanan\n(snapshot varian dalam JSON);
:Request Snap Token ke Midtrans API;
if (Snap Token berhasil?) then (Ya)
else (Tidak)
  :Rollback: hapus pesanan,\nkembalikan stok;
  :Return PAYMENT_GATEWAY_ERROR;
  |#LightCyan|Sistem|
  :Tampilkan error;
  stop
endif
:UPDATE snap_token ke pesanan;
:Return: snap_token, kode_pesanan;

|#LightCyan|Sistem|
:Kosongkan keranjang belanja;
:Muat Midtrans Snap,\nbuka popup pembayaran QRIS;

|#LightYellow|Pelanggan|
if (Selesaikan pembayaran di Snap?) then (Ya)
else (Tutup popup)
  |#LightCyan|Sistem|
  :Simpan snap_token ke localStorage;
  :Tampilkan modal pilihan;
  if (Pilihan pelanggan?) then (Bayar Sekarang)
    :Buka kembali popup Snap;
    |#LightYellow|Pelanggan|
  else (Bayar Nanti)
    :Pesanan tersimpan pending,\ntoken bisa dipakai dari Cek Pesanan;
    stop
  endif
endif

|#Pink|Midtrans|
:Kirim notifikasi webhook POST\nke midtrans-webhook;

|#LightGreen|Server (midtrans-webhook)|
:Verifikasi SHA-512 signature;
if (Signature valid?) then (Ya)
else (Tidak)
  :Tolak, return HTTP 200;
  stop
endif
:Cari pesanan by midtrans_order_id;
if (Pesanan ditemukan?) then (Ya)
else (Tidak)
  :Return HTTP 200;
  stop
endif
if (Status pesanan sudah final?\n(idempotency)) then (Tidak)
else (Ya — sudah final)
  :Abaikan, return 200;
  stop
endif
:Validasi nominal pembayaran\n(toleransi Rp 1);
if (Nominal cocok?) then (Ya)
else (Tidak)
  :Tolak, return 200;
  stop
endif
:Mapping status Midtrans → status lokal;
if (Ada status yang perlu diperbarui?) then (Ya)
else (Tidak — status pending)
  stop
endif
:UPDATE status_pembayaran di pesanan;
if (Status = kadaluarsa/dibatalkan/ditolak?) then (Ya)
  :Kembalikan stok setiap item\nvia RPC tambah_stok;
else (Tidak — lunas)
  note right: Stok sudah permanen\ndari reservasi create-order
endif

|#LightCyan|Sistem|
:Realtime UPDATE / onSuccess\ncallback dipanggil;
:Simpan riwayat ke localStorage;
:Tampilkan halaman sukses\nbeserta kode pesanan (CTX-XXXXX);
stop
@enduml
```

---

## Bagian 2: Activity Diagram Cek Status Pesanan (Pelanggan)

**Aktor:** Pelanggan | Sistem | Server (Edge Function)

**Tujuan:** Menggambarkan alur pelanggan memeriksa status pesanan menggunakan
dua identitas (kode pesanan + nomor HP) sebagai mekanisme anti-enumeration,
termasuk kemungkinan melanjutkan pembayaran yang masih pending.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightYellow|Pelanggan|
start
:Buka halaman /cek-pesanan;

|#LightCyan|Sistem|
:Baca riwayat pesanan\ndari localStorage;
if (Ada riwayat pesanan?) then (Ya)
  :Tampilkan kartu-kartu\nriwayat pesanan;
  |#LightYellow|Pelanggan|
  if (Klik kartu riwayat?) then (Ya)
    :Form terisi otomatis\n(kode pesanan + nomor HP);
    |#LightCyan|Sistem|
  else (Tidak — isi manual)
    |#LightYellow|Pelanggan|
    :Isi kode pesanan & nomor HP secara manual;
    |#LightCyan|Sistem|
  endif
else (Tidak)
  :Tampilkan "Belum ada riwayat pesanan";
  |#LightYellow|Pelanggan|
  :Isi kode pesanan & nomor HP;
  |#LightCyan|Sistem|
endif
if (Kedua kolom terisi?) then (Ya)
else (Tidak)
  :Tampilkan peringatan;
  |#LightYellow|Pelanggan|
  :Lengkapi isian;
  |#LightCyan|Sistem|
endif
:Panggil Edge Function\ncheck-order-status;

|#LightGreen|Server (check-order-status)|
:Cari pesanan:\nkode_pesanan + no_hp_pelanggan\nwajib cocok keduanya;
if (Pesanan ditemukan & HP cocok?) then (Ya)
else (Tidak)
  :Return ORDER_NOT_FOUND;
  |#LightCyan|Sistem|
  :Tampilkan "Pesanan tidak ditemukan\natau nomor telepon tidak cocok";
  stop
endif
:Ambil detail_pesanan (item-item);
if (Status = menunggu_pembayaran?) then (Ya)
  :Sertakan snap_token\ndalam response;
else (Tidak)
  :snap_token = null;
endif
:Return data pesanan + items;

|#LightCyan|Sistem|
:Tampilkan detail pesanan\n& timeline status;
note right
  Timeline: Menunggu Pembayaran
  → Diproses → Siap Diambil → Selesai
  Status gagal ditandai ikon X
end note
if (Status menunggu_pembayaran\n& snap_token tersedia?) then (Ya)
  :Tampilkan tombol\n"Lanjutkan Pembayaran";
  |#LightYellow|Pelanggan|
  if (Klik Lanjutkan Pembayaran?) then (Ya)
    |#LightCyan|Sistem|
    :Buka Midtrans Snap\ndengan token yang ada;
    |#LightYellow|Pelanggan|
    :Selesaikan pembayaran;
    |#LightCyan|Sistem|
    :onSuccess: tampilkan\nhalaman sukses + kode pesanan;
  else (Tidak)
  endif
else (Tidak)
  note right: Jika token expired,\ntampilkan pesan hubungi admin
endif
stop
@enduml
```

---

## Bagian 3: Activity Diagram Login Admin

**Aktor:** Admin | Sistem | Supabase Auth

**Tujuan:** Menggambarkan proses autentikasi admin, termasuk verifikasi whitelist
tabel `admin` setelah login berhasil. Admin tidak bisa mengakses dashboard jika
`user_id`-nya tidak terdaftar di tabel `admin`, meskipun password-nya benar.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightBlue|Admin|
start
:Buka halaman /admin/login;

|#LightCyan|Sistem|
:Tampilkan form login;

|#LightBlue|Admin|
:Isi email & password;
:Klik tombol "Masuk";

|#LightCyan|Sistem|
:Panggil supabase.auth\n.signInWithPassword();

|#LightGreen|Supabase Auth|
if (Kredensial valid?) then (Ya)
  :Buat session, trigger\nonAuthStateChange;
else (Tidak)
  :Return error AuthApiError;
  |#LightCyan|Sistem|
  :Tampilkan "Email atau password salah";
  |#LightBlue|Admin|
  :Perbaiki kredensial;
  |#LightCyan|Sistem|
endif

|#LightCyan|Sistem|
note right: onAuthStateChange dipanggil\noleh AdminAuthContext
:SELECT dari tabel admin\nberdasarkan user_id (whitelist check);

|#LightGreen|Supabase Auth|
if (user_id ada di tabel admin?) then (Ya)
else (Tidak)
  :Return: data null;
  |#LightCyan|Sistem|
  :isAdmin = false;
  :ProtectedRoute blokir akses,\ntampilkan redirect ke login;
  stop
endif
:Return: record admin;

|#LightCyan|Sistem|
:isAdmin = true;
:Session tersimpan otomatis\noleh Supabase;
:Arahkan ke /admin/dashboard;
:Tampilkan dasbor pesanan;

|#LightBlue|Admin|
:Mulai mengelola aplikasi;
stop
@enduml
```

---

## Bagian 4: Activity Diagram Kelola Kategori (Admin)

**Aktor:** Admin | Sistem | Database

**Tujuan:** Menggambarkan alur admin membuat, memperbarui, dan menghapus kategori
menu. Produk yang menggunakan kategori yang dihapus akan otomatis menjadi tanpa
kategori (ON DELETE SET NULL).

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightBlue|Admin|
start
:Buka halaman Kelola Kategori;

|#LightGreen|Database|
:SELECT semua kategori;

|#LightCyan|Sistem|
:Tampilkan daftar kategori;

|#LightBlue|Admin|
if (Pilih aksi?) then (Tambah)
  :Klik "+ Tambah Kategori";
  |#LightCyan|Sistem|
  :Tampilkan form input kosong;
  |#LightBlue|Admin|
  :Isi nama kategori;
  |#LightCyan|Sistem|
  if (Nama diisi & tidak duplikat?) then (Ya)
  else (Tidak)
    :Tampilkan pesan error;
    |#LightBlue|Admin|
    :Perbaiki nama;
    |#LightCyan|Sistem|
  endif
  |#LightGreen|Database|
  :INSERT ke tabel kategori;
else if (Pilih aksi?) then (Edit)
  :Klik ikon edit pada baris kategori;
  |#LightCyan|Sistem|
  :Tampilkan form berisi nama existing;
  |#LightBlue|Admin|
  :Ubah nama kategori;
  |#LightCyan|Sistem|
  if (Nama diisi & tidak duplikat?) then (Ya)
  else (Tidak)
    :Tampilkan pesan error;
    |#LightBlue|Admin|
    :Perbaiki nama;
    |#LightCyan|Sistem|
  endif
  |#LightGreen|Database|
  :UPDATE nama_kategori;
else (Hapus)
  :Klik ikon hapus pada baris kategori;
  |#LightCyan|Sistem|
  :Tampilkan dialog konfirmasi\n(dengan peringatan SET NULL);
  |#LightBlue|Admin|
  if (Konfirmasi hapus?) then (Ya)
    |#LightGreen|Database|
    :DELETE kategori;
    note right: Produk terkait:\nkategori_id = NULL\n(ON DELETE SET NULL)
  else (Batal)
    |#LightCyan|Sistem|
    :Tutup dialog;
    stop
  endif
endif

|#LightGreen|Database|
:Return data terbaru;

|#LightCyan|Sistem|
:Perbarui daftar kategori;

|#LightBlue|Admin|
:Lihat hasil perubahan;
stop
@enduml
```

---

## Bagian 5: Activity Diagram Kelola Produk dan Varian (Admin)

**Aktor:** Admin | Sistem | Database | Supabase Storage

**Tujuan:** Menggambarkan alur admin mengelola produk (CRUD + upload gambar) dan
mengelola varian produk (ukuran/rasa dengan harga tambahan) melalui modal
VariantManager.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightBlue|Admin|
start
:Buka halaman Kelola Produk;

|#LightGreen|Database|
:SELECT produk JOIN kategori;

|#LightCyan|Sistem|
:Tampilkan daftar produk\n(nama, gambar, harga, stok, status);

|#LightBlue|Admin|
if (Pilih aksi?) then (Tambah/Edit Produk)
  :Klik "+ Tambah" atau ikon edit;
  |#LightCyan|Sistem|
  if (Edit?) then (Ya)
    :Form diisi data produk existing;
  else (Tambah)
    :Form kosong;
  endif
  |#LightBlue|Admin|
  :Isi / ubah: nama, deskripsi, harga,\nstok, kategori, status aktif;
  if (Ada file gambar baru?) then (Ya)
    :Pilih file gambar;
    |#LightCyan|Sistem|
    :Validasi data form;
    if (Data valid?) then (Ya)
    else (Tidak)
      :Tampilkan error;
      |#LightBlue|Admin|
      :Perbaiki data;
      |#LightCyan|Sistem|
    endif
    |#Wheat|Supabase Storage|
    :Upload file ke bucket\nproduct-images;
    if (Upload berhasil?) then (Ya)
      :Return public URL gambar;
    else (Tidak)
      :Return error;
      |#LightCyan|Sistem|
      :Tampilkan error upload;
      stop
    endif
  else (Tidak ada gambar baru)
    |#LightCyan|Sistem|
    :Validasi data form;
    if (Data valid?) then (Ya)
    else (Tidak)
      :Tampilkan error;
      |#LightBlue|Admin|
      :Perbaiki data;
      |#LightCyan|Sistem|
    endif
  endif
  |#LightGreen|Database|
  if (Tambah?) then (Ya)
    :INSERT ke tabel produk;
  else (Edit)
    :UPDATE tabel produk;
  endif
else if (Pilih aksi?) then (Hapus Produk)
  :Klik ikon hapus;
  |#LightCyan|Sistem|
  :Tampilkan dialog konfirmasi;
  note right: Produk yang pernah dipesan\nsebaiknya dinonaktifkan saja
  |#LightBlue|Admin|
  if (Konfirmasi hapus?) then (Ya)
    |#LightGreen|Database|
    :DELETE produk;
    note right: opsi_varian terhapus\n(ON DELETE CASCADE)
  else (Batal)
    stop
  endif
else (Kelola Varian)
  :Klik ikon Settings\npada baris produk;
  |#LightCyan|Sistem|
  :Buka modal VariantManager;
  |#LightGreen|Database|
  :SELECT opsi_varian\nuntuk produk ini;
  |#LightCyan|Sistem|
  :Tampilkan daftar varian\ndikelompokkan per tipe;
  |#LightBlue|Admin|
  if (Aksi varian?) then (Tambah Varian)
    :Pilih tipe (ukuran/rasa),\nisi nama & harga tambahan;
    |#LightCyan|Sistem|
    if (Nama tidak duplikat\n& harga ≥ 0?) then (Ya)
    else (Tidak)
      :Tampilkan error validasi;
      |#LightBlue|Admin|
      :Perbaiki input;
      |#LightCyan|Sistem|
    endif
    |#LightGreen|Database|
    :INSERT ke opsi_varian;
  else if (Aksi varian?) then (Edit Varian)
    :Klik ikon edit varian;
    |#LightCyan|Sistem|
    :Form terisi data varian;
    |#LightBlue|Admin|
    :Ubah nama / harga tambahan;
    |#LightCyan|Sistem|
    if (Data valid?) then (Ya)
    else (Tidak)
      :Tampilkan error;
      |#LightBlue|Admin|
      :Perbaiki;
      |#LightCyan|Sistem|
    endif
    |#LightGreen|Database|
    :UPDATE opsi_varian;
  else (Hapus Varian)
    :Klik ikon hapus varian;
    |#LightCyan|Sistem|
    :Tampilkan dialog konfirmasi;
    |#LightBlue|Admin|
    if (Konfirmasi?) then (Ya)
      |#LightGreen|Database|
      :DELETE opsi_varian;
    else (Batal)
    endif
  endif
endif

|#LightGreen|Database|
:Return data terbaru;

|#LightCyan|Sistem|
:Perbarui daftar produk / varian;

|#LightBlue|Admin|
:Lihat hasil perubahan;
stop
@enduml
```

---

## Bagian 6: Activity Diagram Kelola Pesanan (Admin)

**Aktor:** Admin | Sistem | Database

**Tujuan:** Menggambarkan alur admin memantau pesanan secara real-time, melihat
detail, dan memperbarui status pengiriman (fulfillment status) khusus untuk
pesanan yang sudah lunas.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightBlue|Admin|
start
:Buka Dasbor Pesanan;

|#LightGreen|Database|
:SELECT pesanan\n(50/halaman, ORDER BY created_at DESC);

|#LightCyan|Sistem|
:Hitung & tampilkan\nSalesSummary (pesanan lunas,\ntotal pendapatan, sedang diproses);
:Subscribe Supabase Realtime\n(postgres_changes pada tabel pesanan);
:Tampilkan daftar pesanan;

|#LightGreen|Database|
fork
  :Realtime INSERT → pesanan baru masuk;
  |#LightCyan|Sistem|
  :Fetch pesanan baru + relasi,\ntambahkan ke daftar;
fork again
  :Realtime UPDATE → status berubah;
  |#LightCyan|Sistem|
  :Perbarui baris di state lokal;
fork again
  :Realtime DELETE;
  |#LightCyan|Sistem|
  :Hapus baris dari state lokal;
end fork

|#LightBlue|Admin|
:Pilih filter status pembayaran\n& urutan tampilan;

|#LightCyan|Sistem|
:Tampilkan daftar pesanan\nsesuai filter & urutan;

|#LightBlue|Admin|
:Klik baris pesanan;

|#LightCyan|Sistem|
:Buka modal OrderDetailModal\n(nama, HP, alamat, item,\ncatatan, total, status);

|#LightBlue|Admin|
if (Status pembayaran = lunas?) then (Ya)
  :Buka FulfillmentDropdown;
  :Pilih status pengiriman:\nDiproses / Siap Diambil / Selesai;
  |#LightGreen|Database|
  :UPDATE status_pesanan\ndi tabel pesanan;
  |#LightCyan|Sistem|
  :Perbarui tampilan daftar & modal;
  :Realtime UPDATE dikirim\nke semua klien berlangganan;
  note right: Pelanggan melihat\nstatus terbaru di\nhalaman cek pesanan
else (Tidak)
  :Kolom status kirim terkunci\n(tampil tanda "—");
endif

|#LightBlue|Admin|
:Tutup modal;
stop
@enduml
```

---

## Bagian 7: Activity Diagram Rekomendasi Budget (Pelanggan)

**Aktor:** Pelanggan | Sistem

**Tujuan:** Menggambarkan alur pelanggan menggunakan fitur rekomendasi budget
untuk mendapatkan paket menu optimal. Kalkulasi dilakukan di sisi klien
menggunakan data produk yang sudah dimuat — tanpa query tambahan ke database.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightYellow|Pelanggan|
start
:Buka halaman utama;

|#LightCyan|Sistem|
:Tampilkan panel\nRekomendasi Budget;

|#LightYellow|Pelanggan|
:Geser slider atau ketik\nnominal budget;

|#LightCyan|Sistem|
if (Budget ≥ harga produk termurah?) then (Ya)
else (Tidak)
  :Tampilkan "Budget belum cukup";
  |#LightYellow|Pelanggan|
  :Naikkan budget;
  |#LightCyan|Sistem|
endif
:Hitung kombinasi menu\ngetRecommendations(products, budget)\n[kalkulasi client-side];
if (Ada kombinasi yang sesuai?) then (Ya)
else (Tidak)
  :Tampilkan "Belum ada\nkombinasi yang pas";
  |#LightYellow|Pelanggan|
  :Sesuaikan budget;
  |#LightCyan|Sistem|
endif
:Tampilkan maks. 3 kartu rekomendasi:\nPilihan Terbaik, Hemat Banget, Lebih Banyak;
note right
  Setiap kartu menampilkan:
  - Daftar item
  - Total harga
  - Efisiensi budget (%)
  - Kembalian
end note

|#LightYellow|Pelanggan|
:Pilih satu kartu,\nklik tombol;

|#LightCyan|Sistem|
if (Ada produk bervarian\ndalam paket?) then (Ya)
  :Masukkan item tanpa varian\nke keranjang langsung;
  :Buka VariantBottomSheet\nuntuk produk bervarian;
  |#LightYellow|Pelanggan|
  :Pilih varian di modal;
  |#LightCyan|Sistem|
  :Tambahkan produk bervarian\nke keranjang;
else (Tidak)
  :Masukkan semua item\nke keranjang langsung;
endif

:Buka CartDrawer;

|#LightYellow|Pelanggan|
:Lihat ringkasan keranjang;
stop
@enduml
```

---

## Bagian 8: Activity Diagram Melihat Detail & Memilih Varian Produk (Pelanggan)

**Aktor:** Pelanggan | Sistem | Database

**Tujuan:** Menggambarkan alur pelanggan membuka halaman detail produk, memilih
varian (wajib jika tersedia), melihat perubahan harga dinamis, dan menambahkan
produk ke keranjang.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightYellow|Pelanggan|
start
:Klik kartu produk di katalog;

|#LightCyan|Sistem|
:Baca ID produk dari URL (:id);

|#LightGreen|Database|
fork
  :SELECT produk WHERE id = :id;
fork again
  :SELECT opsi_varian\nWHERE produk_id = :id AND aktif = true;
end fork
:Return data produk & varian;

|#LightCyan|Sistem|
if (Produk ditemukan & aktif?) then (Ya)
else (Tidak)
  :Tampilkan error\n"Produk tidak ditemukan atau tidak aktif";
  stop
endif
:Tampilkan: nama, kategori,\ngambar, deskripsi, harga dasar;
if (Stok > 0?) then (Ya)
else (Tidak)
  :Tampilkan overlay "Stok Habis",\ntombol tambah di-disable;
  stop
endif
if (Produk memiliki varian?) then (Ya)
  :Tampilkan selector varian\nper tipe (ukuran / rasa);
  |#LightYellow|Pelanggan|
  :Pilih satu opsi per tipe;
  |#LightCyan|Sistem|
  :Hitung harga final =\nharga dasar + sum(harga_tambahan);
  :Update tampilan harga secara real-time;
  if (Semua tipe varian dipilih?) then (Ya)
  else (Tidak)
    :Tombol tambah di-disable,\ntampilkan hint tipe yang belum dipilih;
    |#LightYellow|Pelanggan|
    :Pilih varian yang belum;
    |#LightCyan|Sistem|
  endif
else (Tidak ada varian)
endif

|#LightYellow|Pelanggan|
:Atur jumlah (qty) via stepper\n(min 1, maks stok);
:Klik "Tambah ke Keranjang";

|#LightCyan|Sistem|
:Generate cart_key unik\n(productId::variantIds);
if (cart_key sudah ada di keranjang?) then (Ya)
  :Merge: tambah qty,\ntidak melebihi stok;
else (Tidak)
  :Tambahkan item baru ke keranjang;
endif
:Simpan ke Zustand + localStorage;
:Tampilkan notifikasi sukses\n& feedback visual;

|#LightYellow|Pelanggan|
:Lanjut belanja atau buka keranjang;
stop
@enduml
```

---

## Bagian 9: Activity Diagram Mengelola Keranjang Belanja (Pelanggan)

**Aktor:** Pelanggan | Sistem

**Tujuan:** Menggambarkan alur pelanggan melihat, mengubah jumlah, dan menghapus
item dalam keranjang sebelum melanjutkan ke checkout. Keranjang di-persist di
localStorage via Zustand middleware.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightYellow|Pelanggan|
start
:Klik ikon keranjang di header;

|#LightCyan|Sistem|
:Buka CartDrawer\n(panel geser dari kanan);
if (Keranjang kosong?) then (Ya)
  :Tampilkan ikon kosong\n"Keranjang masih kosong"\n+ tombol "Mulai Belanja";
  |#LightYellow|Pelanggan|
  if (Klik Mulai Belanja?) then (Ya)
    |#LightCyan|Sistem|
    :Tutup CartDrawer;
    stop
  else (Tidak)
    stop
  endif
else (Tidak)
endif
:Tampilkan daftar item:\nnama, label varian, harga, qty;
:Tampilkan total harga keseluruhan;

|#LightYellow|Pelanggan|
if (Pilih aksi?) then (Tambah qty +)
  |#LightCyan|Sistem|
  :Tambah qty 1\n(maks = stok snapshot);
  :Perbarui tampilan;
  |#LightYellow|Pelanggan|
else if (Pilih aksi?) then (Kurangi qty -)
  |#LightCyan|Sistem|
  :Kurangi qty 1;
  if (qty menjadi 0?) then (Ya)
    :Hapus item dari keranjang;
  else (Tidak)
    :Perbarui tampilan;
  endif
  |#LightYellow|Pelanggan|
else if (Pilih aksi?) then (Hapus item)
  |#LightCyan|Sistem|
  :Hapus item dari keranjang;
  :Perbarui tampilan;
  if (Keranjang kosong setelah hapus?) then (Ya)
    :Tampilkan tampilan kosong;
  else (Tidak)
  endif
  |#LightYellow|Pelanggan|
else (Checkout)
  |#LightCyan|Sistem|
  :Tutup CartDrawer;
  :Navigasi ke halaman /checkout;
  stop
endif
:Lanjut interaksi keranjang;
stop
@enduml
```

---

## Bagian 10: Activity Diagram Pemrosesan Webhook Pembayaran (Sistem)

**Aktor:** Midtrans | Server (midtrans-webhook) | Database

**Tujuan:** Menggambarkan alur server memproses notifikasi pembayaran dari Midtrans
secara otomatis — termasuk verifikasi keamanan (SHA-512 signature), idempotency,
validasi nominal, mapping status, dan pengembalian stok jika pembayaran gagal.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#Pink|Midtrans|
start
:Kirim notifikasi POST\nke endpoint midtrans-webhook;

|#LightGreen|Server (midtrans-webhook)|
:Terima & parse payload JSON;
:Hitung SHA-512 signature:\norder_id + status_code +\ngross_amount + server_key;
if (Signature cocok?) then (Ya)
else (Tidak)
  :Log error;
  :Return HTTP 200\n(mencegah retry Midtrans);
  stop
endif

|#LightGreen|Server (midtrans-webhook)|

|#LightSkyBlue|Database|
:SELECT pesanan\nWHERE midtrans_order_id = ?;

|#LightGreen|Server (midtrans-webhook)|
if (Pesanan ditemukan?) then (Ya)
else (Tidak)
  :Return HTTP 200;
  stop
endif
if (Status pesanan sudah final?\n(lunas/kadaluarsa/dibatalkan/\nditolak/dikembalikan)) then (Tidak)
else (Ya — idempotency)
  :Abaikan notifikasi,\nreturn 200;
  stop
endif
:Validasi nominal pembayaran;
if (|notified_amount − total_harga| ≤ Rp 1?) then (Ya)
else (Tidak)
  :Log mismatch;
  :Return HTTP 200;
  stop
endif
:Mapping status Midtrans\n→ status lokal:\ncapture+accept→lunas,\nsettle→lunas,\ndeny→ditolak, dll.;
if (Ada status yang perlu diperbarui?\n(bukan "pending")) then (Ya)
else (Tidak)
  :Return "No action needed";
  stop
endif

|#LightSkyBlue|Database|
:UPDATE status_pembayaran\ndi tabel pesanan;

|#LightGreen|Server (midtrans-webhook)|
if (Status baru =\nkadaluarsa / dibatalkan / ditolak?) then (Ya)
  |#LightSkyBlue|Database|
  :SELECT produk_id, jumlah\nFROM detail_pesanan\nWHERE pesanan_id = ?;
  :Kembalikan stok setiap item:\nRPC tambah_stok per produk;
  |#LightGreen|Server (midtrans-webhook)|
  note right: Stok kembali karena\npembayaran tidak jadi
else (Tidak — lunas)
  note right: Stok TIDAK dikembalikan.\nReservasi dari create-order\nmenjadi permanen.
endif
:Return HTTP 200 "OK";
stop
@enduml
```

---

## Bagian 11: Activity Diagram Melihat Katalog & Filter Kategori (Pelanggan)

**Aktor:** Pelanggan | Sistem | Database

**Tujuan:** Menggambarkan alur dasar penggunaan sistem — pelanggan membuka aplikasi,
sistem mengambil data produk dari Supabase, dan pelanggan menyaring tampilan
berdasarkan kategori yang dipilih.

**Kode Diagram (PlantUML):**

```plantuml
@startuml
!theme plain
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam backgroundColor #FFFFFF
skinparam activityBackgroundColor #FFF8F0
skinparam activityBorderColor #C0392B
skinparam activityDiamondBackgroundColor #FEF9E7
skinparam activityDiamondBorderColor #E67E22
skinparam swimlaneBorderColor #AAAAAA
skinparam ArrowColor #555555

|#LightYellow|Pelanggan|
start
:Buka halaman utama (/);

|#LightCyan|Sistem|
:Panggil useProducts()\nfetch produk JOIN kategori;

|#LightSkyBlue|Database|
:SELECT produk, kategori;
:Return data produk aktif;

|#LightCyan|Sistem|
if (Sedang loading?) then (Ya)
  :Tampilkan skeleton\n4 kartu animasi;
  note right: Tunggu hingga\ndata selesai dimuat
else (Tidak)
endif
if (Terjadi error?) then (Ya)
  :Tampilkan pesan error;
  stop
else (Tidak)
endif
if (Ada produk tersedia?) then (Ya)
else (Tidak)
  :Tampilkan\n"Belum ada menu tersedia saat ini";
  stop
endif
:Tampilkan grid katalog produk\n(gambar, nama, harga, kategori);
:Buat daftar kategori unik\ndari data produk (termasuk "Semua");
:Tampilkan tombol-tombol\nfilter kategori;

|#LightYellow|Pelanggan|
:Pilih kategori;

|#LightCyan|Sistem|
:Filter produk berdasarkan\nkategori yang dipilih\n(client-side, tanpa query baru);
if (Hasil filter kosong?) then (Ya)
  :Tampilkan\n"Tidak ada menu di kategori ini";
else (Tidak)
  :Tampilkan produk\nyang sudah difilter;
endif

|#LightYellow|Pelanggan|
:Menelusuri produk;
stop
@enduml
```
