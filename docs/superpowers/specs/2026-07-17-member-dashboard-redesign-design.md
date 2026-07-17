# Member Dashboard Redesign

## Tujuan

Mengubah area member menjadi dashboard marketplace yang konsisten dengan referensi pengguna dan storefront AsistenQ, dengan navigasi yang lebih ringkas.

## Desain

- Sidebar: Dashboard, Produk Saya, Lisensi, Pesanan, Profil, Bantuan, Affiliate (Coming Soon), dan Logout.
- Dashboard utama: hero sambutan hijau, metrik produk/lisensi/pesanan/course, lalu produk yang dimiliki atau dapat diakses.
- Download dan course tidak menjadi menu terpisah; aksesnya muncul di kartu Produk Saya.
- Affiliate tidak membuka fitur transaksi dan hanya menampilkan halaman Coming Soon.
- Tampilan responsif: sidebar berubah menjadi menu horizontal pada tablet/mobile dan kartu turun menjadi satu kolom.

## Data dan Perilaku

Data tetap memakai session, lisensi, subscription, order, dan katalog yang sudah tersedia. Tidak ada perubahan database atau API. Menu lama Lisensi, Pesanan, Course, Bantuan, serta checkout tetap dipertahankan melalui layout baru.

## Verifikasi

TypeScript/build harus lulus, halaman member login tetap berfungsi, dan dashboard tidak overflow pada viewport desktop maupun mobile.
