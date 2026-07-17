# VJ STUDIO Order, QRIS, and Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let VJ STUDIO create AsistenQ orders with dynamic QRIS and three-digit unique amounts, submit payment evidence, and receive exactly one license after manual web-admin or Telegram approval.

**Architecture:** Reuse AsistenQ's existing order, QRIS, and Telegram-commerce domain functions behind product-specific public endpoints. The server calculates every amount and issues licenses idempotently; the desktop only renders returned checkout state. Web admin and Telegram operate on the same order records.

**Tech Stack:** TypeScript, Express, React, Vitest, QRCode, Python 3 standard library, PyQt6, Telegram Bot API

---

### Task 1: Add idempotent desktop checkout service

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/services.ts`
- Test: `tests/services.test.ts`
- Test: `tests/qris.test.ts`

- [ ] **Step 1: Write failing checkout tests**

Test that the server creates a VJ order for a plan, allocates a three-digit unique code, and reuses an order for the same idempotency key:

```ts
const first = await createLicenseCheckout(store, {
  productSlug: 'vjstudio', planCode: '1M', email: 'buyer@example.com',
  hwid: 'CA00E2C30BA61C8D', idempotencyKey: 'desktop-001'
}, now);
const second = await createLicenseCheckout(store, {
  productSlug: 'vjstudio', planCode: '1M', email: 'buyer@example.com',
  hwid: 'CA00E2C30BA61C8D', idempotencyKey: 'desktop-001'
}, now);
expect(second.id).toBe(first.id);
expect(first.uniqueCode).toBeGreaterThanOrEqual(100);
expect(first.uniqueCode).toBeLessThanOrEqual(999);
expect(first.totalAmount).toBe(49900 + first.uniqueCode!);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/services.test.ts tests/qris.test.ts`

Expected: FAIL because desktop checkout and idempotency storage do not exist.

- [ ] **Step 3: Add minimum order fields**

Add `customerEmail`, `customerHwid`, `idempotencyKey`, and `licenseId` as optional order fields. Normalize email/HWID at the service boundary.

- [ ] **Step 4: Implement `createLicenseCheckout()`**

Resolve only active products/plans, validate vouchers server-side, allocate an unused code from `100..999` among pending orders, call `generateDynamicQris()` using `totalAmount`, set a 30-minute expiry, and reuse an unexpired order with the same product/idempotency key.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/services.test.ts tests/qris.test.ts`

Expected: PASS.

```powershell
git add src/shared/types.ts src/server/services.ts tests/services.test.ts tests/qris.test.ts
git commit -m "feat: create idempotent license checkout"
```

### Task 2: Expose customer-safe order endpoints

**Files:**
- Modify: `src/server/index.ts`
- Test: `tests/license-domain.test.ts`

- [ ] **Step 1: Write failing route tests**

Cover:

```ts
await request(app).post('/api/license/orders').send(validOrder).expect(201);
await request(app).get(`/api/license/orders/${invoice}/status`).expect(200);
await request(app).get('/api/license/orders/not-owned/status').expect(404);
```

Assert responses omit member IDs, merchant static payload, bot secrets, and unrelated licenses.

- [ ] **Step 2: Run the route test and confirm failure**

Run: `npm test -- tests/license-domain.test.ts`

Expected: FAIL because the endpoints do not exist.

- [ ] **Step 3: Add validated routes**

Add `POST /api/license/orders`, `GET /api/license/orders/:invoice/status`, and `POST /api/license/orders/:invoice/payment-proof`. Require a random order access token returned only at creation for status/proof access. Store only its SHA-256 hash on the order.

- [ ] **Step 4: Return a customer-safe DTO**

Return invoice, product, plan, amount, unique code, total amount, QRIS data URL, expiry, proof status, order status, and—only after approval—the license token bound to that order.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/license-domain.test.ts`

Expected: PASS.

```powershell
git add src/server/index.ts src/shared/types.ts tests/license-domain.test.ts
git commit -m "feat: expose secure desktop order endpoints"
```

### Task 3: Make manual approval issue exactly one license

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/server/telegram-commerce.ts`
- Modify: `src/server/index.ts`
- Test: `tests/telegram-commerce.test.ts`
- Test: `tests/telegram-commerce-routes.test.ts`

- [ ] **Step 1: Write failing fulfillment tests**

Approve the same order twice and assert one license:

```ts
const first = approveLicenseOrder(store, order.invoiceNumber!, reviewer, now);
const second = approveLicenseOrder(store, order.invoiceNumber!, reviewer, now);
expect(second.license.id).toBe(first.license.id);
expect(store.data.licenses.filter((item) => item.orderId === order.id)).toHaveLength(1);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts`

Expected: FAIL because generic payment approval does not guarantee desktop-license fulfillment.

- [ ] **Step 3: Implement idempotent fulfillment**

Add `approveLicenseOrder()` that marks the order paid, finds an existing license by `orderId`, or generates one using the order plan/email/HWID, then persists `order.licenseId`. Reject fulfillment when required desktop identity fields are absent.

- [ ] **Step 4: Route both approval surfaces through the same service**

Update Telegram `reviewPaymentProof()` and the web-admin approval route to call `approveLicenseOrder()`. Preserve digital-download/subscription fulfillment for non-tool products.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts`

Expected: PASS.

```powershell
git add src/server/services.ts src/server/telegram-commerce.ts src/server/index.ts tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts
git commit -m "feat: fulfill paid tool orders once"
```

### Task 4: Connect the VJ STUDIO license dialog to checkout

**Files:**
- Modify: `E:\FIX TOOLS YT\VJSTUDIO\asistenq_license_client.py`
- Modify: `E:\FIX TOOLS YT\VJSTUDIO\test_asistenq_license_client.py`
- Modify: `E:\FIX TOOLS YT\VJSTUDIO\vjstudio.py`

- [ ] **Step 1: Write failing client tests**

Test `create_order()`, `submit_payment_proof()`, and `get_order_status()` request shapes. Assert the client renders the server `totalAmount` and never adds a local random code.

```python
self.assertEqual(order['totalAmount'], 49960)
self.assertEqual(order['uniqueCode'], 60)
self.assertNotIn('qrisStaticPayload', order)
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `python -m unittest -v test_asistenq_license_client.py`

Expected: FAIL because order methods do not exist.

- [ ] **Step 3: Add checkout client methods**

Persist a UUID idempotency key per pending purchase and the returned order access token under `~/.vjstudio`. Send email, HWID, plan, and optional voucher to AsistenQ. Never persist payment proof bytes after a successful upload.

- [ ] **Step 4: Replace local payment calculation and static QRIS**

Remove dialog authority for `random.randint(10, 99)`, local final-price calculation, and direct QRIS asset download. Render the invoice, three-digit unique code, final amount, expiry, and QR image from the order response. Disable checkout while a request is running and keep retry tied to the same idempotency key.

- [ ] **Step 5: Add status polling and token delivery**

Poll only while the dialog is open, stop on paid/rejected/expired, populate the activation token after approval, and require the existing local signature/HWID validation before marking the application activated.

- [ ] **Step 6: Run Python verification**

Run:

```powershell
python -m unittest -v test_asistenq_license_client.py
python -m py_compile asistenq_license_client.py vjstudio.py
```

Expected: PASS and no compilation output.

### Task 5: Complete web-admin and Telegram review UX

**Files:**
- Modify: `src/ui/api.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/server/telegram-commerce.ts`
- Modify: `telegram_bot.py`
- Test: `tests/telegram-commerce-routes.test.ts`
- Test: `tests/test_telegram_bot.py`

- [ ] **Step 1: Write failing review-display tests**

Assert review rows show invoice, VJ plan, customer email, HWID, base amount, unique code, final amount, proof, and resulting license state. Assert both approval surfaces call the shared approval endpoint.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
npm test -- tests/telegram-commerce-routes.test.ts
python -m unittest discover -s tests -p "test_telegram_bot.py" -v
```

Expected: FAIL because desktop-order fields and fulfillment result are not displayed.

- [ ] **Step 3: Update admin and Telegram views**

Add the customer-safe fields to payment review cards/messages. Approval confirmation includes the masked license, while the full token is sent only to the owning customer/order flow. Rejection requires a reason.

- [ ] **Step 4: Run focused tests and commit**

Run:

```powershell
npm test -- tests/telegram-commerce-routes.test.ts
python -m unittest discover -s tests -p "test_telegram_bot.py" -v
```

Expected: PASS.

```powershell
git add src/ui/api.ts src/ui/App.tsx src/server/telegram-commerce.ts telegram_bot.py tests/telegram-commerce-routes.test.ts tests/test_telegram_bot.py
git commit -m "feat: review VJ Studio payments across admin and Telegram"
```

### Task 6: Verify and deploy phase 2

**Files:**
- Modify: `docs/superpowers/plans/2026-07-17-vjstudio-order-qris-fulfillment.md` (checkboxes only)

- [ ] **Step 1: Run risk-focused verification**

Run:

```powershell
npm test -- tests/services.test.ts tests/qris.test.ts tests/license-domain.test.ts tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts
python -m unittest discover -s tests -p "test_telegram_bot.py" -v
npm run lint
npm run build
```

Expected: all selected tests pass and the production build succeeds.

- [ ] **Step 2: Back up and deploy AsistenQ before the desktop build**

Back up live data, deploy the API/admin/bot, restart the cPanel Node application and Telegram bot, then verify `/api/health` and the license config endpoint.

- [ ] **Step 3: Execute one controlled transaction**

Use a test email and HWID. Create an order, confirm the QRIS encodes the exact final amount, submit proof, approve in one surface, verify the other surface shows paid, and confirm exactly one license is returned.

- [ ] **Step 4: Verify idempotency and failure paths**

Repeat creation with the same idempotency key, repeat approval, and poll status again. Confirm no duplicate order/license. Test one expired order and one rejected proof without performing additional broad regression runs.

- [ ] **Step 5: Release the VJ STUDIO update**

Build and distribute the desktop version only after the controlled live transaction succeeds. Keep the compatibility proxy available read-only during the observation window.
