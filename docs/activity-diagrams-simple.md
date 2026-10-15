# Activity Diagram Aplikasi Clucky Taiwan

Dokumen ini memuat **11 activity diagram** untuk sistem pemesanan makanan
**Clucky Taiwan** yang dibangun menggunakan React, Supabase, dan Midtrans.
Setiap diagram menggunakan format **PlantUML** dengan **swimlane** untuk
menggambarkan peran masing-masing aktor secara jelas.

**Daftar Diagram:**
1. Melakukan Pemesanan dan Pembayaran (Pelanggan)
2. Memeriksa Status Pesanan (Pelanggan)
3. Melakukan Login Admin
4. Mengelola Kategori (Admin)
5. Mengelola Produk dan Varian (Admin)
6. Mengelola Pesanan (Admin)
7. Menggunakan Rekomendasi Budget (Pelanggan)
8. Melihat Detail dan Memilih Varian Produk (Pelanggan)
9. Mengelola Keranjang Belanja (Pelanggan)
10. Memproses Webhook Pembayaran (Sistem)
11. Melihat Katalog dan Menyaring Kategori (Pelanggan)

---

## Bagian 1: Activity Diagram Melakukan Pemesanan dan Pembayaran (Pelanggan)

**Aktor:** Pelanggan | Sistem | Server | Midtrans

**Tujuan:** Menggambarkan alur pelanggan melakukan pemesanan — mulai dari
memilih produk, mengisi data checkout, memproses pesanan di sisi server,
hingga menyelesaikan pembayaran melalui Midtrans.

**Deskripsi Alur:**

Pelanggan membuka katalog dan memilih produk beserta variannya. Sistem
menghitung harga secara dinamis dan menyimpan item ke keranjang belanja.
Saat pelanggan melanjutkan ke halaman checkout, sistem memvalidasi data
dan memeriksa stok. Jika valid, server memproses pesanan secara atomik,
membuat catatan pesanan, dan meminta Snap Token ke Midtrans. Pelanggan
kemudian menyelesaikan pembayaran. Midtrans mengirimkan notifikasi webhook
yang diverifikasi oleh server untuk memperbarui status pembayaran.

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
:Membuka halaman utama;

|#LightCyan|Sistem|
:Menampilkan katalog produk;

|#LightYellow|Pelanggan|
:Memilih produk dari katalog;

|#LightCyan|Sistem|
:Mengambil detail produk dan varian dari database;
if (Produk aktif dan stok tersedia?) then (Ya)
else (Tidak)
  :Menampilkan pesan stok habis;
  stop
endif
:Menampilkan detail produk, varian, dan harga;

|#LightYellow|Pelanggan|
:Memilih varian (ukuran/rasa);

|#LightCyan|Sistem|
:Menghitung harga final berdasarkan varian;
if (Semua varian telah dipilih?) then (Ya)
else (Tidak)
  :Menonaktifkan tombol tambah;
  |#LightYellow|Pelanggan|
  :Melengkapi pilihan varian;
  |#LightCyan|Sistem|
endif

|#LightYellow|Pelanggan|
:Mengatur jumlah dan menambahkan ke keranjang;

|#LightCyan|Sistem|
:Menyimpan item ke keranjang;

|#LightYellow|Pelanggan|
:Membuka keranjang dan melanjutkan ke checkout;

|#LightCyan|Sistem|
:Menampilkan form data pelanggan dan ringkasan pesanan;

|#LightYellow|Pelanggan|
:Mengisi nama, nomor HP, dan alamat;
:Menekan tombol "Bayar Sekarang";

|#LightCyan|Sistem|
if (Data form valid?) then (Valid)
else (Tidak Valid)
  :Menampilkan pesan kesalahan;
  |#LightYellow|Pelanggan|
  :Memperbaiki data;
  |#LightCyan|Sistem|
endif
:Memeriksa ketersediaan stok terbaru;
if (Stok mencukupi?) then (Ya)
else (Tidak)
  :Menampilkan pesan stok tidak cukup;
  stop
endif
:Memanggil fungsi pembuatan pesanan di server;

|#LightGreen|Server|
:Memvalidasi data pesanan;
if (Data valid?) then (Ya)
else (Tidak)
  :Mengembalikan pesan kesalahan validasi;
  stop
endif
:Mengurangi stok secara atomik;
if (Stok mencukupi?) then (Ya)
else (Tidak)
  :Membatalkan pengurangan stok;
  :Mengembalikan pesan stok tidak cukup;
  stop
endif
:Menyimpan data pesanan ke database;
:Meminta Snap Token ke Midtrans;
if (Snap Token berhasil dibuat?) then (Ya)
else (Tidak)
  :Membatalkan pesanan dan mengembalikan stok;
  stop
endif
:Mengembalikan Snap Token dan kode pesanan;

|#LightCyan|Sistem|
:Mengosongkan keranjang belanja;
:Membuka tampilan pembayaran Midtrans;

|#LightYellow|Pelanggan|
:Menyelesaikan pembayaran;

|#Pink|Midtrans|
:Mengirimkan notifikasi webhook ke server;

|#LightGreen|Server|
:Memverifikasi tanda tangan dan nominal pembayaran;
:Memperbarui status pembayaran di database;
if (Pembayaran gagal atau dibatalkan?) then (Ya)
  :Mengembalikan stok produk;
else (Tidak)
endif

|#LightCyan|Sistem|
:Menampilkan halaman sukses beserta kode pesanan;
stop
@enduml
```

---

## Bagian 2: Activity Diagram Memeriksa Status Pesanan (Pelanggan)

**Aktor:** Pelanggan | Sistem | Server

**Tujuan:** Menggambarkan alur pelanggan memeriksa status pesanan menggunakan
kode pesanan dan nomor HP, termasuk kemungkinan melanjutkan pembayaran
yang masih tertunda.

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
:Membuka halaman Cek Pesanan;

|#LightCyan|Sistem|
:Membaca riwayat pesanan dari penyimpanan lokal;
if (Riwayat pesanan tersedia?) then (Ya)
  :Menampilkan daftar riwayat pesanan;
  |#LightYellow|Pelanggan|
  if (Memilih dari riwayat?) then (Ya)
    :Form terisi otomatis;
    |#LightCyan|Sistem|
  else (Tidak - isi manual)
    |#LightYellow|Pelanggan|
    :Mengisi kode pesanan dan nomor HP;
    |#LightCyan|Sistem|
  endif
else (Tidak)
  :Menampilkan keterangan belum ada riwayat;
  |#LightYellow|Pelanggan|
  :Mengisi kode pesanan dan nomor HP;
  |#LightCyan|Sistem|
endif
if (Kedua kolom telah diisi?) then (Ya)
else (Tidak)
  :Menampilkan peringatan;
  |#LightYellow|Pelanggan|
  :Melengkapi isian;
  |#LightCyan|Sistem|
endif
:Memanggil fungsi pengecekan status pesanan;

|#LightGreen|Server|
:Mencari pesanan berdasarkan kode dan nomor HP;
if (Pesanan ditemukan?) then (Ya)
else (Tidak)
  :Mengembalikan pesan pesanan tidak ditemukan;
  stop
endif
:Mengambil detail item pesanan;
:Mengembalikan data pesanan beserta status;

|#LightCyan|Sistem|
:Menampilkan detail pesanan dan riwayat status;
if (Status menunggu pembayaran dan token tersedia?) then (Ya)
  :Menampilkan tombol "Lanjutkan Pembayaran";
  |#LightYellow|Pelanggan|
  if (Menekan tombol lanjutkan?) then (Ya)
    |#LightCyan|Sistem|
    :Membuka kembali tampilan pembayaran Midtrans;
    |#LightYellow|Pelanggan|
    :Menyelesaikan pembayaran;
  else (Tidak)
  endif
else (Tidak)
endif
stop
@enduml
```

---

## Bagian 3: Activity Diagram Melakukan Login Admin

**Aktor:** Admin | Sistem | Supabase Auth

**Tujuan:** Menggambarkan proses autentikasi admin, termasuk verifikasi
whitelist tabel `admin` setelah login berhasil. Admin tidak dapat mengakses
dasbor apabila akunnya tidak terdaftar di tabel `admin`.

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
:Membuka halaman login admin;

|#LightCyan|Sistem|
:Menampilkan form login;

|#LightBlue|Admin|
:Mengisi email dan kata sandi;
:Menekan tombol "Masuk";

|#LightCyan|Sistem|
:Mengirimkan permintaan autentikasi ke Supabase;

|#LightGreen|Supabase Auth|
if (Kredensial valid?) then (Ya)
  :Membuat sesi pengguna;
else (Tidak)
  :Mengembalikan pesan kesalahan;
  |#LightCyan|Sistem|
  :Menampilkan "Email atau kata sandi salah";
  |#LightBlue|Admin|
  :Memperbaiki data login;
  |#LightCyan|Sistem|
endif

|#LightCyan|Sistem|
:Memeriksa keberadaan akun di tabel admin;

|#LightGreen|Supabase Auth|
if (Akun terdaftar sebagai admin?) then (Ya)
else (Tidak)
  :Mengembalikan data kosong;
  |#LightCyan|Sistem|
  :Memblokir akses dan mengarahkan ke halaman login;
  stop
endif

|#LightCyan|Sistem|
:Menandai pengguna sebagai admin;
:Mengarahkan ke dasbor admin;
:Menampilkan dasbor pesanan;

|#LightBlue|Admin|
:Mulai mengelola aplikasi;
stop
@enduml
```

---

## Bagian 4: Activity Diagram Mengelola Kategori (Admin)

**Aktor:** Admin | Sistem | Database

**Tujuan:** Menggambarkan alur admin menambahkan, memperbarui, dan menghapus
kategori menu. Produk yang menggunakan kategori yang dihapus akan otomatis
menjadi tanpa kategori.

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
:Membuka halaman Kelola Kategori;

|#LightGreen|Database|
:Mengambil semua data kategori;

|#LightCyan|Sistem|
:Menampilkan daftar kategori;

|#LightBlue|Admin|
if (Memilih aksi?) then (Tambah)
  :Menekan tombol tambah kategori;
  |#LightCyan|Sistem|
  :Menampilkan form input kosong;
  |#LightBlue|Admin|
  :Mengisi nama kategori;
  |#LightCyan|Sistem|
  if (Nama valid dan tidak duplikat?) then (Ya)
  else (Tidak)
    :Menampilkan pesan kesalahan;
    |#LightBlue|Admin|
    :Memperbaiki nama;
    |#LightCyan|Sistem|
  endif
  |#LightGreen|Database|
  :Menyimpan kategori baru;
else if (Memilih aksi?) then (Edit)
  :Menekan ikon edit pada kategori;
  |#LightCyan|Sistem|
  :Menampilkan form berisi nama yang ada;
  |#LightBlue|Admin|
  :Mengubah nama kategori;
  |#LightCyan|Sistem|
  if (Nama valid dan tidak duplikat?) then (Ya)
  else (Tidak)
    :Menampilkan pesan kesalahan;
    |#LightBlue|Admin|
    :Memperbaiki nama;
    |#LightCyan|Sistem|
  endif
  |#LightGreen|Database|
  :Memperbarui nama kategori;
else (Hapus)
  :Menekan ikon hapus pada kategori;
  |#LightCyan|Sistem|
  :Menampilkan dialog konfirmasi;
  |#LightBlue|Admin|
  if (Mengkonfirmasi penghapusan?) then (Ya)
    |#LightGreen|Database|
    :Menghapus kategori;
    note right: Produk terkait\ndiatur menjadi tanpa kategori
  else (Batal)
    |#LightCyan|Sistem|
    :Menutup dialog;
    stop
  endif
endif

|#LightGreen|Database|
:Mengembalikan data terbaru;

|#LightCyan|Sistem|
:Memperbarui daftar kategori;

|#LightBlue|Admin|
:Melihat hasil perubahan;
stop
@enduml
```

---

## Bagian 5: Activity Diagram Mengelola Produk dan Varian (Admin)

**Aktor:** Admin | Sistem | Database | Supabase Storage

**Tujuan:** Menggambarkan alur admin mengelola produk (tambah, ubah, hapus,
unggah gambar) dan mengelola varian produk seperti ukuran dan rasa melalui
modal pengelolaan varian.

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
:Membuka halaman Kelola Produk;

|#LightGreen|Database|
:Mengambil data produk beserta kategori;

|#LightCyan|Sistem|
:Menampilkan daftar produk;

|#LightBlue|Admin|
if (Memilih aksi?) then (Tambah/Edit Produk)
  :Menekan tombol tambah atau ikon edit;
  |#LightCyan|Sistem|
  if (Mode edit?) then (Ya)
    :Mengisi form dengan data produk yang ada;
  else (Tambah)
    :Menyediakan form kosong;
  endif
  |#LightBlue|Admin|
  :Mengisi atau mengubah data produk;
  if (Mengunggah gambar baru?) then (Ya)
    :Memilih file gambar;
    |#LightCyan|Sistem|
    :Memvalidasi data form;
    if (Data valid?) then (Ya)
    else (Tidak)
      :Menampilkan pesan kesalahan;
      |#LightBlue|Admin|
      :Memperbaiki data;
      |#LightCyan|Sistem|
    endif
    |#Wheat|Supabase Storage|
    :Mengunggah gambar ke penyimpanan;
    if (Unggahan berhasil?) then (Ya)
      :Mengembalikan URL gambar;
    else (Tidak)
      :Menampilkan pesan gagal unggah;
      stop
    endif
  else (Tidak ada gambar baru)
    |#LightCyan|Sistem|
    :Memvalidasi data form;
    if (Data valid?) then (Ya)
    else (Tidak)
      :Menampilkan pesan kesalahan;
      |#LightBlue|Admin|
      :Memperbaiki data;
      |#LightCyan|Sistem|
    endif
  endif
  |#LightGreen|Database|
  if (Mode tambah?) then (Ya)
    :Menyimpan produk baru;
  else (Edit)
    :Memperbarui data produk;
  endif
else if (Memilih aksi?) then (Hapus Produk)
  :Menekan ikon hapus;
  |#LightCyan|Sistem|
  :Menampilkan dialog konfirmasi;
  |#LightBlue|Admin|
  if (Mengkonfirmasi penghapusan?) then (Ya)
    |#LightGreen|Database|
    :Menghapus produk beserta variannya;
  else (Batal)
    stop
  endif
else (Kelola Varian)
  :Menekan ikon pengaturan pada produk;
  |#LightCyan|Sistem|
  :Membuka modal pengelolaan varian;
  |#LightGreen|Database|
  :Mengambil daftar varian produk;
  |#LightCyan|Sistem|
  :Menampilkan varian yang dikelompokkan per tipe;
  |#LightBlue|Admin|
  if (Aksi varian?) then (Tambah)
    :Memilih tipe dan mengisi nama serta harga tambahan;
    |#LightCyan|Sistem|
    if (Data varian valid?) then (Ya)
    else (Tidak)
      :Menampilkan pesan kesalahan;
      |#LightBlue|Admin|
      :Memperbaiki input;
      |#LightCyan|Sistem|
    endif
    |#LightGreen|Database|
    :Menyimpan varian baru;
  else if (Aksi varian?) then (Edit)
    :Menekan ikon edit varian;
    |#LightCyan|Sistem|
    :Mengisi form dengan data varian;
    |#LightBlue|Admin|
    :Mengubah nama atau harga;
    |#LightCyan|Sistem|
    if (Data valid?) then (Ya)
    else (Tidak)
      :Menampilkan pesan kesalahan;
      |#LightBlue|Admin|
      :Memperbaiki data;
      |#LightCyan|Sistem|
    endif
    |#LightGreen|Database|
    :Memperbarui data varian;
  else (Hapus)
    :Menekan ikon hapus varian;
    |#LightCyan|Sistem|
    :Menampilkan dialog konfirmasi;
    |#LightBlue|Admin|
    if (Mengkonfirmasi?) then (Ya)
      |#LightGreen|Database|
      :Menghapus varian;
    else (Batal)
    endif
  endif
endif

|#LightGreen|Database|
:Mengembalikan data terbaru;

|#LightCyan|Sistem|
:Memperbarui tampilan produk atau varian;

|#LightBlue|Admin|
:Melihat hasil perubahan;
stop
@enduml
```

---

## Bagian 6: Activity Diagram Mengelola Pesanan (Admin)

**Aktor:** Admin | Sistem | Database

**Tujuan:** Menggambarkan alur admin memantau pesanan secara real-time,
melihat detail pesanan, dan memperbarui status pengiriman khusus untuk
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
:Membuka dasbor pesanan;

|#LightGreen|Database|
:Mengambil daftar pesanan terbaru;

|#LightCyan|Sistem|
:Menampilkan ringkasan penjualan;
:Berlangganan pembaruan data pesanan secara real-time;
:Menampilkan daftar pesanan;

|#LightGreen|Database|
fork
  :Pesanan baru masuk;
  |#LightCyan|Sistem|
  :Menambahkan pesanan ke daftar;
fork again
  :Status pesanan berubah;
  |#LightCyan|Sistem|
  :Memperbarui data di tampilan;
fork again
  :Pesanan dihapus;
  |#LightCyan|Sistem|
  :Menghapus pesanan dari tampilan;
end fork

|#LightBlue|Admin|
:Memilih filter dan urutan tampilan;

|#LightCyan|Sistem|
:Menampilkan pesanan sesuai filter;

|#LightBlue|Admin|
:Menekan baris pesanan untuk melihat detail;

|#LightCyan|Sistem|
:Membuka modal detail pesanan;

|#LightBlue|Admin|
if (Status pembayaran lunas?) then (Ya)
  :Membuka menu status pengiriman;
  :Memilih status: Diproses / Siap Diambil / Selesai;
  |#LightGreen|Database|
  :Memperbarui status pesanan;
  |#LightCyan|Sistem|
  :Memperbarui tampilan daftar dan modal;
  note right: Pelanggan melihat\nstatus terbaru di\nhalaman cek pesanan
else (Tidak)
  :Status pengiriman terkunci;
endif

|#LightBlue|Admin|
:Menutup modal;
stop
@enduml
```

---

## Bagian 7: Activity Diagram Menggunakan Rekomendasi Budget (Pelanggan)

**Aktor:** Pelanggan | Sistem

**Tujuan:** Menggambarkan alur pelanggan menggunakan fitur rekomendasi budget
untuk mendapatkan paket menu yang optimal sesuai anggaran. Kalkulasi
dilakukan di sisi klien menggunakan data produk yang telah dimuat.

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
:Membuka halaman utama;

|#LightCyan|Sistem|
:Menampilkan panel Rekomendasi Budget;

|#LightYellow|Pelanggan|
:Menggeser slider atau mengetik nominal budget;

|#LightCyan|Sistem|
if (Budget mencukupi harga produk termurah?) then (Ya)
else (Tidak)
  :Menampilkan pesan budget belum cukup;
  |#LightYellow|Pelanggan|
  :Menaikkan nominal budget;
  |#LightCyan|Sistem|
endif
:Menghitung kombinasi menu yang sesuai budget;
if (Kombinasi tersedia?) then (Ya)
else (Tidak)
  :Menampilkan pesan tidak ada kombinasi yang cocok;
  |#LightYellow|Pelanggan|
  :Menyesuaikan budget;
  |#LightCyan|Sistem|
endif
:Menampilkan maksimal 3 kartu rekomendasi;
note right
  Setiap kartu menampilkan:
  - Daftar item
  - Total harga
  - Efisiensi budget
  - Kembalian
end note

|#LightYellow|Pelanggan|
:Memilih dan menekan kartu rekomendasi;

|#LightCyan|Sistem|
if (Ada produk bervarian dalam paket?) then (Ya)
  :Memasukkan item tanpa varian ke keranjang;
  :Membuka modal pemilihan varian;
  |#LightYellow|Pelanggan|
  :Memilih varian di modal;
  |#LightCyan|Sistem|
  :Menambahkan produk bervarian ke keranjang;
else (Tidak)
  :Memasukkan semua item ke keranjang;
endif
:Membuka panel keranjang belanja;

|#LightYellow|Pelanggan|
:Melihat ringkasan keranjang;
stop
@enduml
```

---

## Bagian 8: Activity Diagram Melihat Detail dan Memilih Varian Produk (Pelanggan)

**Aktor:** Pelanggan | Sistem | Database

**Tujuan:** Menggambarkan alur pelanggan membuka halaman detail produk,
memilih varian yang tersedia, melihat perubahan harga secara dinamis,
dan menambahkan produk ke keranjang.

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
:Menekan kartu produk di katalog;

|#LightCyan|Sistem|
:Membaca ID produk dari URL;

|#LightGreen|Database|
:Mengambil data produk dan varian secara paralel;
:Mengembalikan data produk beserta varian;

|#LightCyan|Sistem|
if (Produk ditemukan dan aktif?) then (Ya)
else (Tidak)
  :Menampilkan pesan produk tidak tersedia;
  stop
endif
:Menampilkan nama, gambar, deskripsi, dan harga dasar;
if (Stok tersedia?) then (Ya)
else (Tidak)
  :Menampilkan keterangan stok habis;
  stop
endif
if (Produk memiliki varian?) then (Ya)
  :Menampilkan pilihan varian per tipe;
  |#LightYellow|Pelanggan|
  :Memilih satu opsi per tipe varian;
  |#LightCyan|Sistem|
  :Menghitung dan memperbarui tampilan harga final;
  if (Semua tipe varian telah dipilih?) then (Ya)
  else (Tidak)
    :Menonaktifkan tombol tambah ke keranjang;
    |#LightYellow|Pelanggan|
    :Melengkapi pilihan varian;
    |#LightCyan|Sistem|
  endif
else (Tidak ada varian)
endif

|#LightYellow|Pelanggan|
:Mengatur jumlah produk;
:Menekan "Tambah ke Keranjang";

|#LightCyan|Sistem|
if (Produk sudah ada di keranjang?) then (Ya)
  :Menambahkan jumlah pada item yang sama;
else (Tidak)
  :Menambahkan item baru ke keranjang;
endif
:Menyimpan perubahan keranjang;
:Menampilkan notifikasi berhasil;

|#LightYellow|Pelanggan|
:Melanjutkan belanja atau membuka keranjang;
stop
@enduml
```

---

## Bagian 9: Activity Diagram Mengelola Keranjang Belanja (Pelanggan)

**Aktor:** Pelanggan | Sistem

**Tujuan:** Menggambarkan alur pelanggan melihat, mengubah jumlah, dan
menghapus item dalam keranjang sebelum melanjutkan ke proses checkout.

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
:Menekan ikon keranjang di header;

|#LightCyan|Sistem|
:Membuka panel keranjang belanja;
if (Keranjang kosong?) then (Ya)
  :Menampilkan keterangan keranjang kosong;
  |#LightYellow|Pelanggan|
  if (Menekan tombol mulai belanja?) then (Ya)
    |#LightCyan|Sistem|
    :Menutup panel keranjang;
    stop
  else (Tidak)
    stop
  endif
else (Tidak)
endif
:Menampilkan daftar item beserta harga dan jumlah;
:Menampilkan total harga keseluruhan;

|#LightYellow|Pelanggan|
if (Memilih aksi?) then (Tambah jumlah)
  |#LightCyan|Sistem|
  :Menambah jumlah item sebesar satu;
  :Memperbarui tampilan;
  |#LightYellow|Pelanggan|
else if (Memilih aksi?) then (Kurangi jumlah)
  |#LightCyan|Sistem|
  :Mengurangi jumlah item sebesar satu;
  if (Jumlah menjadi nol?) then (Ya)
    :Menghapus item dari keranjang;
  else (Tidak)
    :Memperbarui tampilan;
  endif
  |#LightYellow|Pelanggan|
else if (Memilih aksi?) then (Hapus item)
  |#LightCyan|Sistem|
  :Menghapus item dari keranjang;
  :Memperbarui tampilan;
  if (Keranjang menjadi kosong?) then (Ya)
    :Menampilkan keterangan keranjang kosong;
  else (Tidak)
  endif
  |#LightYellow|Pelanggan|
else (Checkout)
  |#LightCyan|Sistem|
  :Menutup panel keranjang;
  :Mengarahkan ke halaman checkout;
  stop
endif
:Melanjutkan interaksi keranjang;
stop
@enduml
```

---

## Bagian 10: Activity Diagram Memproses Webhook Pembayaran (Sistem)

**Aktor:** Midtrans | Server | Database

**Tujuan:** Menggambarkan alur server memproses notifikasi pembayaran dari
Midtrans secara otomatis — mencakup verifikasi keamanan, pemeriksaan
idempotency, validasi nominal, pemetaan status, dan pengembalian stok
apabila pembayaran gagal.

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
:Mengirimkan notifikasi pembayaran ke server;

|#LightGreen|Server|
:Menerima dan mengurai payload JSON;
:Menghitung tanda tangan untuk verifikasi;
if (Tanda tangan cocok?) then (Ya)
else (Tidak)
  :Mencatat kesalahan;
  :Mengembalikan HTTP 200;
  stop
endif

|#LightSkyBlue|Database|
:Mencari pesanan berdasarkan ID Midtrans;

|#LightGreen|Server|
if (Pesanan ditemukan?) then (Ya)
else (Tidak)
  :Mengembalikan HTTP 200;
  stop
endif
if (Status pesanan masih dapat diperbarui?) then (Ya)
else (Tidak - sudah final)
  :Mengabaikan notifikasi;
  stop
endif
:Memvalidasi nominal pembayaran;
if (Nominal sesuai?) then (Ya)
else (Tidak)
  :Mencatat ketidaksesuaian;
  :Mengembalikan HTTP 200;
  stop
endif
:Memetakan status Midtrans ke status lokal;
if (Ada status yang perlu diperbarui?) then (Ya)
else (Tidak)
  :Mengembalikan keterangan tidak ada aksi;
  stop
endif

|#LightSkyBlue|Database|
:Memperbarui status pembayaran pesanan;

|#LightGreen|Server|
if (Pembayaran gagal atau dibatalkan?) then (Ya)
  |#LightSkyBlue|Database|
  :Mengembalikan stok setiap item yang dipesan;
  note right: Stok dikembalikan\nkarena pembayaran batal
else (Tidak - lunas)
  note right: Stok tidak dikembalikan.\nReservasi menjadi permanen.
endif
:Mengembalikan HTTP 200 OK;
stop
@enduml
```

---

## Bagian 11: Activity Diagram Melihat Katalog dan Menyaring Kategori (Pelanggan)

**Aktor:** Pelanggan | Sistem | Database

**Tujuan:** Menggambarkan alur dasar penggunaan sistem — pelanggan membuka
aplikasi, sistem mengambil data produk dari database, dan pelanggan menyaring
tampilan berdasarkan kategori yang dipilih.

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
:Membuka halaman utama;

|#LightCyan|Sistem|
:Mengambil data produk beserta kategori dari database;

|#LightSkyBlue|Database|
:Mengembalikan data produk yang aktif;

|#LightCyan|Sistem|
if (Data sedang dimuat?) then (Ya)
  :Menampilkan animasi skeleton;
else (Tidak)
endif
if (Terjadi kesalahan?) then (Ya)
  :Menampilkan pesan kesalahan;
  stop
else (Tidak)
endif
if (Produk tersedia?) then (Ya)
else (Tidak)
  :Menampilkan keterangan belum ada menu;
  stop
endif
:Menampilkan katalog produk dalam bentuk grid;
:Membuat daftar kategori unik;
:Menampilkan tombol-tombol filter kategori;

|#LightYellow|Pelanggan|
:Memilih kategori;

|#LightCyan|Sistem|
:Menyaring produk berdasarkan kategori yang dipilih;
if (Hasil penyaringan kosong?) then (Ya)
  :Menampilkan keterangan tidak ada menu di kategori ini;
else (Tidak)
  :Menampilkan produk hasil penyaringan;
endif

|#LightYellow|Pelanggan|
:Menelusuri produk;
stop
@enduml
```
