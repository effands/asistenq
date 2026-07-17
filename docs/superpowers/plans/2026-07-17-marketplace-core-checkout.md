# Marketplace Core and Multi-item Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AsistenQ data, checkout, and fulfillment to support one invoice and one QRIS for several digital products.

**Architecture:** Preserve legacy single-product orders while normalizing them into order-item views. Put cart validation and order calculation in focused server services, then reuse one idempotent fulfillment dispatcher from admin and Telegram payment approval.

**Tech Stack:** TypeScript, Express, Zod, JSON file store, Vitest, QRCode.

---

### Task 1: Extend marketplace, order, entitlement, and content types

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/store.ts`
- Test: `tests/storefront.test.ts`

- [ ] **Step 1: Write the failing normalization test**

Add a test that creates a memory store from legacy data and expects `contentPages`, `subscribers`, `accessGrants`, and product marketplace fields to normalize without changing the old order.

```ts
const store = createMemoryStore({ orders: [legacyOrder], products: [legacyProduct] });
expect(store.data.orders[0].orderItems).toBeUndefined();
expect(store.data.contentPages).toEqual([]);
expect(store.data.subscribers).toEqual([]);
expect(store.data.accessGrants).toEqual([]);
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run tests/storefront.test.ts`
Expected: FAIL because the new collections do not exist.

- [ ] **Step 3: Add exact domain types**

Add `ProductFulfillmentType = 'license' | 'download' | 'url' | 'course'`, `ProductGalleryItem`, `ProductMarketplaceDetails`, `OrderItem`, `AccessGrant`, `ContentPage`, and `ProductSubscriber`. Add optional `marketplace`, `gallery`, and technical/content fields to `Product`; add `orderItems?: OrderItem[]` to `Order`; add the three collections to `DatabaseShape`.

```ts
export interface OrderItem {
  id: string;
  productId: string;
  planId: string;
  productName: string;
  planName: string;
  unitAmount: number;
  fulfillmentType: ProductFulfillmentType;
  fulfillmentStatus: 'pending' | 'fulfilled' | 'failed';
  fulfillmentReference?: string;
  fulfillmentError?: string;
}
```

Normalize only the new collections in `store.ts`; do not rewrite stored legacy orders on load.

- [ ] **Step 4: Run the focused test and commit**

Run: `npx vitest run tests/storefront.test.ts`
Expected: PASS.

```bash
git add src/shared/types.ts src/server/store.ts tests/storefront.test.ts
git commit -m "feat: extend marketplace commerce data model"
```

### Task 2: Build server-side cart validation and totals

**Files:**
- Create: `src/server/cart-checkout.ts`
- Create: `tests/cart-checkout.test.ts`
- Modify: `src/server/services.ts`

- [ ] **Step 1: Write failing calculation tests**

Cover duplicate removal, disabled product/plan rejection, mixed free/paid items, one voucher against the eligible subtotal, and one three-digit code per order.

```ts
const result = validateCart(store, {
  items: [{ productId: 'p1', planId: 'plan1' }, { productId: 'p2', planId: 'plan2' }],
  voucherCode: 'SAVE10'
});
expect(result.items.map((item) => item.unitAmount)).toEqual([49900, 29900]);
expect(result.subtotal).toBe(79800);
expect(result.discountAmount).toBe(7980);
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/cart-checkout.test.ts`
Expected: FAIL because `validateCart` is missing.

- [ ] **Step 3: Implement focused helpers**

Export `normalizeCartItems`, `validateCart`, and `orderItemsFromValidatedCart`. Use product and active plan records as the only price source. Reject an empty cart and more than 25 items. Preserve voucher product scoping: product-specific vouchers discount only matching items; global vouchers discount the full subtotal.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/cart-checkout.test.ts tests/services.test.ts`
Expected: PASS.

```bash
git add src/server/cart-checkout.ts src/server/services.ts tests/cart-checkout.test.ts
git commit -m "feat: validate multi-product carts on server"
```

### Task 3: Create one multi-item invoice and QRIS

**Files:**
- Modify: `src/server/services.ts`
- Modify: `src/server/index.ts`
- Test: `tests/services.test.ts`
- Test: `tests/storefront.test.ts`

- [ ] **Step 1: Write failing service and route tests**

Test `createCartCheckout` with two plans and assert one order, two item snapshots, one unique code, one QRIS payload, and no mutation when QRIS generation fails.

```ts
expect(order.orderItems).toHaveLength(2);
expect(order.amount).toBe(79800);
expect(order.totalAmount).toBe(order.amount - (order.discountAmount ?? 0) + order.uniqueCode!);
expect(store.data.orders).toHaveLength(1);
```

Route test `POST /api/checkout` with `{items, voucherCode}` and verify the authenticated member identity overrides body identity.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/services.test.ts tests/storefront.test.ts`
Expected: FAIL on missing cart schema/service.

- [ ] **Step 3: Implement checkout atomically**

Add a Zod cart schema with 1-25 `{productId, planId}` entries. Implement `createCartCheckout` inside the existing checkout queue: validate, reserve invoice/code, generate QRIS, then append and save the order. Keep current single-product checkout input as a compatibility branch that converts to one cart item.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/services.test.ts tests/storefront.test.ts tests/qris.test.ts`
Expected: PASS.

```bash
git add src/server/services.ts src/server/index.ts tests/services.test.ts tests/storefront.test.ts
git commit -m "feat: create combined marketplace invoices"
```

### Task 4: Fulfill every paid order item idempotently

**Files:**
- Create: `src/server/order-fulfillment.ts`
- Modify: `src/server/services.ts`
- Modify: `src/server/telegram-commerce.ts`
- Modify: `src/server/index.ts`
- Modify: `src/server/digital-downloads.ts`
- Create: `tests/order-fulfillment.test.ts`

- [ ] **Step 1: Write failing fulfillment tests**

Create one paid order containing license, download, URL, and course items. Call `fulfillPaidOrder` twice and assert one license/grant per item and `fulfilled` status for all four items. Add a failure case that records `fulfillmentError` without reverting already fulfilled siblings.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/order-fulfillment.test.ts`
Expected: FAIL because the dispatcher is missing.

- [ ] **Step 3: Implement the dispatcher**

Export `fulfillPaidOrder(store, orderId, options?)`. Reuse license generation and download grants; create `AccessGrant` records for URL/course products. Use `orderId + orderItemId` as the uniqueness boundary. Replace separate admin/Telegram product-type branches with the dispatcher and return per-item results.

- [ ] **Step 4: Verify compatibility and commit**

Run: `npx vitest run tests/order-fulfillment.test.ts tests/services.test.ts tests/telegram-commerce.test.ts tests/telegram-commerce-routes.test.ts tests/digital-downloads.test.ts`
Expected: PASS.

```bash
git add src/server/order-fulfillment.ts src/server/services.ts src/server/telegram-commerce.ts src/server/index.ts src/server/digital-downloads.ts tests/order-fulfillment.test.ts
git commit -m "feat: fulfill multi-item digital orders"
```

### Task 5: Present multi-item orders across admin, member, and Telegram

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Modify: `integrations/python/telegram_license_bot.py`
- Test: `tests/telegram_bot_response_test.py`
- Test: `tests/storefront.test.ts`

- [ ] **Step 1: Write failing presentation tests**

Assert public/admin order DTOs normalize a legacy order to one display item and preserve all native `orderItems`. Add a Telegram response test that expects every product name and combined total in a pending-order message.

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/storefront.test.ts && python -m pytest tests/telegram_bot_response_test.py -q`
Expected: FAIL on missing normalized item output.

- [ ] **Step 3: Update all order consumers**

Return normalized display items from member/admin APIs. Render item lists in admin payment verification and member order/license/access panels. Show download, URL, and course entitlements only to their owning member. Update Telegram pending/payment messages and approval summaries to list all order items while keeping the single-product command format compatible.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/storefront.test.ts tests/telegram-commerce-routes.test.ts && python -m pytest tests/telegram_bot_response_test.py tests/test_telegram_bot.py -q`
Expected: PASS.

```bash
git add src/server/index.ts src/ui/App.tsx src/ui/styles.css integrations/python/telegram_license_bot.py tests/telegram_bot_response_test.py tests/storefront.test.ts
git commit -m "feat: present multi-item orders everywhere"
```
