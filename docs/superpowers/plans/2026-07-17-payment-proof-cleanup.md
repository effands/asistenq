# Payment Proof Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized admin delete one or all uploaded payment-proof files while preventing replacement uploads from accumulating abandoned files.

**Architecture:** Isolate safe filesystem deletion and byte accounting in a small storage helper. Keep order-state transitions in the HTTP layer where the existing upload and admin routes live, then expose per-order and bulk actions through the existing Admin Order panel.

**Tech Stack:** TypeScript, Express, Node `fs`/`path`, React, Vitest, Supertest

---

### Task 1: Safe payment-proof storage helper

**Files:**
- Create: `src/server/payment-proof-storage.ts`
- Create: `tests/payment-proof-storage.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create tests using a temporary directory that assert `removePaymentProof(directory, '../name.png')` only resolves `name.png`, reports its byte size, treats a missing file as zero, and `clearPaymentProofDirectory(directory)` removes regular files while returning `{ files, bytes }`.

```ts
expect(removePaymentProof(directory, '../proof.png')).toEqual({ files: 1, bytes: 4 });
expect(clearPaymentProofDirectory(directory)).toEqual({ files: 2, bytes: 7 });
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/payment-proof-storage.test.ts`
Expected: FAIL because `src/server/payment-proof-storage.ts` does not exist.

- [ ] **Step 3: Implement the storage helper**

Export these exact functions:

```ts
export type PaymentProofCleanup = { files: number; bytes: number };
export function removePaymentProof(directory: string, storedName?: string): PaymentProofCleanup;
export function clearPaymentProofDirectory(directory: string): PaymentProofCleanup;
```

Use `path.basename`, `fs.statSync`, `fs.rmSync({ force: true })`, and skip directories. Create the directory when bulk cleanup runs against a missing directory.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/payment-proof-storage.test.ts`
Expected: all helper tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/payment-proof-storage.ts tests/payment-proof-storage.test.ts
git commit -m "feat: add safe payment proof cleanup storage"
```

### Task 2: Replacement, per-order, and bulk cleanup routes

**Files:**
- Modify: `src/server/index.ts:697-715,1805-1814`
- Modify: `tests/telegram-commerce-routes.test.ts`

- [ ] **Step 1: Write failing route tests**

Add focused Supertest cases that seed a pending desktop order and physical proof files, then assert:

```ts
await request(app).delete(`/api/admin/orders/${order.id}/payment-proof`)
  .set('Authorization', `Bearer ${adminToken}`).expect(200);
expect(store.data.orders[0].paymentProofFileId).toBeUndefined();
expect(store.data.orders[0].paymentProofStatus).toBe('none');

const cleared = await request(app).delete('/api/admin/payment-proofs')
  .set('Authorization', `Bearer ${adminToken}`).expect(200);
expect(cleared.body).toMatchObject({ ok: true, files: 2, bytes: 7 });
expect(store.data.orders).toHaveLength(existingOrderCount);
```

Also upload twice to one invoice and assert the first stored file no longer exists after the second succeeds.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/telegram-commerce-routes.test.ts`
Expected: FAIL with missing cleanup routes and retained replacement file.

- [ ] **Step 3: Implement replacement cleanup**

In the desktop upload route, capture the previous `paymentProofFileId`, persist the validated new file, update/save the order, then call `removePaymentProof(paymentProofDir, previousFile)` only when it differs from the new filename.

- [ ] **Step 4: Implement protected cleanup routes**

Add routes guarded by `requireSession` and `requireAdminScope('orders')`:

```ts
app.delete('/api/admin/orders/:id/payment-proof', ...)
app.delete('/api/admin/payment-proofs', ...)
```

Per-order cleanup clears the selected order's file reference and submission timestamp. Change only `submitted` to `none`; retain `approved` or `rejected` history. Bulk cleanup clears every file reference, applies the same status rule, saves once, and returns `{ ok: true, files, bytes, message }`.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- tests/payment-proof-storage.test.ts tests/telegram-commerce-routes.test.ts`
Expected: both files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/index.ts tests/telegram-commerce-routes.test.ts
git commit -m "feat: clear uploaded payment proofs"
```

### Task 3: Admin cleanup controls

**Files:**
- Modify: `src/ui/App.tsx:360-420,923,1033-1112`

- [ ] **Step 1: Add admin callbacks**

Pass these callbacks into `AdminOrderPanel`:

```ts
onDeletePaymentProof: (orderId: string) => Promise<{ files: number; bytes: number }>;
onClearPaymentProofs: () => Promise<{ files: number; bytes: number }>;
```

Each callback calls the matching DELETE endpoint with the admin token and reloads admin orders.

- [ ] **Step 2: Add per-order and bulk buttons**

Show `Hapus Bukti` beside `Lihat bukti` when a file reference/status is present. Add `Bersihkan Semua Bukti Upload` beside the existing export/expired buttons. Require `window.confirm` and report file count plus formatted byte size in `form-notice`.

- [ ] **Step 3: Verify UI compilation and focused tests**

Run: `npm test -- tests/payment-proof-storage.test.ts tests/telegram-commerce-routes.test.ts && npm run build`
Expected: tests PASS and Vite/TypeScript build exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: add admin payment proof cleanup controls"
```

