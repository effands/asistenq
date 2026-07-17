# Member Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat area member AsistenQ menyerupai referensi dengan sidebar ringkas dan Affiliate Coming Soon.

**Architecture:** Pertahankan `MemberPanel` sebagai pemilik state dan data. Ganti struktur navigasi tab menjadi shell sidebar + content, lalu tambahkan CSS terisolasi untuk layout dashboard dan responsivitas.

**Tech Stack:** React, TypeScript, Lucide React, CSS.

---

### Task 1: Member shell dan dashboard

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] Ganti tab horizontal dengan sidebar ringkas dan state Dashboard/Produk/Lisensi/Pesanan/Profil/Bantuan/Affiliate.
- [ ] Tambahkan hero metrik dan kartu produk member tanpa mengubah API.
- [ ] Gunakan kartu yang sudah ada untuk lisensi, pesanan, bantuan, dan invoice.
- [ ] Tambahkan tampilan Profil dan Affiliate Coming Soon.
- [ ] Tambahkan breakpoint tablet/mobile agar sidebar dan grid tidak overflow.

### Task 2: Verifikasi dan deployment

**Files:**
- Verify: `src/ui/App.tsx`
- Verify: `src/ui/styles.css`

- [ ] Jalankan `npm run build` dan pastikan exit code 0.
- [ ] Commit dan push ke `master` tanpa menyertakan file ZIP milik pengguna.
- [ ] Jalankan deployment admin dan verifikasi `/api/health` serta homepage HTTP 200.
