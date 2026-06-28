# Deploy AsistenQ ke JagoanHosting

## Status DNS
- Domain: `asistenq.com`
- Nameserver:
  - `best.jagoanhosting.com`
  - `one.jagoanhosting.com`
  - `great.jagoanhosting.com`
- A record publik saat dicek: `101.50.1.82`

## Build Lokal
Jalankan dari folder project:

```bash
npm install
npm run build
```

## Environment Production
Atur environment di panel Node.js hosting:

```env
NODE_ENV=production
APP_NAME=AsistenQ
APP_URL=https://asistenq.com
API_PORT=4000
SESSION_SECRET=isi-random-panjang
ADMIN_EMAIL=effands@gmail.com
ADMIN_PASSWORD=aszxaszx
QRIS_PROVIDER=
QRIS_MERCHANT_ID=
QRIS_API_KEY=
```

Ganti `SESSION_SECRET` dengan teks acak panjang sebelum production aktif.

## Node.js App
Jika panel hosting menyediakan fitur Node.js app:

- Application root: folder project AsistenQ
- Startup file: `server-dist/index.js`
- Build command: `npm run build`
- Start command: `npm start`

## Urutan Deploy
1. Pastikan nameserver domain sudah mengarah ke JagoanHosting.
2. Upload isi project atau pull dari GitHub `effands/asistenq`.
3. Jalankan `npm install`.
4. Jalankan `npm run build`.
5. Set environment production.
6. Start Node.js app.
7. Aktifkan SSL untuk `asistenq.com`.
8. Tes halaman utama, admin internal, dan API health.

## URL Tes
- Website: `https://asistenq.com`
- Admin internal: `https://asistenq.com/adminasistenq`
- Health check: `https://asistenq.com/api/health`
