# Desain Pesanan Member Empat Kolom

## Tujuan

Menghilangkan ruang kosong besar pada kartu pesanan dengan membagi informasi menjadi empat kolom yang seimbang dan mudah dipindai.

## Struktur Desktop

1. **Invoice:** badge status dan nomor invoice.
2. **Detail produk:** nama produk, tanggal transaksi, dan sisa waktu pembayaran.
3. **Pembayaran:** total bayar dan kode unik dua digit.
4. **Aksi:** tombol QRIS dan Invoice.

Kolom menggunakan grid proporsional `1.05fr 1.35fr .8fr auto`. Informasi tidak diratakan ke dua ujung kartu; kolom kedua dan ketiga mengisi area tengah.

## Responsif

- Lebar di atas 900 px: empat kolom satu baris.
- Lebar 641-900 px: grid 2x2; aksi tetap berdampingan.
- Lebar sampai 640 px: satu kolom; pembayaran rata kiri dan kedua tombol memenuhi lebar.
- Form HWID pascapembayaran tetap berada pada baris penuh di bawah empat kolom.

## Pengujian

- Tes kontrak source memastikan empat blok semantik tersedia.
- Tes CSS memastikan grid empat kolom dan breakpoint tablet/mobile.
- Production build harus lulus.
- Verifikasi visual dilakukan pada halaman Pesanan member live.
