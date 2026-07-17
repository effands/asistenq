# QRIS Dinamis Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti integrasi DANA dengan QRIS dinamis dari payload statis ZIQVA, kode unik tiga digit, dan verifikasi pembayaran manual oleh admin.

**Architecture:** Logika EMV QRIS dan pembuatan gambar ditempatkan di modul backend murni `src/server/qris.ts`. Payload statis disimpan pada `deploymentSettings.qrisStaticPayload`, checkout membentuk QR dinamis sebelum order disimpan, dan endpoint manual-paid yang sudah ada dipakai oleh UI admin. Field serta rute khusus DANA dihapus tanpa migrasi destruktif terhadap JSON historis.

**Tech Stack:** TypeScript, Express, React, Zod, Vitest, `qrcode`, npm.

---

## Struktur File

- Create `src/server/qris.ts`: validasi CRC/struktur QRIS, konversi nominal, dan data URL QR.
- Create `tests/qris.test.ts`: unit test deterministik untuk payload statis dan dinamis.
- Modify `package.json` dan `package-lock.json`: dependensi runtime `qrcode` dan tipe TypeScript.
- Modify `src/shared/types.ts`: field QRIS generik dan penghapusan field aktif khusus DANA.
- Modify `src/server/store.ts`: nilai awal QRIS ZIQVA dan kompatibilitas data lama.
- Modify `src/server/services.ts`: checkout async berbasis QRIS dinamis dan penghapusan callback DANA.
- Modify `tests/services.test.ts`: checkout QRIS, kegagalan atomic, produk gratis, dan penghapusan tes DANA.
- Modify `src/server/index.ts`: setting QRIS admin, checkout async, endpoint manual paid aman, dan penghapusan rute DANA.
- Modify `src/ui/api.ts`: kontrak setting QRIS.
- Modify `src/ui/App.tsx`: form QRIS admin dan tombol verifikasi manual.
- Modify `src/ui/styles.css`: layout form QRIS dan aksi order bila diperlukan.
- Modify `.env.example`: hapus konfigurasi provider QRIS lama yang tidak digunakan.

### Task 1: Modul QRIS Teruji

**Files:**
- Create: `tests/qris.test.ts`
- Create: `src/server/qris.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Tambahkan dependensi QR generator**

Run:

```powershell
npm install qrcode
npm install --save-dev @types/qrcode
```

Expected: `package.json` memuat `qrcode` pada `dependencies` dan `@types/qrcode` pada `devDependencies`.

- [ ] **Step 2: Tulis unit test yang gagal**

Buat `tests/qris.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildDynamicQrisPayload,
  generateDynamicQris,
  isValidQrisCrc,
  validateStaticQrisPayload
} from '../src/server/qris';

const STATIC_QRIS = '00020101021126570011ID.DANA.WWW011893600915303265462802090326546280303UMI51440014ID.CO.QRIS.WWW0215ID10265329452210303UMI5204504553033605802ID5905ZIQVA6011Kab. Malang6105651676304F3F6';
const DYNAMIC_50000 = '00020101021226570011ID.DANA.WWW011893600915303265462802090326546280303UMI51440014ID.CO.QRIS.WWW0215ID10265329452210303UMI5204504553033605405500005802ID5905ZIQVA6011Kab. Malang6105651676304A2AF';

describe('QRIS generator', () => {
  it('accepts the ZIQVA static QRIS with a valid CRC', () => {
    expect(isValidQrisCrc(STATIC_QRIS)).toBe(true);
    expect(validateStaticQrisPayload(STATIC_QRIS)).toBe(STATIC_QRIS);
  });

  it('embeds an integer amount and recalculates CRC', () => {
    const payload = buildDynamicQrisPayload(STATIC_QRIS, 50000);
    expect(payload).toBe(DYNAMIC_50000);
    expect(payload).toContain('010212');
    expect(payload).toContain('5405500005802ID');
    expect(isValidQrisCrc(payload)).toBe(true);
  });

  it.each([0, -1, 10.5, Number.NaN])('rejects invalid amount %s', (amount) => {
    expect(() => buildDynamicQrisPayload(STATIC_QRIS, amount)).toThrow('nominal QRIS');
  });

  it('rejects invalid CRC and malformed structure', () => {
    expect(() => validateStaticQrisPayload(`${STATIC_QRIS.slice(0, -4)}0000`)).toThrow('CRC');
    expect(() => validateStaticQrisPayload(STATIC_QRIS.replace('5802ID', '5802XX'))).toThrow('struktur');
    expect(() => validateStaticQrisPayload(STATIC_QRIS.replace('010211', '010212'))).toThrow('statis');
  });

  it('produces different QR data URLs for different totals', async () => {
    const first = await generateDynamicQris(STATIC_QRIS, 50000);
    const second = await generateDynamicQris(STATIC_QRIS, 50001);
    expect(first.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(second.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(first.payload).not.toBe(second.payload);
    expect(first.dataUrl).not.toBe(second.dataUrl);
  });
});
```

- [ ] **Step 3: Jalankan tes dan pastikan RED**

Run:

```powershell
npx vitest run tests/qris.test.ts
```

Expected: FAIL karena `src/server/qris.ts` belum ada.

- [ ] **Step 4: Implementasikan generator minimal**

Buat `src/server/qris.ts` dengan API berikut:

```ts
import QRCode from 'qrcode';

export function calculateQrisCrc(input: string): string {
  let crc = 0xffff;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function isValidQrisCrc(payload: string): boolean {
  if (!/6304[0-9A-F]{4}$/i.test(payload)) return false;
  return calculateQrisCrc(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

export function validateStaticQrisPayload(input: string): string {
  const payload = input.trim();
  if (!payload.includes('010211')) throw new Error('QRIS harus bertipe statis.');
  if (!payload.includes('5802ID') || !payload.includes('6304')) throw new Error('Struktur QRIS tidak valid.');
  if (!isValidQrisCrc(payload)) throw new Error('CRC QRIS tidak valid.');
  return payload;
}

export function buildDynamicQrisPayload(staticPayload: string, amount: number): string {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Nominal QRIS harus berupa bilangan bulat positif.');
  const source = validateStaticQrisPayload(staticPayload);
  const withoutCrc = source.slice(0, -4).replace('010211', '010212');
  const countryMarker = '5802ID';
  const markerIndex = withoutCrc.indexOf(countryMarker);
  if (markerIndex < 0 || withoutCrc.indexOf(countryMarker, markerIndex + 1) >= 0) throw new Error('Struktur QRIS tidak valid.');
  const amountText = String(amount);
  const amountTag = `54${amountText.length.toString().padStart(2, '0')}${amountText}`;
  const output = `${withoutCrc.slice(0, markerIndex)}${amountTag}${withoutCrc.slice(markerIndex)}`;
  return `${output}${calculateQrisCrc(output)}`;
}

export async function generateDynamicQris(staticPayload: string, amount: number) {
  const payload = buildDynamicQrisPayload(staticPayload, amount);
  const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
  return { payload, dataUrl };
}
```

- [ ] **Step 5: Jalankan tes dan pastikan GREEN**

Run: `npx vitest run tests/qris.test.ts`

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json src/server/qris.ts tests/qris.test.ts
git commit -m "feat: add validated dynamic QRIS generator"
```

### Task 2: Checkout Atomic dengan QRIS Dinamis

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/store.ts`
- Modify: `src/server/services.ts`
- Modify: `tests/services.test.ts`

- [ ] **Step 1: Ubah tes checkout agar gagal terhadap perilaku lama**

Di `tests/services.test.ts`, hapus import dan dua test `handleDanaSandboxFinishNotify`. Ubah test checkout pertama agar memakai `await createCheckout(...)` dan menegaskan:

```ts
expect(order.uniqueCode).toBeGreaterThanOrEqual(100);
expect(order.uniqueCode).toBeLessThanOrEqual(999);
expect(order.totalAmount).toBe(order.amount + (order.uniqueCode ?? 0));
expect(order.paymentQrUrl).toMatch(/^data:image\/png;base64,/);
expect(order.qrisPayload).toContain(`54${String(order.totalAmount).length.toString().padStart(2, '0')}${order.totalAmount}`);
expect(order.qrisPayload).toContain('010212');
```

Tambahkan test atomic dan produk gratis:

```ts
it('does not store a paid checkout when static QRIS is invalid', async () => {
  const member = await createMember(store, { name: 'Buyer', email: 'buyer@asistenq.com', password: 'secret123' });
  const product = createProductRecord(store, { name: 'Paid', slug: 'paid', type: 'tool', billingPeriod: 'monthly', price: 49900 });
  store.data.deploymentSettings = { ...store.data.deploymentSettings, qrisStaticPayload: 'invalid' };
  await expect(createCheckout(store, member.id, product.id)).rejects.toThrow('QRIS');
  expect(store.data.orders).toHaveLength(0);
});

it('creates a free checkout without QRIS configuration', async () => {
  const member = await createMember(store, { name: 'Free Buyer', email: 'free@asistenq.com', password: 'secret123' });
  const product = createProductRecord(store, { name: 'Free Tool', slug: 'free-tool', type: 'tool', billingPeriod: 'one_time', price: 0 });
  store.data.deploymentSettings = { githubRepo: 'effands/asistenq', githubBranch: 'master', qrisStaticPayload: '' };
  const order = await createCheckout(store, member.id, product.id);
  expect(order.totalAmount).toBe(0);
  expect(order.paymentQrUrl).toBeUndefined();
});
```

Ubah semua pemanggilan checkout di file tersebut menjadi `await createCheckout(...)`.

- [ ] **Step 2: Jalankan tes dan pastikan RED**

Run: `npx vitest run tests/services.test.ts`

Expected: FAIL karena checkout masih memakai gambar Blogger dan fungsi masih sinkron.

- [ ] **Step 3: Ubah model dan default store**

Di `DeploymentSettings`, tambahkan:

```ts
qrisStaticPayload?: string;
```

Hapus field aktif `dana*` dari `DeploymentSettings` dan hapus field provider/reference/payload khusus gateway dari `Order`. Tambahkan konstanta payload ZIQVA di `src/server/store.ts` dan jadikan nilai awal `deploymentSettings.qrisStaticPayload`. Pertahankan spread `...(data.deploymentSettings ?? {})` agar properti ekstra dari JSON lama tidak merusak load.

- [ ] **Step 4: Buat checkout async dan atomic**

Di `src/server/services.ts`:

```ts
import { generateDynamicQris } from './qris';
```

Ubah signature menjadi:

```ts
export async function createCheckout(store: Store, memberId: string, productId: string, now = new Date()): Promise<Order>
```

Setelah menghitung `totalAmount`, buat hasil QR sebelum membentuk dan menyimpan order:

```ts
const generatedQris = product.price > 0
  ? await generateDynamicQris(store.data.deploymentSettings?.qrisStaticPayload ?? '', totalAmount)
  : undefined;
```

Isi order dengan:

```ts
qrisPayload: generatedQris?.payload ?? '',
paymentQrUrl: generatedQris?.dataUrl,
```

Jangan panggil `store.data.orders.push(order)` atau `store.save()` sebelum generator selesai. Hapus seluruh helper dan export callback DANA dari file ini.

- [ ] **Step 5: Jalankan tes checkout dan seluruh services**

Run: `npx vitest run tests/services.test.ts tests/qris.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/types.ts src/server/store.ts src/server/services.ts tests/services.test.ts
git commit -m "feat: create atomic dynamic QRIS checkouts"
```

### Task 3: Pengaturan QRIS Admin dan Penghapusan Backend DANA

**Files:**
- Modify: `src/server/index.ts`
- Modify: `.env.example`
- Create: `tests/payment-source.test.ts`

- [ ] **Step 1: Tulis regression test source yang gagal**

Buat `tests/payment-source.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('active payment integration source', () => {
  it('does not expose DANA API integration code', () => {
    const files = ['src/server/index.ts', 'src/server/services.ts', 'src/shared/types.ts', 'src/ui/App.tsx', 'src/ui/api.ts', '.env.example'];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(file), 'utf8');
      expect(source.toLowerCase(), file).not.toContain('/payments/dana');
      expect(source.toLowerCase(), file).not.toContain('danasandbox');
      expect(source.toLowerCase(), file).not.toContain('danaclient');
      expect(source.toLowerCase(), file).not.toContain('danamerchant');
    }
  });
});
```

- [ ] **Step 2: Jalankan tes dan pastikan RED**

Run: `npx vitest run tests/payment-source.test.ts`

Expected: FAIL pada referensi DANA yang masih ada.

- [ ] **Step 3: Ganti schema dan respons setting backend**

Di `src/server/index.ts`, import `validateStaticQrisPayload`. Ganti seluruh field schema `dana*` menjadi:

```ts
qrisStaticPayload: z.string().optional()
```

Respons GET `/api/admin/deploy/settings` mengembalikan:

```ts
qrisStaticPayload: settings.qrisStaticPayload ?? ''
```

Pada POST, bila field tersedia, validasi dengan:

```ts
const nextQrisStaticPayload = body.qrisStaticPayload === undefined
  ? current.qrisStaticPayload ?? ''
  : validateStaticQrisPayload(body.qrisStaticPayload);
```

Simpan `qrisStaticPayload: nextQrisStaticPayload` dan kembalikan nilai tersebut pada respons. Hapus masking, kelengkapan credential, dan cabang penyimpanan DANA.

- [ ] **Step 4: Hapus rute DANA dan await checkout**

Hapus `/api/payments/dana/finish-notify` serta `/api/payments/dana/redirect`. Di route checkout member, ubah menjadi handler `async` dan:

```ts
const order = await createCheckout(store, req.user.id, body.productId);
```

Tangkap kegagalan QRIS dan kembalikan status 400 dengan pesan error, tanpa order baru.

- [ ] **Step 5: Perketat endpoint manual paid**

Pada `POST /api/admin/orders/:id/paid`, bungkus `markOrderPaid` dengan `try/catch`; kembalikan `publicOrder(result.order)` dan subscription. Tolak status expired melalui validasi di `markOrderPaid` bila belum ada, serta pertahankan idempotensi order paid agar subscription tidak digandakan.

- [ ] **Step 6: Bersihkan environment lama dan jalankan tes**

Hapus `QRIS_PROVIDER`, `QRIS_MERCHANT_ID`, dan `QRIS_API_KEY` dari `.env.example` karena sumber QR kini disimpan di admin.

Run:

```powershell
npx vitest run tests/payment-source.test.ts tests/services.test.ts tests/qris.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/server/index.ts src/server/services.ts .env.example tests/payment-source.test.ts
git commit -m "refactor: replace DANA backend with manual QRIS settings"
```

### Task 4: UI Pengaturan QRIS dan Verifikasi Manual

**Files:**
- Modify: `src/ui/api.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Ubah kontrak frontend agar TypeScript gagal pada UI lama**

Di `DeploymentSettingsResult`, hapus field `dana*` dan tambahkan:

```ts
qrisStaticPayload: string;
```

Ubah tipe callback penyimpanan setting pada `App` dan `DeployPanel` agar menerima `qrisStaticPayload?: string` dan tidak menerima field DANA.

- [ ] **Step 2: Jalankan typecheck dan pastikan RED**

Run: `npm run lint`

Expected: FAIL pada state, form, dan properti DANA yang masih digunakan `App.tsx`.

- [ ] **Step 3: Ganti panel DANA dengan panel QRIS**

Hapus seluruh state dan form DANA. Tambahkan state:

```ts
const [qrisStaticPayload, setQrisStaticPayload] = useState(settings?.qrisStaticPayload ?? '');
const [qrisNotice, setQrisNotice] = useState('');
```

Sinkronkan state saat settings berubah. Render panel `QRIS Pembayaran` dengan textarea payload, keterangan bahwa QRIS ZIQVA akan diberi nominal harga + kode unik tiga digit, dan submit yang memanggil:

```ts
const result = await onSaveSettings({
  githubRepo,
  githubBranch,
  qrisStaticPayload: qrisStaticPayload.trim()
});
```

Tampilkan pesan berhasil atau pesan validasi dari backend.

- [ ] **Step 4: Hubungkan aksi verifikasi order**

Tambahkan callback `onMarkOrderPaid(orderId)` dari root `App` ke `AdminPanel` dan `AdminOrderPanel`. Implementasinya:

```ts
await apiRequest(`/admin/orders/${orderId}/paid`, { method: 'POST', token: adminSession.token });
await loadOrders(adminSession.token);
await loadSummary(adminSession.token);
```

Pada row pending yang belum expired, tampilkan tombol `Verifikasi Dibayar`. Gunakan konfirmasi yang menyebut invoice dan `formattedTotalAmount`, disable ketika request berjalan, lalu tampilkan notifikasi hasil. Jangan tampilkan tombol untuk status selain pending.

- [ ] **Step 5: Sesuaikan teks user**

Pastikan modal invoice menjelaskan bahwa nominal sudah terisi otomatis dan user harus membayar persis sesuai total. Pertahankan tombol Telegram dan hilangkan teks yang menyiratkan callback atau verifikasi otomatis.

- [ ] **Step 6: Tambahkan CSS fokus**

Tambahkan aturan minimal untuk textarea QRIS monospace, kolom aksi order, tombol verifikasi, dan tampilan mobile. Jangan mengubah layout panel lain.

- [ ] **Step 7: Jalankan typecheck dan build**

Run:

```powershell
npm run lint
npm run build
```

Expected: kedua perintah exit 0.

- [ ] **Step 8: Commit**

```powershell
git add src/ui/api.ts src/ui/App.tsx src/ui/styles.css
git commit -m "feat: manage QRIS and verify payments in admin"
```

### Task 5: Verifikasi Integrasi dan Pembersihan Akhir

**Files:**
- Verify: `src/server/qris.ts`
- Verify: `src/server/services.ts`
- Verify: `src/server/index.ts`
- Verify: `src/ui/App.tsx`
- Verify: `src/ui/api.ts`
- Verify: `src/shared/types.ts`
- Verify: `tests/qris.test.ts`
- Verify: `tests/services.test.ts`
- Verify: `tests/payment-source.test.ts`

- [ ] **Step 1: Jalankan seluruh test suite**

Run: `npm test`

Expected: seluruh test PASS, 0 failure.

- [ ] **Step 2: Jalankan pemeriksaan TypeScript**

Run: `npm run lint`

Expected: exit 0 tanpa error TypeScript.

- [ ] **Step 3: Jalankan build produksi**

Run: `npm run build`

Expected: Vite dan server bundle berhasil, exit 0.

- [ ] **Step 4: Audit referensi DANA aktif**

Run:

```powershell
rg -n -i "dana" src tests .env.example
```

Expected: hanya payload statis resmi `ID.DANA.WWW` pada default QRIS/test serta dokumentasi yang sengaja mempertahankan identitas acquirer; tidak ada API, callback, redirect, credential, provider branch, atau UI DANA.

- [ ] **Step 5: Uji alur lokal secara manual**

Run: `npm run dev`

Verifikasi:

1. Login admin dan buka Settings.
2. Simpan payload QRIS ZIQVA; payload rusak harus ditolak.
3. Login member dan checkout produk berbayar.
4. Pastikan kode unik 100–999, total sesuai, QR dapat dipindai dan nominal otomatis sama dengan total.
5. Kembali ke admin, klik `Verifikasi Dibayar`, lalu pastikan status order dan akses member berubah.
6. Pastikan produk gratis tetap dapat diambil tanpa QR.

- [ ] **Step 6: Tinjau diff agar perubahan pengguna tidak ikut**

Run:

```powershell
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: commit implementasi hanya memuat file pembayaran yang direncanakan; perubahan lokal lama `src/server/seed.ts`, arsip, dan folder tool lain tidak ikut stage atau commit.
