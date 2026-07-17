# Direct Telegram License Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the configured Telegram owner create a stored product license without an order, review the token, and explicitly send it to a linked buyer.

**Architecture:** Extend the existing licensed-product service and owner-only bot API rather than inventing a second license format. The Python bot holds a short wizard state, creates only after confirmation, always shows the result to the owner, and performs buyer delivery only from a separate callback.

**Tech Stack:** TypeScript, Express, Zod, Python Telegram Bot API client, Vitest, Supertest, unittest

---

### Task 1: Direct-license service contract and duplicate protection

**Files:**
- Modify: `src/server/services.ts:712-744`
- Modify: `tests/license-services.test.ts`

- [ ] **Step 1: Write failing service tests**

Add tests for a new `generateDirectToolLicense` service. The first call creates an orderless license; the second call with the same product/email/HWID returns the active license with `reused: true`.

```ts
const first = generateDirectToolLicense(store, input);
const second = generateDirectToolLicense(store, input);
expect(first.license.orderId).toBeUndefined();
expect(second).toMatchObject({ reused: true });
expect(store.data.licenses).toHaveLength(1);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/license-services.test.ts`
Expected: FAIL because `generateDirectToolLicense` is not exported.

- [ ] **Step 3: Implement minimal service**

Export:

```ts
export function generateDirectToolLicense(
  store: Store,
  input: { productSlug: string; planCode: string; email: string; hwid: string },
  now = new Date()
): { license: ToolLicense; reused: boolean; buyerTelegramId?: string }
```

Normalize email/HWID, look up an active non-expired license for the same product/email/HWID, and return it when present. Otherwise call the existing license generator. Resolve `buyerTelegramId` only from an active member with the same normalized email.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/license-services.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services.ts tests/license-services.test.ts
git commit -m "feat: generate direct licenses idempotently"
```

### Task 2: Owner-only license catalog, create, and delivery APIs

**Files:**
- Modify: `src/server/index.ts:1685-1715`
- Modify: `tests/telegram-commerce-routes.test.ts`

- [ ] **Step 1: Write failing API tests**

Cover three owner-only endpoints:

```ts
GET /api/bot/owner/license-products
POST /api/bot/license-generate
GET /api/bot/owner/licenses/:id/delivery
```

Assert catalog responses contain only active products with active plans, creation returns `{ license, reused, buyerTelegramId }`, delivery lookup returns the linked buyer only to the owner, and non-owner calls return 403.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/telegram-commerce-routes.test.ts`
Expected: FAIL for missing catalog/delivery routes and the old generation response shape.

- [ ] **Step 3: Implement the API contract**

Use `ownerBotMiddleware` for all three routes. Catalog fields are limited to product `id/name/slug` and plan `id/code/name/durationDays`. The create route validates the existing `generateLicenseSchema` and calls `generateDirectToolLicense`. Delivery lookup returns `{ license, buyerTelegramId }` only when an active linked member still exists; it never sends Telegram messages itself.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/license-services.test.ts tests/telegram-commerce-routes.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/index.ts tests/telegram-commerce-routes.test.ts
git commit -m "feat: expose direct license owner APIs"
```

### Task 3: Telegram owner wizard and explicit buyer delivery

**Files:**
- Modify: `integrations/python/telegram_license_bot.py:150-159,619-678,885-907`
- Modify: `tests/test_telegram_bot.py`
- Modify: `tests/telegram_bot_response_test.py`

- [ ] **Step 1: Write failing Python tests**

Mock `api` and `send` to assert:

- `license_menu` loads products rather than pending orders;
- product and plan callbacks advance wizard state;
- email and HWID validation retain state on invalid input;
- confirmation calls `/bot/license-generate` once;
- owner always receives the token;
- `Kirim ke Pembeli` appears only when `buyerTelegramId` exists;
- `direct_send:<licenseId>` sends to that buyer only after the callback.

- [ ] **Step 2: Verify RED**

Run: `python -m unittest tests/test_telegram_bot.py tests/telegram_bot_response_test.py`
Expected: FAIL because the direct callbacks/wizard do not exist.

- [ ] **Step 3: Implement wizard helpers**

Add small helpers that render product/plan keyboards and a confirmation summary. Store pending values under action `direct_license` with steps `email`, `hwid`, and `confirm`. Callback data uses `direct_product:`, `direct_plan:`, `direct_confirm`, `direct_cancel`, and `direct_send:` prefixes.

- [ ] **Step 4: Implement creation and delivery callbacks**

On confirmation, call `/bot/license-generate`, show token/expiry/email/HWID to the owner, and add `Kirim ke Pembeli` only when linked. On delivery, call `/bot/owner/licenses/:id/delivery`, send the token to the returned buyer Telegram ID, then confirm delivery to the owner. Do not send automatically.

- [ ] **Step 5: Verify GREEN**

Run: `python -m unittest tests/test_telegram_bot.py tests/telegram_bot_response_test.py`
Expected: all Python bot tests PASS.

- [ ] **Step 6: Run focused cross-stack verification**

Run: `npm test -- tests/license-services.test.ts tests/telegram-commerce-routes.test.ts && npm run build`
Expected: focused TypeScript tests PASS and production build exits 0.

- [ ] **Step 7: Commit**

```bash
git add integrations/python/telegram_license_bot.py tests/test_telegram_bot.py tests/telegram_bot_response_test.py
git commit -m "feat: add direct license Telegram wizard"
```
