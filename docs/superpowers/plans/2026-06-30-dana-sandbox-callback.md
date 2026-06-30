# DANA Sandbox Callback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fondasi callback DANA sandbox agar sandbox portal bisa mengirim notifikasi pembayaran ke AsistenQ dan order dapat berubah menjadi `paid` otomatis.

**Architecture:** Simpan metadata DANA langsung di model `Order`, proses payload notifikasi di layer service supaya mudah dites, lalu panggil helper itu dari endpoint publik Express. Redirect sandbox dipisah sebagai endpoint ringan yang hanya mengarahkan user ke member area.

**Tech Stack:** TypeScript, Express, Vitest, store file JSON AsistenQ

---

### Task 1: Tambah kontrak data pembayaran DANA

**Files:**
- Modify: `E:\asistenq\src\shared\types.ts`
- Test: `E:\asistenq\tests\storefront.test.ts`

- [ ] Tambah field order opsional untuk provider dan reference pembayaran.
- [ ] Pastikan bentuk data lama tetap kompatibel karena semua field baru opsional.

### Task 2: TDD helper proses callback DANA

**Files:**
- Modify: `E:\asistenq\tests\services.test.ts`
- Modify: `E:\asistenq\src\server\services.ts`

- [ ] Tulis test gagal untuk callback sukses yang harus menandai order `paid`.
- [ ] Jalankan test target dan pastikan gagal dengan helper yang belum ada.
- [ ] Implement helper minimal untuk membaca reference, menyimpan metadata, dan menandai paid.
- [ ] Tambah test untuk status non-sukses agar order tetap `pending`.
- [ ] Jalankan ulang test target sampai hijau.

### Task 3: Hubungkan helper ke endpoint Express

**Files:**
- Modify: `E:\asistenq\src\server\index.ts`

- [ ] Tambah endpoint `POST /api/payments/dana/finish-notify`.
- [ ] Tambah endpoint `GET /api/payments/dana/redirect`.
- [ ] Gunakan response sukses yang stabil untuk sandbox, dan response error yang tetap informatif untuk log lokal.

### Task 4: Verifikasi dan deploy

**Files:**
- Modify jika perlu: `E:\asistenq\docs\superpowers\specs\2026-06-30-dana-sandbox-callback-design.md`

- [ ] Jalankan `npm test`.
- [ ] Jalankan `npm run build`.
- [ ] Jalankan `npm audit --audit-level=low`.
- [ ] Commit, push, dan deploy ke hosting.
