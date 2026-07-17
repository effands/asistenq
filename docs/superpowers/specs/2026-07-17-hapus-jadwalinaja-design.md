# Desain Penghapusan Total JadwalinAja

## Tujuan

Menghapus seluruh implementasi JadwalinAja dari repository AsistenQ karena produk penggantinya sudah dipindahkan ke subdomain lain. Tidak ada redirect dari URL lama; URL dan API lama harus tidak tersedia.

## Ruang Lingkup

- Hapus produk seed dengan slug `jadwalinaja`.
- Hapus seluruh endpoint backend di bawah `/tools/jadwalinaja/api/*`.
- Hapus build statis `tools-dist/jadwalinaja/`.
- Hapus source lokal `youtube-jadwalin-app/`.
- Hapus arsip `youtube-jadwalin.zip` dan `youtube-jadwalin-deploy.zip`.
- Bersihkan produk historis dengan slug `jadwalinaja` dari database saat proses seed/startup berjalan.
- Pertahankan penolakan URL lama agar `/jadwalinaja`, turunannya, `/tools/jadwalinaja`, dan turunannya mengembalikan 404.

## Batasan

- Jangan menghapus YouTube Starter Kit.
- Jangan menghapus integrasi YouTube atau Gemini lain yang tidak berada pada namespace JadwalinAja.
- Jangan mengubah produk, course, atau tool lain.
- Jangan mengubah file ZIP atau folder lain milik pengguna yang tidak terkait JadwalinAja.

## Perilaku Startup

Seed harus menghapus produk tersimpan yang memiliki slug `jadwalinaja` beserta referensi operasional yang secara langsung menunjuk ke ID produk tersebut. Penghapusan harus idempoten: startup berikutnya tidak gagal ketika produk sudah tidak ada.

Data akun member tidak dihapus. Order, subscription, plan, lisensi, announcement, voucher, banned HWID, dan analytics yang secara langsung terkait produk JadwalinAja dibersihkan agar tidak meninggalkan foreign reference yatim.

## Verifikasi

- Tes gagal terlebih dahulu ketika produk dan route JadwalinAja masih ada.
- Tes seed membuktikan produk historis dan semua referensi langsungnya dibersihkan.
- Pencarian case-insensitive pada kode aktif tidak menemukan `jadwalinaja` atau `youtube-jadwalin`, kecuali daftar route yang sengaja dipensiunkan dan tes yang memvalidasi penghapusan.
- Folder build, source, dan dua ZIP tidak ada.
- Seluruh test suite, typecheck, dan build produksi lulus.
- Perubahan lokal lain milik pengguna tetap dipertahankan.

## Kriteria Penerimaan

- JadwalinAja tidak muncul di katalog, admin, member, seed, atau filesystem aplikasi.
- Endpoint JadwalinAja tidak tersedia.
- URL lama mengembalikan 404 dan tidak jatuh ke SPA AsistenQ.
- Data historis JadwalinAja dibersihkan secara idempoten.
- Fitur YouTube lain tetap tersedia dan build AsistenQ tetap berhasil.
