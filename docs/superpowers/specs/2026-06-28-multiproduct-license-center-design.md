# AsistenQ Multi-Product License Center Design

## Ringkasan
AsistenQ akan menjadi platform payung untuk produk digital, tools, lisensi software, course online/offline, ebook, video, bundle, dan free resources. Sistem harus dari awal mendukung banyak produk agar produk baru dapat ditambahkan lewat admin tanpa merombak backend atau frontend.

VJ Studio menjadi produk contoh pertama untuk validasi end-to-end karena sudah memiliki sistem lisensi Python, generator HTML, activation server, paket, voucher, banned HWID, announcement, dan Telegram bot.

## Tujuan
- Membuat fondasi multi-produk yang tidak terkunci pada VJ Studio.
- Membuat homepage publik `asistenq.com` yang menampilkan layanan berbayar dan gratis.
- Mengadopsi logic lisensi lama VJ Studio ke backend AsistenQ.
- Menyediakan License Center di admin untuk generate, reset, ban, unban, dan pantau lisensi.
- Menyiapkan endpoint aktivasi yang bisa dipakai tools desktop.
- Menyiapkan jalur migrasi Telegram bot agar bisa memantau order dan aktivasi lisensi.

## Ruang Lingkup Tahap Ini
### In Scope
- Model produk multi-type.
- Model plan/paket per produk.
- Homepage publik sederhana.
- Katalog produk publik.
- Produk contoh VJ Studio.
- Produk contoh kursus YouTube/e-learning.
- Produk free resource contoh.
- License Center admin untuk VJ Studio sebagai implementasi pertama.
- API lisensi berbasis `productSlug`.
- Migrasi logic key generator dari Python ke TypeScript.
- Data paket lisensi VJ Studio: trial, 1 bulan, 2 bulan, 3 bulan, 6 bulan, 1 tahun, lifetime.
- Voucher validation.
- Announcement/marquee per produk.
- Banned HWID per produk.
- Reset HWID/device.

### Out of Scope
- Payment gateway QRIS otomatis penuh.
- Video streaming DRM.
- Upload materi course lengkap.
- Telegram bot penuh dengan semua command lama.
- Migrasi semua tools sekaligus.
- Database production final seperti PostgreSQL/MySQL.

## Tipe Produk
Produk AsistenQ menggunakan tipe berikut:
- `tool`: software atau tools yang bisa memakai lisensi.
- `course`: kelas online/offline.
- `ebook`: file ebook.
- `video`: video tutorial mandiri.
- `bundle`: gabungan beberapa produk.
- `free`: resource gratis.

Setiap produk memiliki:
- `id`
- `slug`
- `name`
- `type`
- `category`
- `visibility`: public, private, draft
- `description`
- `headline`
- `coverUrl`
- `featured`
- `createdAt`
- `updatedAt`

## Plan/Paket
Plan terpisah dari produk agar satu produk bisa punya banyak pilihan harga.

Setiap plan memiliki:
- `id`
- `productId`
- `code`
- `name`
- `price`
- `billingPeriod`: trial, monthly, annual, lifetime, one_time
- `durationDays`
- `isFree`
- `isActive`

Contoh VJ Studio:
- `TRIAL`: Trial 1 Hari, free, 1 hari.
- `1M`: 1 Bulan, Rp49.900, 30 hari.
- `2M`: 2 Bulan, Rp85.900, 60 hari.
- `3M`: 3 Bulan, Rp129.900, 90 hari.
- `6M`: 6 Bulan, Rp225.900, 180 hari.
- `1Y`: 1 Tahun, Rp399.000, 365 hari.
- `LIFETIME`: Lifetime, Rp799.000.

Contoh course YouTube:
- `YOUTUBE_ONLINE_YEARLY`: Kelas Online Tahunan.
- `YOUTUBE_OFFLINE`: Paket Offline.
- `YOUTUBE_BUNDLE`: Online + tools pendukung.
- `YOUTUBE_PREVIEW`: Free preview.

## Homepage Publik
Homepage tidak menjadi dashboard admin. Homepage adalah storefront sederhana.

Bagian utama:
- Brand AsistenQ.
- Headline singkat: tools dan kelas untuk mempercepat pekerjaan digital.
- Produk unggulan.
- Layanan berbayar.
- Free resources.
- Kategori: Tools, Course, E-learning, Template/Free.
- Card produk dengan badge `Free`, `Paid`, `Tool`, `Course`.

Tujuan homepage:
- Pengunjung langsung paham AsistenQ menjual tools dan kelas.
- Produk baru bisa tampil otomatis dari data produk.
- VJ Studio tampil sebagai produk tools pertama.
- Kursus YouTube tampil sebagai produk course/e-learning pertama.

## License Center Admin
License Center menjadi pengganti bertahap dari `generator_lisensi.html`.

Fitur awal:
- Pilih produk tools.
- Pilih plan lisensi.
- Input email member.
- Input HWID.
- Generate key.
- Lihat daftar lisensi.
- Cari lisensi berdasarkan email atau HWID.
- Reset device/HWID.
- Ban/unban HWID.
- Tandai activated/manual.
- Hapus atau suspend lisensi.

Status lisensi:
- `generated`
- `active`
- `expired`
- `suspended`
- `banned`

## License Key Logic
Logic lama dari `generate_license.py` dipertahankan secara kompatibel untuk VJ Studio:

```text
key = EXPIRY-SIGNATURE
signature = SHA256(HWID + EXPIRY + SECRET_SALT).slice(0, 16).toUpperCase()
```

Perubahan:
- `SECRET_SALT` tidak hardcoded.
- Salt disimpan sebagai environment variable.
- Key generator menerima `productSlug` agar produk lain bisa punya salt/rule sendiri.

Environment:
- `LICENSE_SECRET_SALT`

Tahap ini menggunakan satu global salt. Struktur API tetap membawa `productSlug` agar perubahan ke salt per produk tidak mengubah kontrak tools desktop.

## API Lisensi
Endpoint kompatibel untuk tools desktop:

```text
GET /api/license/packages?product=vjstudio
GET /api/license/announcement?product=vjstudio
GET /api/license/banned?product=vjstudio
GET /api/license/verify-voucher?product=vjstudio&code=...
POST /api/license/generate
POST /api/license/activate
POST /api/license/verify
POST /api/license/reset-device
POST /api/license/ban
POST /api/license/unban
```

Payload aktivasi:

```json
{
  "productSlug": "vjstudio",
  "token": "20260728-ABCDEF1234567890",
  "hwid": "DEVICE-HWID"
}
```

Response sukses:

```json
{
  "status": "success",
  "message": "Activated"
}
```

## Voucher
Voucher berlaku per produk atau global.

Field voucher:
- `code`
- `productId`
- `discountType`: amount, percent
- `discountValue`
- `expiresAt`
- `maxUse`
- `usedCount`
- `active`

## Announcement/Marquee
Announcement dipisah per produk.

Field:
- `productId`
- `text`
- `maxPlays`
- `delayMinutes`
- `enabled`

## Telegram Integration
Telegram tidak langsung dimigrasikan penuh di tahap pertama. Tahap awal hanya menyiapkan pondasi.

Target integrasi berikutnya:
- Notifikasi order baru.
- Notifikasi aktivasi lisensi.
- Command generate trial.
- Command reset device.
- Command ban/unban HWID.
- Command list lisensi.

Token Telegram wajib di environment:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_OWNER_ID`

Token lama yang hardcoded harus direvoke.

## Data Lama yang Diadopsi
Dari `E:\FIX TOOLS YT\VJSTUDIO`:
- `generate_license.py`: logic generate key.
- `activation_server.py`: endpoint aktivasi dan sync behavior.
- `license_bot.py`: daftar fitur Telegram/admin workflow.
- `generator_lisensi.html`: referensi UX License Center.
- `vjstudio-license/packages.json`: seed paket VJ Studio.
- `vjstudio-license/announcement.json`: seed announcement.
- `vjstudio-license/banned.txt`: seed banned HWID.
- `vjstudio-license/licenses.json`: seed lisensi awal bila ada data.
- `vjstudio-license/vouchers.json`: seed voucher.

## Keamanan
- Token Telegram dan GitHub tidak boleh berada di source code.
- GitHub token lama harus direvoke.
- Admin endpoint wajib butuh session admin.
- License generate/reset/ban/unban hanya admin.
- Endpoint aktivasi publik hanya boleh melakukan aktivasi/verify terbatas.
- Input HWID dinormalisasi uppercase.
- Product slug wajib divalidasi.

## Testing
Test minimal:
- Generate key kompatibel dengan Python untuk HWID dan durasi yang sama.
- Plan VJ Studio seeded dengan benar.
- Endpoint packages memfilter berdasarkan produk.
- Activation sukses untuk token dan HWID yang valid.
- Activation gagal untuk token/HWID invalid.
- Voucher valid/invalid.
- Ban HWID mencegah aktivasi/verify.
- Reset device memindahkan lisensi ke HWID baru.
- Homepage menampilkan produk paid dan free.

## Urutan Implementasi
1. Tambahkan model product/plan/license/voucher/announcement/banned HWID yang multi-produk.
2. Seed produk VJ Studio, kursus YouTube, dan free resource.
3. Buat homepage publik sederhana berbasis katalog.
4. Migrasi key generator Python ke TypeScript.
5. Tambahkan API license packages, announcement, banned, voucher.
6. Tambahkan generate/activate/verify/reset/ban/unban.
7. Buat License Center admin.
8. Tambahkan dokumentasi migrasi Telegram dan env secret.

## Kriteria Sukses Tahap Ini
- `asistenq.com` menampilkan homepage publik, bukan langsung admin panel.
- Admin bisa masuk ke License Center.
- Admin bisa generate lisensi VJ Studio.
- Tools desktop dapat memanggil endpoint aktivasi berbasis `productSlug`.
- Sistem data sudah multi-produk.
- Produk baru bisa ditambah tanpa merombak struktur inti.
