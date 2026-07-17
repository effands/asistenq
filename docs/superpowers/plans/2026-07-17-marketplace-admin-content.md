# Marketplace Admin, Media, and Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins manage marketplace product presentation, media, fulfillment metadata, legal/help pages, and subscribers from the existing admin.

**Architecture:** Add safe product-media storage and narrow admin APIs, then split the oversized product form into focused UI sections without replacing the admin shell. Store editable pages and subscribers in the existing JSON store.

**Tech Stack:** React, TypeScript, Express, Multer, Zod, Vitest.

---

### Task 1: Product media storage and routes

**Files:**
- Create: `src/server/product-media-storage.ts`
- Create: `tests/product-media-storage.test.ts`
- Modify: `src/server/index.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Write failing storage tests**

Test safe filenames, JPEG/PNG/WebP acceptance, 8 MB image limit, MP4/WebM acceptance with a 40 MB limit, replacement cleanup, and path traversal rejection.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/product-media-storage.test.ts`
Expected: FAIL because storage helpers are missing.

- [ ] **Step 3: Implement storage and admin routes**

Use `data/product-media/<productId>/`. Add authenticated routes for marketplace cover upload, gallery upload, gallery reorder/delete, plus a public read-only route that serves only media referenced by a public product. Validate MIME and extension together. Update product records only after successful writes; delete superseded files after save.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/product-media-storage.test.ts tests/auth-security.test.ts`
Expected: PASS.

```bash
git add src/server/product-media-storage.ts src/server/index.ts src/shared/types.ts tests/product-media-storage.test.ts
git commit -m "feat: manage safe marketplace product media"
```

### Task 2: Expand product validation and admin editor

**Files:**
- Modify: `src/ui/product-form.ts`
- Modify: `tests/product-form.test.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Modify: `src/server/index.ts`
- Modify: `src/server/services.ts`

- [ ] **Step 1: Write failing product-form tests**

Test conditional fulfillment requirements: license needs no resource URL; download needs `downloadSourceUrl`; URL needs `externalUrl`; course needs at least one material. Test trimming tags and technical fields.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/product-form.test.ts`
Expected: FAIL on new fulfillment values and fields.

- [ ] **Step 3: Implement grouped admin sections**

Extend server schemas/services with marketplace appearance, gallery, content arrays, technical metadata, and four fulfillment types. In `ProductManager`, render collapsible sections named Identitas, Tampilan Marketplace, Galeri, Detail, Informasi Teknis, Paket & Harga, and Pengiriman Produk. Use existing plan editing and new media routes; never put binary data into JSON.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/product-form.test.ts tests/storefront.test.ts`
Expected: PASS.

```bash
git add src/ui/product-form.ts src/ui/App.tsx src/ui/styles.css src/server/index.ts src/server/services.ts tests/product-form.test.ts
git commit -m "feat: expand marketplace product administration"
```

### Task 3: Editable website content

**Files:**
- Create: `src/server/site-content.ts`
- Create: `tests/site-content.test.ts`
- Modify: `src/server/seed.ts`
- Modify: `src/server/index.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Write failing content tests**

Test unique slugs, published-only public reads, admin updates, and seeding the eight approved Indonesian pages without overwriting edited content.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/site-content.test.ts`
Expected: FAIL because content services are missing.

- [ ] **Step 3: Implement content service, routes, and editor**

Add public `GET /api/content/:slug`, admin list/update routes, and seed records for cara-pembelian, cara-aktivasi, kebijakan-refund, syarat-ketentuan, kebijakan-privasi, faq, tentang-asistenq, and kontak. Add admin section `Konten Website` with title, summary, body, and publish controls.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/site-content.test.ts tests/storefront.test.ts`
Expected: PASS.

```bash
git add src/server/site-content.ts src/server/seed.ts src/server/index.ts src/ui/App.tsx src/ui/styles.css tests/site-content.test.ts
git commit -m "feat: add managed marketplace content pages"
```

### Task 4: Product-update subscribers

**Files:**
- Create: `src/server/subscribers.ts`
- Create: `tests/subscribers.test.ts`
- Modify: `src/server/index.ts`
- Modify: `src/ui/App.tsx`

- [ ] **Step 1: Write failing subscriber tests**

Test lowercase normalization, duplicate idempotency, consent timestamp, public rate-limit behavior, admin listing, and CSV-safe export.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/subscribers.test.ts`
Expected: FAIL because subscriber services are missing.

- [ ] **Step 3: Implement APIs and admin panel**

Add `POST /api/subscribers`, admin list/export routes, and a subscriber table under Konten Website. Return the same success response for a new or existing address to avoid address enumeration.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/subscribers.test.ts tests/auth-security.test.ts`
Expected: PASS.

```bash
git add src/server/subscribers.ts src/server/index.ts src/ui/App.tsx tests/subscribers.test.ts
git commit -m "feat: collect marketplace update subscribers"
```
