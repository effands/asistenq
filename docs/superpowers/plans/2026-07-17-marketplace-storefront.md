# Marketplace Storefront and Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the reference-matching public marketplace, product detail, guest cart, authenticated checkout, footer, and responsive behavior.

**Architecture:** Extract pure catalog/cart helpers from `App.tsx`, keep navigation in the existing public shell, and add focused React components for storefront, product detail, cart, and managed pages. Persist only product/plan identifiers locally and obtain final prices from the server.

**Tech Stack:** React 18, TypeScript, Lucide React, CSS, localStorage, Vitest, Vite.

---

### Task 1: Pure catalog and cart helpers

**Files:**
- Create: `src/ui/marketplace-catalog.ts`
- Create: `src/ui/cart-store.ts`
- Create: `tests/marketplace-catalog.test.ts`
- Create: `tests/cart-store.test.ts`

- [ ] **Step 1: Write failing helper tests**

Test accent-insensitive search, the approved categories, four sort modes, eight-item pagination, cart deduplication by product/plan, plan replacement, invalid JSON recovery, and item count.

```ts
expect(pageProducts(products, 2, 8)).toEqual(products.slice(8, 16));
expect(addCartItem([{ productId: 'p', planId: 'a' }], { productId: 'p', planId: 'b' }))
  .toEqual([{ productId: 'p', planId: 'b' }]);
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run tests/marketplace-catalog.test.ts tests/cart-store.test.ts`
Expected: FAIL because helpers are missing.

- [ ] **Step 3: Implement deterministic pure helpers**

Export `filterProducts`, `sortProducts`, `pageProducts`, `readCart`, `writeCart`, `addCartItem`, `removeCartItem`, and `replaceCartPlan`. Keep local storage access behind `readCart`/`writeCart` so tests can use an injected storage object.

- [ ] **Step 4: Pass tests and commit**

Run: `npx vitest run tests/marketplace-catalog.test.ts tests/cart-store.test.ts`
Expected: PASS.

```bash
git add src/ui/marketplace-catalog.ts src/ui/cart-store.ts tests/marketplace-catalog.test.ts tests/cart-store.test.ts
git commit -m "feat: add marketplace catalog and cart helpers"
```

### Task 2: Reference-matching header, home, cards, and footer

**Files:**
- Create: `src/ui/MarketplaceHome.tsx`
- Create: `src/ui/PublicFooter.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Add structural assertions**

Extend `tests/storefront.test.ts` helper coverage to assert the public catalog exposes cover, badge, tags, starting plan price, and type needed by the new cards.

- [ ] **Step 2: Implement the component structure**

Build the white/emerald reference layout: compact header, hero with search, benefit icons, filter/sort bar, four-column desktop grid, eight cards per page, pagination, five-item trust strip, and four-column footer. Include loading, empty, and broken-cover fallbacks. Add cart badge and actions to `PublicShell`.

- [ ] **Step 3: Implement responsive CSS**

Use a centered `max-width: 1400px`, 4/2/1 product columns at desktop/tablet/mobile, 18-24 px card radii, emerald `#003f36` surfaces, lime accent `#82e83f`, and the spacing/hierarchy shown in the references. Preserve visible focus styles and 44 px mobile targets.

- [ ] **Step 4: Build and commit**

Run: `npm run lint && npm run build`
Expected: both exit 0.

```bash
git add src/ui/MarketplaceHome.tsx src/ui/PublicFooter.tsx src/ui/App.tsx src/ui/styles.css tests/storefront.test.ts
git commit -m "feat: redesign AsistenQ marketplace home"
```

### Task 3: Reference-matching product detail

**Files:**
- Create: `src/ui/MarketplaceProductDetail.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Implement detail state and plan selection**

Render breadcrumb, main cover, gallery thumbnails/video, product summary, benefits, plan radios, metadata panel, demo/docs actions, and tabs Description, Fitur Utama, Spesifikasi, Changelog, and FAQ. Omit reviews entirely. Default to the highlighted active plan, then lowest sorted active plan.

- [ ] **Step 2: Wire cart and Buy Now**

Add selected `{productId, planId}` to the guest cart. Buy Now creates a temporary checkout selection without deleting the existing cart. Keep custom landing templates on their existing route.

- [ ] **Step 3: Add responsive styling and verify**

Match the supplied two-column desktop composition and stack purchase panel below product information under 900 px. Verify gallery controls, keyboard tab selection, and missing-field fallbacks.

- [ ] **Step 4: Build and commit**

Run: `npm run lint && npm run build`
Expected: both exit 0.

```bash
git add src/ui/MarketplaceProductDetail.tsx src/ui/App.tsx src/ui/styles.css
git commit -m "feat: redesign marketplace product detail"
```

### Task 4: Cart drawer/page and authenticated checkout

**Files:**
- Create: `src/ui/MarketplaceCart.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/api.ts`
- Modify: `src/ui/styles.css`
- Test: `tests/cart-store.test.ts`

- [ ] **Step 1: Implement cart UI states**

Render product thumbnail, name, selected plan, server catalog price, plan selector, remove action, subtotal, and checkout button. Handle missing/disabled records with an inline correction instead of silently dropping them.

- [ ] **Step 2: Gate checkout at authentication**

When signed out, preserve cart and navigate to member login with a checkout return intent. After login, restore checkout and call `POST /api/checkout` with item identifiers and optional voucher. Clear only successfully invoiced items after a 201 response.

- [ ] **Step 3: Render combined invoice**

Show every order item, subtotal, discount, unique code, total, QRIS, expiry, proof-upload state, and manual verification instructions. Existing one-item invoices render through the same normalized view.

- [ ] **Step 4: Focused verification and commit**

Run: `npx vitest run tests/cart-store.test.ts tests/storefront.test.ts tests/services.test.ts && npm run build`
Expected: all tests and build pass.

```bash
git add src/ui/MarketplaceCart.tsx src/ui/App.tsx src/ui/api.ts src/ui/styles.css tests/cart-store.test.ts
git commit -m "feat: add persistent cart and combined checkout"
```

### Task 5: Managed public pages, final verification, and deployment

**Files:**
- Create: `src/ui/ManagedContentPage.tsx`
- Modify: `src/ui/PublicFooter.tsx`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Implement footer routes and subscriber form**

Route the eight approved slugs through `ManagedContentPage`, render published title/summary/body, and show a friendly unavailable state. Connect the footer email form to `/api/subscribers` with consent copy and success/error states.

- [ ] **Step 2: Run one consolidated verification pass**

Run:

```bash
npx vitest run tests/cart-checkout.test.ts tests/order-fulfillment.test.ts tests/product-media-storage.test.ts tests/site-content.test.ts tests/subscribers.test.ts tests/marketplace-catalog.test.ts tests/cart-store.test.ts tests/storefront.test.ts
npm run lint
npm run build
python -m pytest tests/test_telegram_bot.py tests/telegram_bot_response_test.py -q
```

Expected: all focused tests pass; lint and build exit 0; Telegram compatibility tests pass.

- [ ] **Step 3: Perform targeted responsive checks**

Check desktop 1440 px, tablet 768 px, and mobile 390 px for home, product detail, cart, invoice, admin product editor, and content editor. Confirm no horizontal overflow, clipped controls, broken images, or inaccessible checkout actions.

- [ ] **Step 4: Commit and deploy**

```bash
git add src/ui/ManagedContentPage.tsx src/ui/PublicFooter.tsx src/ui/App.tsx src/ui/styles.css
git commit -m "feat: complete marketplace content experience"
git push origin codex/marketplace-redesign
```

Deploy the production build through the established AsistenQ cPanel workflow, restart Node and Telegram only when their changed files require it, then verify `GET https://asistenq.com/api/health` returns HTTP 200.

