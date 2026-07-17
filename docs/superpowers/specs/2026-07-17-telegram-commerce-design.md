# Telegram Commerce untuk AsistenQ

Tanggal: 2026-07-17
Status: Disetujui secara konseptual

## Tujuan

Memperluas satu bot Telegram AsistenQ agar melayani dua peran: owner sebagai admin operasional dan pengguna umum sebagai pembeli. Produk, paket harga, order, pembayaran QRIS, lisensi, dan download tetap memakai backend AsistenQ sebagai sumber data tunggal sehingga panel web dan Telegram selalu sinkron.

## Ruang Lingkup

Fitur mencakup:

- katalog produk Telegram untuk pengguna umum;
- pendaftaran pembeli dengan nama, email, WhatsApp, dan Telegram ID;
- checkout paket produk dengan QRIS dinamis dan kode unik tiga digit;
- invoice yang berlaku selama 30 menit;
- unggah bukti pembayaran melalui Telegram;
- verifikasi atau penolakan manual oleh owner;
- pemenuhan produk lisensi melalui pengumpulan HWID setelah pembayaran;
- pemenuhan produk digital melalui link download bertoken;
- tambah dan edit produk serta paket harga melalui bot owner;
- sinkronisasi penuh dengan produk dan order di panel admin web.

Course dan verifikasi pembayaran otomatis di luar ruang lingkup versi ini.

## Arsitektur

Backend TypeScript AsistenQ menjadi satu-satunya pemilik aturan bisnis dan data. Bot Python hanya:

- menentukan tampilan menu berdasarkan Telegram ID;
- mengelola langkah percakapan sementara;
- mengirim input ke API backend;
- merender respons backend menjadi tombol, teks ringkas, QRIS, dan notifikasi.

Bot tidak menghitung harga, kode unik, masa aktif, atau hak akses secara mandiri. Seluruh nilai tersebut diperoleh dari backend. Ini mencegah perbedaan data antara panel web dan Telegram.

## Peran dan Otorisasi

### Owner

Telegram ID yang sama dengan `telegramOwnerId` mendapatkan menu admin:

- Order Pending
- Verifikasi Pembayaran
- Tambah Produk
- Edit Produk dan Harga
- Generate Lisensi
- Ban atau Unban HWID
- Voucher
- Status
- Update Website

Semua aksi admin membutuhkan bot secret pada komunikasi bot-ke-backend. Backend tetap memeriksa hak admin dan tidak mempercayai callback data dari Telegram tanpa validasi.

### Pembeli

Telegram ID selain owner mendapatkan menu pembeli:

- Lihat Produk
- Transaksi Saya
- Bayar Invoice
- Kirim Bukti Bayar
- Lisensi Saya
- Download Saya
- Bantuan

Pembeli hanya dapat mengakses member, order, lisensi, bukti pembayaran, dan download yang terhubung ke Telegram ID miliknya. Penggantian email tidak boleh mengambil alih member yang telah terhubung ke Telegram ID lain.

## Model Data

Model yang sudah ada tetap digunakan untuk produk, paket, member, order, lisensi, subscription, dan deployment settings. Penambahan yang diperlukan:

- `MemberAccount.telegramId` menjadi identitas penghubung bot;
- order menyimpan Telegram ID pembeli atau referensi member yang tidak dapat berubah;
- order menyimpan `paymentProofFileId`, waktu unggah, status review, alasan penolakan, dan reviewer;
- produk memiliki `fulfillmentType`: `license` atau `download`;
- produk digital menyimpan referensi file atau URL sumber secara privat;
- hak download menyimpan token acak, order, member, batas kedaluwarsa, batas jumlah unduhan, dan jumlah penggunaan;
- state percakapan bot menyimpan langkah wizard per chat dan harus memiliki masa kedaluwarsa.

Token bot, bot secret, sumber file digital privat, dan token download tidak pernah dikirim dalam endpoint katalog publik.

## Alur Pembeli

### Registrasi atau Pengaitan Member

Saat checkout pertama, bot meminta nama, email, dan WhatsApp. Backend mencari member berdasarkan Telegram ID. Jika tidak ditemukan, backend dapat mengaitkan member berdasarkan email hanya jika email tersebut belum terhubung ke Telegram ID lain; jika tidak ada member, backend membuat member baru.

### Katalog dan Checkout

1. Pembeli membuka `Lihat Produk`.
2. Backend hanya mengembalikan produk aktif dengan paket aktif.
3. Pembeli memilih produk dan paket melalui callback button.
4. Backend membaca harga paket saat request checkout diterima.
5. Backend membuat kode unik tiga digit dan total pembayaran.
6. Backend menghasilkan payload serta gambar QRIS dinamis dari QRIS statis yang tersimpan.
7. Backend menyimpan order pending dengan batas 30 menit.
8. Bot mengirim invoice, rincian harga, kode unik, total, gambar QRIS, dan waktu kedaluwarsa.

Satu pembeli hanya boleh memiliki satu invoice pending yang belum kedaluwarsa untuk pasangan produk dan paket yang sama. Request berulang mengembalikan invoice aktif tersebut dan tidak membuat nominal baru.

### Bukti dan Verifikasi Pembayaran

1. Pembeli memilih invoice lalu mengunggah foto bukti pembayaran.
2. Bot menyimpan Telegram `file_id` melalui backend, bukan mengunduh foto tanpa kebutuhan.
3. Owner menerima foto, invoice, pembeli, total unik, dan tombol Verifikasi, Tolak, serta Detail.
4. Verifikasi mengubah order menjadi paid secara idempoten.
5. Penolakan membutuhkan alasan dan memungkinkan pembeli mengunggah bukti pengganti selama invoice belum kedaluwarsa atau telah dibuka kembali owner.

Order kedaluwarsa tidak dapat diverifikasi dari tombol lama. Owner dapat membuka kembali order secara eksplisit dan backend membuat batas waktu review baru tanpa mengubah histori.

## Pemenuhan Produk

### Lisensi Software

Setelah order paid, bot meminta HWID 16 karakter alfanumerik. Backend memvalidasi produk, paket, order, member, serta HWID sebelum membuat lisensi. Operasi bersifat idempoten: pengiriman ulang tidak membuat lisensi kedua untuk order yang sama. Token dikirim melalui Telegram dan email, lalu tersedia di `Lisensi Saya`.

Owner tetap dapat memilih `Generate Lisensi`, lalu memilih produk, paket, email, dan HWID. Pembuatan manual dicatat dalam audit log dan tidak berpura-pura sebagai transaksi berbayar.

### Produk Digital

Setelah order paid, backend menerbitkan hak download milik member. Bot mengirim link HTTPS bertoken. Token default berlaku 24 jam dan maksimal tiga unduhan. Owner dapat menerbitkan ulang token tanpa menggandakan order. Endpoint download memeriksa token, masa berlaku, batas penggunaan, status paid, dan pemilik hak.

## Pengelolaan Produk oleh Owner

Wizard `Tambah Produk` meminta:

1. nama;
2. slug yang dihasilkan otomatis dan dapat diedit;
3. jenis pemenuhan: lisensi atau download;
4. deskripsi singkat;
5. satu atau lebih paket yang berisi kode, nama, harga, durasi hari atau lifetime;
6. file atau URL privat untuk produk download;
7. status draft atau aktif;
8. konfirmasi ringkasan.

`Edit Produk dan Harga` memungkinkan perubahan metadata, penambahan paket, perubahan harga, dan penonaktifan paket atau produk. Bot tidak menyediakan penghapusan permanen. Riwayat order selalu mempertahankan nama produk, paket, harga dasar, kode unik, dan total pada waktu transaksi.

## API Backend

API bot dipisahkan menurut tujuan:

- endpoint katalog dan checkout pembeli menerima identitas chat dari proses bot yang telah diautentikasi dengan bot secret;
- endpoint transaksi pembeli selalu memerlukan Telegram ID dan memeriksa kepemilikan;
- endpoint produk, verifikasi pembayaran, dan generate lisensi hanya menerima owner;
- endpoint webhook tidak diperlukan selama bot masih menggunakan polling;
- setiap mutasi penting memiliki idempotency key yang diturunkan dari update ID Telegram atau identitas order.

Payload callback hanya membawa ID pendek. Backend membaca ulang produk, paket, harga, order, dan status dari store sebelum melakukan mutasi.

## Penanganan Kegagalan

- QRIS statis kosong atau tidak valid: checkout ditolak dan order tidak disimpan.
- Invoice kedaluwarsa: pembeli ditawarkan invoice baru.
- Bukti pembayaran ditolak: alasan dikirim ke pembeli.
- Foto tidak valid: bot meminta format foto ulang.
- HWID tidak valid: state tetap menunggu HWID yang benar.
- Generate atau pengiriman lisensi gagal: order tetap paid dan owner mendapat aksi Kirim Ulang.
- Pengiriman email gagal: hasil lisensi tetap tersedia di Telegram dan kegagalan dicatat.
- File digital hilang: token tidak diterbitkan dan owner mendapat peringatan.
- Callback lama atau ganda: backend mengembalikan hasil mutasi sebelumnya secara aman.
- Bot restart: state wizard dipulihkan dari file state; state kedaluwarsa dibersihkan.

## Audit dan Keamanan

Audit log mencatat pembuatan atau perubahan produk, perubahan harga, checkout, unggah bukti, verifikasi, penolakan, pembukaan kembali invoice, generate lisensi, penerbitan ulang download, dan kegagalan pemenuhan.

Pesan error ke pembeli tidak boleh mengandung bot token, bot secret, path server, stack trace, sumber file privat, atau detail QRIS statis. Tombol admin tidak cukup sebagai pengamanan; backend selalu memverifikasi owner.

## Pengujian dan Kriteria Penerimaan

- Owner menerima menu admin dan pembeli menerima menu toko.
- Pembeli tidak dapat memanggil aksi admin dengan callback buatan.
- Registrasi nama, email, WhatsApp, dan Telegram ID bersifat idempoten.
- Produk dan paket yang dibuat melalui bot terlihat di panel web.
- Perubahan harga hanya berlaku untuk order baru.
- Checkout menghasilkan QRIS dinamis dengan kode unik tiga digit dan masa berlaku 30 menit.
- Checkout berulang untuk produk dan paket yang sama mengembalikan invoice aktif.
- Bukti pembayaran hanya dapat dikirim untuk order milik pembeli.
- Owner dapat memverifikasi atau menolak bukti secara idempoten.
- Produk lisensi meminta HWID setelah paid dan menghasilkan satu lisensi per order.
- Produk digital menerbitkan token download yang aman, terbatas waktu, dan terbatas penggunaan.
- Order, lisensi, dan download pengguna lain tidak dapat diakses.
- Kegagalan email atau Telegram tidak menghilangkan status paid.
- Tes Python bot, tes backend, lint, dan build lulus sebelum deployment.

## Urutan Implementasi

Implementasi dibagi agar risiko terkontrol:

1. API identitas pembeli, katalog, dan transaksi milik pengguna;
2. menu role-based dan registrasi bot;
3. checkout QRIS serta invoice 30 menit;
4. bukti pembayaran dan review owner;
5. pemenuhan lisensi setelah HWID;
6. hak download produk digital;
7. wizard produk dan paket owner;
8. audit, pengujian keamanan, dan deployment produksi.
