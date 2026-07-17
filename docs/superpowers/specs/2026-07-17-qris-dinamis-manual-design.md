# Desain QRIS Dinamis dengan Verifikasi Manual

## Tujuan

Mengganti alur pembayaran DANA API/sandbox di AsistenQ dengan QRIS dinamis yang dibentuk dari QRIS statis merchant ZIQVA. Nominal pada QR harus sama dengan harga produk ditambah kode unik tiga digit, sementara konfirmasi pembayaran tetap dilakukan manual oleh admin.

## Batas Perubahan

- Menghapus integrasi aplikasi dengan DANA: konfigurasi sandbox, endpoint callback dan redirect, tipe data khusus provider DANA, pengaturan UI DANA, serta pengujian yang hanya menguji integrasi DANA.
- Mempertahankan identitas `ID.DANA.WWW` yang sudah menjadi bagian resmi payload QRIS merchant ZIQVA. Bagian tersebut tidak diedit atau dihapus.
- Tidak menghapus order historis. Properti lama terkait DANA yang sudah tersimpan boleh tetap berada dalam data produksi, tetapi aplikasi tidak lagi membaca atau menulisnya.
- Tidak menambahkan payment gateway, webhook bank, rekonsiliasi otomatis, atau penyimpanan gambar QR permanen.

## Sumber QRIS dan Pengaturan Admin

Payload QRIS statis disimpan dalam pengaturan pembayaran yang hanya dapat dibaca dan diubah melalui area admin yang sudah terautentikasi. Nilai awalnya berasal dari QRIS merchant ZIQVA yang diberikan pengguna:

```text
00020101021126570011ID.DANA.WWW011893600915303265462802090326546280303UMI51440014ID.CO.QRIS.WWW0215ID10265329452210303UMI5204504553033605802ID5905ZIQVA6011Kab. Malang6105651676304F3F6
```

Form admin menyediakan aksi simpan dan validasi. Server menolak payload kosong, payload tanpa struktur merchant QRIS yang diperlukan, payload yang bukan QRIS statis (`010211`), serta payload dengan CRC yang tidak valid. Respons API tidak boleh membocorkan konfigurasi lain atau kredensial server.

## Generator QRIS Dinamis

Generator ditempatkan sebagai modul backend terpisah dengan tanggung jawab tunggal:

1. Memvalidasi payload QRIS statis dan CRC16/CCITT-FALSE-nya.
2. Mengubah indikator point of initiation method dari statis `010211` menjadi dinamis `010212`.
3. Menyisipkan tag nominal `54` sebelum tag negara `5802ID`.
4. Memakai nominal dalam rupiah sebagai bilangan bulat positif tanpa pemisah ribuan atau desimal.
5. Menghitung ulang tag CRC `6304` dan nilai CRC16 untuk payload akhir.
6. Menghasilkan gambar QR sebagai data URL pada backend.

Generator harus menolak nominal nol, negatif, bukan bilangan bulat, payload tanpa `5802ID`, dan payload yang sudah memiliki susunan tag nominal yang ambigu. Kegagalan generator tidak boleh menghasilkan order setengah jadi.

## Alur Checkout User

1. Member memilih produk dan membuat checkout.
2. Server memilih kode unik acak tiga digit pada rentang 100–999.
3. Server menghitung `totalAmount = amount + uniqueCode`.
4. Server membentuk payload QRIS dinamis menggunakan `totalAmount`.
5. Server menghasilkan gambar QR sebagai data URL.
6. Hanya setelah seluruh proses berhasil, order disimpan dengan status `pending`, payload QRIS dinamis, gambar QR, waktu pembuatan, dan waktu kedaluwarsa.
7. Modal dan invoice user menampilkan harga, kode unik, total, QR dinamis, status, sisa waktu, dan tombol konfirmasi Telegram.

Kode unik tetap tiga digit. Sistem tidak menjanjikan bahwa kode unik selalu berbeda secara global; invoice, member, nominal, bukti pembayaran, dan waktu transaksi digunakan bersama oleh admin saat melakukan verifikasi manual.

## Verifikasi Manual Admin

Daftar order admin menampilkan informasi pembayaran yang sudah ada dan menyediakan aksi `Verifikasi Dibayar` hanya untuk order berstatus `pending` yang belum kedaluwarsa. Sebelum perubahan status, UI meminta konfirmasi yang menyebut nomor invoice dan total pembayaran.

Endpoint admin yang terautentikasi memanggil mekanisme domain pembayaran yang sudah ada untuk:

- mengubah order menjadi `paid`;
- mencatat waktu pembayaran;
- mengaktifkan subscription atau akses produk yang sesuai;
- mempertahankan sifat idempoten agar invoice yang sudah dibayar tidak mengaktifkan akses dua kali.

Order `paid`, `expired`, atau status lain tidak menampilkan aksi verifikasi. Kesalahan ditampilkan di panel admin tanpa mengubah status lokal secara optimistis.

## Model Data dan Kompatibilitas

Pengaturan pembayaran memperoleh field generik untuk payload QRIS statis. Order tetap memakai field generik `qrisPayload`, `paymentQrUrl`, `amount`, `uniqueCode`, dan `totalAmount`.

Field TypeScript yang hanya mendukung DANA dihapus dari model aktif. Parser penyimpanan tetap toleran terhadap properti tambahan pada order historis sehingga deployment tidak memerlukan migrasi destruktif.

## Penghapusan DANA

Perubahan mencakup penghapusan:

- handler callback dan redirect DANA;
- service pemrosesan notifikasi DANA;
- schema, tipe, dan cabang provider yang khusus DANA;
- pengaturan dan teks UI DANA sandbox;
- environment variable yang hanya digunakan integrasi DANA;
- tes yang hanya memvalidasi callback atau metadata DANA.

Pencarian akhir case-insensitive untuk istilah DANA harus hanya menemukan string tersebut di payload QRIS merchant, dokumentasi historis yang sengaja dipertahankan, atau data historis di luar kode aktif.

## Penanganan Kesalahan

- Admin tidak dapat menyimpan payload QRIS yang tidak valid.
- Checkout berbayar gagal dengan pesan yang jelas bila QRIS statis belum dikonfigurasi atau tidak valid.
- Produk gratis tidak memerlukan generator QRIS dan mempertahankan alur akses gratis yang sudah ada.
- Order tidak disimpan apabila pembuatan payload atau gambar QR gagal.
- Verifikasi manual yang tidak sah, kedaluwarsa, atau berulang mengembalikan respons yang sesuai tanpa menggandakan subscription.

## Strategi Pengujian

Implementasi mengikuti TDD dengan pengujian berikut:

- payload QRIS ZIQVA lolos validasi sebagai QRIS statis;
- konversi menghasilkan indikator dinamis, tag nominal yang tepat, dan CRC valid;
- nominal berbeda menghasilkan payload dan gambar QR berbeda;
- payload rusak, CRC salah, struktur tanpa `5802ID`, dan nominal tidak valid ditolak;
- checkout berbayar menghasilkan kode unik 100–999 dan QR untuk `totalAmount`;
- kegagalan generator tidak menyimpan order;
- produk gratis tetap dapat diproses tanpa konfigurasi QRIS;
- API pengaturan admin menyimpan payload valid dan menolak payload invalid;
- endpoint verifikasi admin mengubah order pending menjadi paid dan tetap idempoten;
- rute, tipe aktif, konfigurasi, dan pengujian khusus DANA sudah tidak ada;
- seluruh test suite, pemeriksaan TypeScript, dan build produksi berhasil.

## Kriteria Penerimaan

- Admin dapat memasukkan dan menyimpan QRIS statis ZIQVA melalui UI.
- Setiap invoice berbayar menampilkan QR yang otomatis membawa nominal harga ditambah kode unik tiga digit.
- QR hasil generator dapat dipindai oleh aplikasi pembayaran QRIS tanpa mengetik nominal manual.
- User tetap mengirim bukti pembayaran melalui Telegram.
- Admin dapat memverifikasi invoice secara manual dari daftar transaksi.
- Tidak ada lagi integrasi API, sandbox, callback, redirect, atau UI khusus DANA dalam kode aktif.
- Data order lama tetap dapat dimuat tanpa migrasi destruktif.
