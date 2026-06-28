# Multi-Product License Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AsistenQ into a multi-product storefront and license center, with VJ Studio as the first end-to-end licensed tool.

**Architecture:** Extend the current TypeScript domain model so products, plans, licenses, vouchers, announcements, and banned HWIDs are product-scoped. Keep storage in the existing JSON-backed `Store` for this phase, expose public license APIs from Express, and render a public storefront plus admin License Center in the existing React app.

**Tech Stack:** TypeScript, React, Vite, Express, Vitest, JSON file storage, Node.js production bundle via `tsup`.

---

## File Map

- Modify: `E:\asistenq\src\shared\types.ts` - add product visibility, product categories, plans, licenses, vouchers, announcements, and banned HWIDs.
- Modify: `E:\asistenq\src\shared\domain.ts` - add VJ-compatible license key generation, duration helpers, plan helpers, product visibility helpers, and HWID normalization.
- Modify: `E:\asistenq\src\server\store.ts` - migrate old JSON shapes safely into the new multi-product database shape.
- Modify: `E:\asistenq\src\server\seed.ts` - seed VJ Studio, YouTube course, free resource, VJ plans, and announcement.
- Modify: `E:\asistenq\src\server\services.ts` - add license service operations and keep existing admin/member/product services working.
- Modify: `E:\asistenq\src\server\index.ts` - add public storefront data API and license API endpoints.
- Modify: `E:\asistenq\src\ui\api.ts` - add frontend API types for plans, licenses, and storefront cards.
- Modify: `E:\asistenq\src\ui\App.tsx` - split default home/storefront from admin, add License Center screen.
- Modify: `E:\asistenq\src\ui\styles.css` - replace dashboard-first styling with storefront and operational License Center styling.
- Modify: `E:\asistenq\.env.example` - add `LICENSE_SECRET_SALT`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_OWNER_ID`.
- Create: `E:\asistenq\tests\license-domain.test.ts` - key generation and duration compatibility tests.
- Create: `E:\asistenq\tests\license-services.test.ts` - license generate/activate/verify/reset/ban/voucher tests.
- Create: `E:\asistenq\tests\storefront.test.ts` - seed and public catalog behavior tests.
- Create: `E:\asistenq\docs\telegram-migration.md` - short migration notes and secret handling.

## Task 1: Multi-Product Data Model

**Files:**
- Modify: `E:\asistenq\src\shared\types.ts`
- Modify: `E:\asistenq\src\server\store.ts`
- Test: `E:\asistenq\tests\storefront.test.ts`

- [ ] **Step 1: Write failing tests for the expanded database shape**

Create `tests/storefront.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';

describe('multi-product database shape', () => {
  it('starts with product-scoped collections', () => {
    const store = createMemoryStore();

    expect(store.data.products).toEqual([]);
    expect(store.data.plans).toEqual([]);
    expect(store.data.licenses).toEqual([]);
    expect(store.data.vouchers).toEqual([]);
    expect(store.data.announcements).toEqual([]);
    expect(store.data.bannedHwids).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm test -- tests/storefront.test.ts
```

Expected: FAIL because `plans`, `licenses`, `vouchers`, `announcements`, and `bannedHwids` do not exist on `DatabaseShape`.

- [ ] **Step 3: Extend shared types**

Update `src/shared/types.ts` with these additional types and fields:

```ts
export type ProductType = 'tool' | 'course' | 'ebook' | 'video' | 'bundle' | 'free';
export type ProductVisibility = 'public' | 'private' | 'draft';
export type BillingPeriod = 'trial' | 'monthly' | 'annual' | 'lifetime' | 'one_time';
export type LicenseStatus = 'generated' | 'active' | 'expired' | 'suspended' | 'banned';
export type DiscountType = 'amount' | 'percent';

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  category: string;
  visibility: ProductVisibility;
  billingPeriod: BillingPeriod;
  price: number;
  active: boolean;
  featured: boolean;
  headline: string;
  description: string;
  coverUrl: string;
  accessUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPlan {
  id: string;
  productId: string;
  code: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  durationDays: number | null;
  isFree: boolean;
  isActive: boolean;
}

export interface ToolLicense {
  id: string;
  productId: string;
  planId: string;
  email: string;
  hwid: string;
  key: string;
  status: LicenseStatus;
  generatedAt: string;
  activatedAt?: string;
  expiresAt: string | null;
}

export interface Voucher {
  id: string;
  productId: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  expiresAt: string | null;
  maxUse: number | null;
  usedCount: number;
  active: boolean;
}

export interface ProductAnnouncement {
  id: string;
  productId: string;
  text: string;
  maxPlays: number;
  delayMinutes: number;
  enabled: boolean;
}

export interface BannedHwid {
  id: string;
  productId: string;
  hwid: string;
  reason: string;
  createdAt: string;
}

export interface DatabaseShape {
  admins: AdminAccount[];
  members: MemberAccount[];
  products: Product[];
  plans: ProductPlan[];
  licenses: ToolLicense[];
  vouchers: Voucher[];
  announcements: ProductAnnouncement[];
  bannedHwids: BannedHwid[];
  orders: Order[];
  subscriptions: Subscription[];
  auditLogs: AuditLog[];
}
```

- [ ] **Step 4: Update store defaults and migration**

Update `emptyData()` in `src/server/store.ts`:

```ts
const emptyData = (): DatabaseShape => ({
  admins: [],
  members: [],
  products: [],
  plans: [],
  licenses: [],
  vouchers: [],
  announcements: [],
  bannedHwids: [],
  orders: [],
  subscriptions: [],
  auditLogs: []
});
```

Add a `normalizeData` helper used by both memory and file stores:

```ts
function normalizeData(data: Partial<DatabaseShape>): DatabaseShape {
  return {
    ...emptyData(),
    ...data,
    products: data.products ?? [],
    plans: data.plans ?? [],
    licenses: data.licenses ?? [],
    vouchers: data.vouchers ?? [],
    announcements: data.announcements ?? [],
    bannedHwids: data.bannedHwids ?? []
  };
}
```

Use `normalizeData(initialData)` in `createMemoryStore` and `normalizeData(JSON.parse(...))` in `createFileStore`.

- [ ] **Step 5: Run the test and verify it passes**

Run:

```bash
npm test -- tests/storefront.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/server/store.ts tests/storefront.test.ts
git commit -m "feat: add multiproduct data model"
```

## Task 2: Seed VJ Studio, Course, Free Resource, and Plans

**Files:**
- Modify: `E:\asistenq\src\server\seed.ts`
- Modify: `E:\asistenq\src\server\services.ts`
- Test: `E:\asistenq\tests\storefront.test.ts`

**Task 2 follow-up note:** Align product creation and seed paths with the expanded `ProductType` and `BillingPeriod` unions introduced in Task 1; do not widen API/UI behavior beyond the seeded product and plan flows until the later API/UI tasks.

- [ ] **Step 1: Add failing seed tests**

Append to `tests/storefront.test.ts`:

```ts
import { seedInitialData } from '../src/server/seed';

describe('initial multiproduct seed', () => {
  it('seeds VJ Studio, YouTube course, and a free resource', async () => {
    const store = createMemoryStore();

    await seedInitialData(store);

    expect(store.data.products.map((item) => item.slug)).toContain('vjstudio');
    expect(store.data.products.map((item) => item.slug)).toContain('kelas-youtube-online');
    expect(store.data.products.map((item) => item.slug)).toContain('youtube-starter-kit');
  });

  it('seeds VJ Studio license plans', async () => {
    const store = createMemoryStore();

    await seedInitialData(store);

    const vjstudio = store.data.products.find((item) => item.slug === 'vjstudio');
    const plans = store.data.plans.filter((item) => item.productId === vjstudio?.id);

    expect(plans.map((item) => item.code)).toEqual(['TRIAL', '1M', '2M', '3M', '6M', '1Y', 'LIFETIME']);
    expect(plans.find((item) => item.code === 'TRIAL')?.isFree).toBe(true);
    expect(plans.find((item) => item.code === 'LIFETIME')?.billingPeriod).toBe('lifetime');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- tests/storefront.test.ts
```

Expected: FAIL because the seed only creates the current simple products and does not seed plans.

- [ ] **Step 3: Add plan creation service**

Add to `src/server/services.ts`:

```ts
export function createPlanRecord(store: Store, input: {
  productId: string;
  code: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  durationDays: number | null;
  isFree: boolean;
  isActive?: boolean;
}): ProductPlan {
  const existing = store.data.plans.find((plan) => plan.productId === input.productId && plan.code === input.code);

  if (existing) {
    return existing;
  }

  const plan: ProductPlan = {
    id: createId('plan'),
    productId: input.productId,
    code: input.code,
    name: input.name,
    price: input.price,
    billingPeriod: input.billingPeriod,
    durationDays: input.durationDays,
    isFree: input.isFree,
    isActive: input.isActive ?? true
  };

  store.data.plans.push(plan);
  store.save();
  return plan;
}
```

- [ ] **Step 4: Update product creation input**

Update `createProductRecord` to accept and pass through:

```ts
category?: string;
visibility?: ProductVisibility;
featured?: boolean;
```

Default values:

```ts
category: input.category ?? 'General'
visibility: input.visibility ?? 'public'
featured: input.featured ?? false
```

- [ ] **Step 5: Seed products and plans**

Update `src/server/seed.ts` to create:

```ts
const vjstudio = createProductRecord(store, {
  name: 'VJ Studio',
  slug: 'vjstudio',
  type: 'tool',
  category: 'Video Editing',
  billingPeriod: 'monthly',
  price: 49900,
  featured: true,
  headline: 'Tools editing video dan workflow YouTube.',
  description: 'Produk pertama AsistenQ untuk menguji aktivasi lisensi berbasis HWID.',
  coverUrl: '',
  accessUrl: '/admin'
});

const youtubeCourse = createProductRecord(store, {
  name: 'Kursus YouTube Creator',
  slug: 'kelas-youtube-online',
  type: 'course',
  category: 'E-learning',
  billingPeriod: 'annual',
  price: 799000,
  featured: true,
  headline: 'Kelas online dan offline untuk membangun channel YouTube.',
  description: 'Rencana course AsistenQ dengan opsi online, offline, dan bundle tools pendukung.',
  coverUrl: '',
  accessUrl: '/member'
});

createProductRecord(store, {
  name: 'YouTube Starter Kit',
  slug: 'youtube-starter-kit',
  type: 'free',
  category: 'Free Resource',
  billingPeriod: 'one_time',
  price: 0,
  featured: false,
  headline: 'Resource gratis untuk mulai produksi konten.',
  description: 'Template dan checklist awal untuk creator YouTube.',
  coverUrl: '',
  accessUrl: '/member'
});
```

Seed VJ plans with the exact plan codes in Step 1.

- [ ] **Step 6: Run storefront tests**

Run:

```bash
npm test -- tests/storefront.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/seed.ts src/server/services.ts tests/storefront.test.ts
git commit -m "feat: seed multiproduct catalog"
```

## Task 3: License Key Domain

**Files:**
- Modify: `E:\asistenq\src\shared\domain.ts`
- Create: `E:\asistenq\tests\license-domain.test.ts`

- [ ] **Step 1: Write failing key compatibility tests**

Create `tests/license-domain.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateLicenseKey, normalizeHwid, planExpiryCode } from '../src/shared/domain';

function pythonCompatibleKey(hwid: string, expiry: string, salt: string): string {
  const sig = createHash('sha256').update(`${hwid}${expiry}${salt}`).digest('hex').slice(0, 16).toUpperCase();
  return `${expiry}-${sig}`;
}

describe('VJ-compatible license keys', () => {
  it('normalizes HWID to uppercase', () => {
    expect(normalizeHwid('  abc-123  ')).toBe('ABC-123');
  });

  it('generates the same key format as the Python generator', () => {
    const hwid = 'B3F9A1D8E7C2F0A5';
    const expiry = '20260728';
    const salt = 'vjstudio_secret_salt_2026_xyz';

    expect(generateLicenseKey({ hwid, expiryCode: expiry, salt })).toBe(pythonCompatibleKey(hwid, expiry, salt));
  });

  it('converts plan duration to expiry code', () => {
    const now = new Date('2026-06-28T00:00:00.000Z');

    expect(planExpiryCode(now, 30)).toBe('20260728');
    expect(planExpiryCode(now, null)).toBe('LIFETIME');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- tests/license-domain.test.ts
```

Expected: FAIL because the new functions do not exist.

- [ ] **Step 3: Implement domain functions**

Add to `src/shared/domain.ts`:

```ts
import { createHash } from 'node:crypto';

export function normalizeHwid(hwid: string): string {
  return hwid.trim().toUpperCase();
}

export function planExpiryCode(startsAt: Date, durationDays: number | null): string {
  if (durationDays === null) {
    return 'LIFETIME';
  }

  const expiresAt = new Date(startsAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + durationDays);
  const year = expiresAt.getUTCFullYear();
  const month = String(expiresAt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(expiresAt.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function generateLicenseKey(input: { hwid: string; expiryCode: string; salt: string }): string {
  const normalizedHwid = normalizeHwid(input.hwid);
  const sig = createHash('sha256')
    .update(`${normalizedHwid}${input.expiryCode}${input.salt}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();

  return `${input.expiryCode}-${sig}`;
}
```

- [ ] **Step 4: Run domain tests**

Run:

```bash
npm test -- tests/license-domain.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domain.ts tests/license-domain.test.ts
git commit -m "feat: add compatible license key generator"
```

## Task 4: License Service Operations

**Files:**
- Modify: `E:\asistenq\src\server\services.ts`
- Test: `E:\asistenq\tests\license-services.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/license-services.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { seedInitialData } from '../src/server/seed';
import {
  activateLicense,
  banHwid,
  generateToolLicense,
  resetLicenseDevice,
  verifyVoucher
} from '../src/server/services';
import { createMemoryStore } from '../src/server/store';

describe('license services', () => {
  const store = createMemoryStore();

  beforeEach(async () => {
    store.reset();
    await seedInitialData(store);
  });

  it('generates a VJ Studio license for a plan and HWID', () => {
    const license = generateToolLicense(store, {
      productSlug: 'vjstudio',
      planCode: '1M',
      email: 'buyer@example.com',
      hwid: 'abc-123',
      now: new Date('2026-06-28T00:00:00.000Z'),
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    expect(license.email).toBe('buyer@example.com');
    expect(license.hwid).toBe('ABC-123');
    expect(license.key.startsWith('20260728-')).toBe(true);
    expect(license.status).toBe('generated');
  });

  it('activates a valid license', () => {
    const license = generateToolLicense(store, {
      productSlug: 'vjstudio',
      planCode: '1M',
      email: 'buyer@example.com',
      hwid: 'abc-123',
      now: new Date('2026-06-28T00:00:00.000Z'),
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    const result = activateLicense(store, {
      productSlug: 'vjstudio',
      token: license.key,
      hwid: 'ABC-123',
      now: new Date('2026-06-28T00:00:00.000Z')
    });

    expect(result.status).toBe('success');
    expect(store.data.licenses[0].status).toBe('active');
  });

  it('rejects activation for banned HWID', () => {
    banHwid(store, { productSlug: 'vjstudio', hwid: 'abc-123', reason: 'chargeback' });

    expect(() => activateLicense(store, {
      productSlug: 'vjstudio',
      token: 'bad-token',
      hwid: 'abc-123',
      now: new Date('2026-06-28T00:00:00.000Z')
    })).toThrow('HWID is banned');
  });

  it('resets a license to a new HWID', () => {
    const license = generateToolLicense(store, {
      productSlug: 'vjstudio',
      planCode: '1M',
      email: 'buyer@example.com',
      hwid: 'OLD-HWID',
      now: new Date('2026-06-28T00:00:00.000Z'),
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    const updated = resetLicenseDevice(store, {
      licenseId: license.id,
      newHwid: 'new-hwid',
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    expect(updated.hwid).toBe('NEW-HWID');
    expect(updated.key).toBe(license.key);
  });

  it('returns invalid for unknown vouchers', () => {
    expect(verifyVoucher(store, { productSlug: 'vjstudio', code: 'NOPE' })).toEqual({
      valid: false,
      message: 'Voucher tidak valid / kedaluwarsa.'
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- tests/license-services.test.ts
```

Expected: FAIL because service functions do not exist.

- [ ] **Step 3: Implement lookup helpers**

Add private helpers in `src/server/services.ts`:

```ts
function findProductBySlug(store: Store, productSlug: string): Product {
  const product = store.data.products.find((item) => item.slug === productSlug);
  if (!product) throw new Error('product not found');
  return product;
}

function findPlanByCode(store: Store, productId: string, planCode: string): ProductPlan {
  const plan = store.data.plans.find((item) => item.productId === productId && item.code === planCode && item.isActive);
  if (!plan) throw new Error('plan not found');
  return plan;
}
```

- [ ] **Step 4: Implement generate/activate/reset/ban/voucher services**

Add exported functions:

```ts
export function generateToolLicense(store: Store, input: {
  productSlug: string;
  planCode: string;
  email: string;
  hwid: string;
  now?: Date;
  salt?: string;
}): ToolLicense {
  const product = findProductBySlug(store, input.productSlug);
  const plan = findPlanByCode(store, product.id, input.planCode);
  const now = input.now ?? new Date();
  const expiryCode = planExpiryCode(now, plan.durationDays);
  const key = generateLicenseKey({
    hwid: input.hwid,
    expiryCode,
    salt: input.salt ?? process.env.LICENSE_SECRET_SALT ?? 'vjstudio_secret_salt_2026_xyz'
  });

  const license: ToolLicense = {
    id: createId('license'),
    productId: product.id,
    planId: plan.id,
    email: input.email.trim().toLowerCase(),
    hwid: normalizeHwid(input.hwid),
    key,
    status: 'generated',
    generatedAt: now.toISOString(),
    expiresAt: expiryCode === 'LIFETIME' ? null : `${expiryCode.slice(0, 4)}-${expiryCode.slice(4, 6)}-${expiryCode.slice(6, 8)}`
  };

  store.data.licenses.push(license);
  store.save();
  return license;
}
```

Add these exported functions after `generateToolLicense`:

```ts
export function isHwidBanned(store: Store, productId: string, hwid: string): boolean {
  const normalized = normalizeHwid(hwid);
  return store.data.bannedHwids.some((item) => item.productId === productId && item.hwid === normalized);
}

export function activateLicense(store: Store, input: {
  productSlug: string;
  token: string;
  hwid: string;
  now?: Date;
}): { status: 'success'; message: string } {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);

  if (isHwidBanned(store, product.id, normalizedHwid)) {
    throw new Error('HWID is banned');
  }

  const license = store.data.licenses.find((item) =>
    item.productId === product.id &&
    item.key === input.token.trim() &&
    item.hwid === normalizedHwid
  );

  if (!license) {
    throw new Error('Invalid license');
  }

  license.status = 'active';
  license.activatedAt = (input.now ?? new Date()).toISOString();
  store.save();

  return { status: 'success', message: 'Activated' };
}

export function verifyLicense(store: Store, input: {
  productSlug: string;
  token: string;
  hwid: string;
}): { valid: boolean; status?: LicenseStatus; message?: string } {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);

  if (isHwidBanned(store, product.id, normalizedHwid)) {
    return { valid: false, message: 'HWID is banned' };
  }

  const license = store.data.licenses.find((item) =>
    item.productId === product.id &&
    item.key === input.token.trim() &&
    item.hwid === normalizedHwid
  );

  if (!license) {
    return { valid: false, message: 'Invalid license' };
  }

  return { valid: license.status === 'active' || license.status === 'generated', status: license.status };
}

export function banHwid(store: Store, input: {
  productSlug: string;
  hwid: string;
  reason: string;
}): BannedHwid {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  const existing = store.data.bannedHwids.find((item) => item.productId === product.id && item.hwid === normalizedHwid);

  if (existing) {
    return existing;
  }

  const banned: BannedHwid = {
    id: createId('ban'),
    productId: product.id,
    hwid: normalizedHwid,
    reason: input.reason,
    createdAt: new Date().toISOString()
  };

  store.data.bannedHwids.push(banned);
  store.data.licenses
    .filter((license) => license.productId === product.id && license.hwid === normalizedHwid)
    .forEach((license) => {
      license.status = 'banned';
    });
  store.save();
  return banned;
}

export function unbanHwid(store: Store, input: {
  productSlug: string;
  hwid: string;
}): { removed: boolean } {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  const before = store.data.bannedHwids.length;
  store.data.bannedHwids = store.data.bannedHwids.filter((item) => !(item.productId === product.id && item.hwid === normalizedHwid));
  store.save();
  return { removed: store.data.bannedHwids.length < before };
}

export function resetLicenseDevice(store: Store, input: {
  licenseId: string;
  newHwid: string;
  salt: string;
}): ToolLicense {
  const license = store.data.licenses.find((item) => item.id === input.licenseId);

  if (!license) {
    throw new Error('license not found');
  }

  license.hwid = normalizeHwid(input.newHwid);
  store.save();
  return license;
}

export function verifyVoucher(store: Store, input: {
  productSlug: string;
  code: string;
}): { valid: boolean; message?: string; voucher?: Voucher } {
  const product = findProductBySlug(store, input.productSlug);
  const code = input.code.trim().toUpperCase();
  const now = new Date();
  const voucher = store.data.vouchers.find((item) =>
    item.code === code &&
    item.active &&
    (item.productId === null || item.productId === product.id)
  );

  if (!voucher) {
    return { valid: false, message: 'Voucher tidak valid / kedaluwarsa.' };
  }

  if (voucher.expiresAt && new Date(voucher.expiresAt) < now) {
    return { valid: false, message: 'Voucher tidak valid / kedaluwarsa.' };
  }

  if (voucher.maxUse !== null && voucher.usedCount >= voucher.maxUse) {
    return { valid: false, message: 'Voucher tidak valid / kedaluwarsa.' };
  }

  return { valid: true, voucher };
}
```

- [ ] **Step 5: Run license service tests**

Run:

```bash
npm test -- tests/license-services.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/services.ts tests/license-services.test.ts
git commit -m "feat: add license service operations"
```

## Task 5: License API Endpoints

**Files:**
- Modify: `E:\asistenq\src\server\index.ts`
- Test: `E:\asistenq\tests\license-services.test.ts`

- [ ] **Step 1: Add endpoint behavior tests through service-level coverage**

Extend `tests/license-services.test.ts` with a public package mapping test:

```ts
import { publicPlansForProduct } from '../src/server/services';

it('returns public plans for a product slug', () => {
  const plans = publicPlansForProduct(store, 'vjstudio');

  expect(plans.map((item) => item.code)).toContain('1M');
  expect(plans.every((item) => item.productSlug === 'vjstudio')).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- tests/license-services.test.ts
```

Expected: FAIL because `publicPlansForProduct` does not exist.

- [ ] **Step 3: Implement `publicPlansForProduct`**

Add to `src/server/services.ts`:

```ts
export function publicPlansForProduct(store: Store, productSlug: string) {
  const product = findProductBySlug(store, productSlug);
  return store.data.plans
    .filter((plan) => plan.productId === product.id && plan.isActive)
    .map((plan) => ({
      productSlug: product.slug,
      code: plan.code,
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      isFree: plan.isFree
    }));
}
```

- [ ] **Step 4: Add Express endpoints**

Add routes in `src/server/index.ts`:

```ts
app.get('/api/license/packages', (req, res) => {
  const product = String(req.query.product ?? '');
  res.json(publicPlansForProduct(store, product));
});

app.get('/api/license/announcement', (req, res) => {
  const product = store.data.products.find((item) => item.slug === String(req.query.product ?? ''));
  const announcement = store.data.announcements.find((item) => item.productId === product?.id && item.enabled);
  res.json(announcement ?? {});
});

app.get('/api/license/banned', (req, res) => {
  const product = store.data.products.find((item) => item.slug === String(req.query.product ?? ''));
  const banned = store.data.bannedHwids.filter((item) => item.productId === product?.id).map((item) => item.hwid);
  res.type('text/plain').send(banned.join('\n'));
});

app.get('/api/license/verify-voucher', (req, res) => {
  res.json(verifyVoucher(store, {
    productSlug: String(req.query.product ?? ''),
    code: String(req.query.code ?? '')
  }));
});

app.post('/api/license/generate', requireSession, requireAdminScope('products'), (req, res) => {
  const body = z.object({
    productSlug: z.string(),
    planCode: z.string(),
    email: z.string().email(),
    hwid: z.string()
  }).parse(req.body);
  res.status(201).json(generateToolLicense(store, body));
});

app.post('/api/license/activate', (req, res) => {
  const body = z.object({
    productSlug: z.string(),
    token: z.string(),
    hwid: z.string()
  }).parse(req.body);
  res.json(activateLicense(store, body));
});
```

Add verify/reset/ban/unban routes with the same pattern and admin guard where required.

- [ ] **Step 5: Run full tests**

Run:

```bash
npm test
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/index.ts src/server/services.ts tests/license-services.test.ts
git commit -m "feat: expose license api"
```

## Task 6: Public Homepage Storefront

**Files:**
- Modify: `E:\asistenq\src\ui\App.tsx`
- Modify: `E:\asistenq\src\ui\api.ts`
- Modify: `E:\asistenq\src\ui\styles.css`
- Test: `E:\asistenq\tests\storefront.test.ts`

- [ ] **Step 1: Add service test for public products**

Add to `tests/storefront.test.ts`:

```ts
import { publicCatalog } from '../src/server/services';

it('returns public products grouped by paid and free', async () => {
  const store = createMemoryStore();
  await seedInitialData(store);

  const catalog = publicCatalog(store);

  expect(catalog.featured.some((item) => item.slug === 'vjstudio')).toBe(true);
  expect(catalog.free.some((item) => item.slug === 'youtube-starter-kit')).toBe(true);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- tests/storefront.test.ts
```

Expected: FAIL because `publicCatalog` does not exist.

- [ ] **Step 3: Implement `publicCatalog` and API endpoint**

Add to `src/server/services.ts`:

```ts
export function publicCatalog(store: Store) {
  const publicProducts = store.data.products.filter((product) => product.visibility === 'public' && product.active);
  return {
    featured: publicProducts.filter((product) => product.featured),
    paid: publicProducts.filter((product) => product.price > 0),
    free: publicProducts.filter((product) => product.price === 0 || product.type === 'free')
  };
}
```

Add route in `src/server/index.ts`:

```ts
app.get('/api/catalog', (_req, res) => {
  res.json(publicCatalog(store));
});
```

- [ ] **Step 4: Update frontend API types**

Add to `src/ui/api.ts`:

```ts
export type PublicCatalog = {
  featured: PublicProduct[];
  paid: PublicProduct[];
  free: PublicProduct[];
};
```

- [ ] **Step 5: Replace default admin-first screen with storefront**

In `src/ui/App.tsx`, set:

```ts
const [view, setView] = useState<View>('marketplace');
```

Update `Marketplace` to render:

```tsx
<section className="home-hero">
  <p className="section-kicker">AsistenQ Marketplace</p>
  <h1>Tools dan kelas digital untuk mempercepat pekerjaan creator.</h1>
  <p>Mulai dari VJ Studio, course YouTube, sampai resource gratis untuk workflow konten.</p>
</section>
```

Render separate sections for paid products and free resources using existing product cards.

- [ ] **Step 6: Update CSS for storefront**

Add classes:

```css
.home-hero {
  display: grid;
  gap: 14px;
  max-width: 900px;
  padding: 32px 0 18px;
}

.home-hero h1 {
  max-width: 760px;
  font-size: clamp(34px, 6vw, 72px);
  line-height: .98;
}

.section-title-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin: 26px 0 12px;
}
```

- [ ] **Step 7: Run build and visual check**

Run:

```bash
npm test -- tests/storefront.test.ts
npm run build
```

Expected: PASS and build success.

- [ ] **Step 8: Commit**

```bash
git add src/server/index.ts src/server/services.ts src/ui/App.tsx src/ui/api.ts src/ui/styles.css tests/storefront.test.ts
git commit -m "feat: add public storefront homepage"
```

## Task 7: Admin License Center UI

**Files:**
- Modify: `E:\asistenq\src\ui\App.tsx`
- Modify: `E:\asistenq\src\ui\api.ts`
- Modify: `E:\asistenq\src\ui\styles.css`

- [ ] **Step 1: Add frontend API helpers**

Add to `src/ui/api.ts`:

```ts
export type PublicPlan = {
  productSlug: string;
  code: string;
  name: string;
  price: number;
  billingPeriod: string;
  durationDays: number | null;
  isFree: boolean;
};

export type ToolLicenseView = {
  id: string;
  productId: string;
  planId: string;
  email: string;
  hwid: string;
  key: string;
  status: string;
  generatedAt: string;
  activatedAt?: string;
  expiresAt: string | null;
};
```

- [ ] **Step 2: Add License nav item**

Update `type View`:

```ts
type View = 'marketplace' | 'member' | 'admin' | 'licenses';
```

Add nav button:

```tsx
<button className={view === 'licenses' ? 'active' : ''} onClick={() => setView('licenses')}><KeyRound size={18} /> Lisensi</button>
```

- [ ] **Step 3: Create `LicenseCenter` component**

Add a component in `App.tsx` with local state:

```tsx
function LicenseCenter({ session, setMessage }: {
  session: LoginResult | null;
  setMessage: (message: string) => void;
}) {
  const [email, setEmail] = useState('buyer@example.com');
  const [hwid, setHwid] = useState('DEVICE-HWID');
  const [planCode, setPlanCode] = useState('1M');
  const [generated, setGenerated] = useState<ToolLicenseView | null>(null);

  if (!session) {
    return <p className="muted">Login admin dulu untuk mengelola lisensi.</p>;
  }

  return (
    <section className="content-grid two">
      <form className="panel stack" onSubmit={async (event) => {
        event.preventDefault();
        const license = await apiRequest<ToolLicenseView>('/license/generate', {
          token: session.token,
          method: 'POST',
          body: { productSlug: 'vjstudio', planCode, email, hwid }
        });
        setGenerated(license);
        setMessage('Lisensi VJ Studio berhasil dibuat.');
      }}>
        <div className="panel-heading">
          <div>
            <p className="section-kicker">License Center</p>
            <h2>Generate Lisensi VJ Studio</h2>
          </div>
          <span className="soft-badge">vjstudio</span>
        </div>
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>HWID<input value={hwid} onChange={(event) => setHwid(event.target.value)} /></label>
        <label>Plan<select value={planCode} onChange={(event) => setPlanCode(event.target.value)}>
          {['TRIAL', '1M', '2M', '3M', '6M', '1Y', 'LIFETIME'].map((code) => <option key={code}>{code}</option>)}
        </select></label>
        <button className="primary"><KeyRound size={18} /> Generate Lisensi</button>
      </form>
      <div className="panel stack">
        <h2>Hasil</h2>
        {generated ? (
          <div className="license-result">
            <strong>{generated.key}</strong>
            <span>{generated.email}</span>
            <span>{generated.hwid}</span>
            <span>{generated.status}</span>
          </div>
        ) : <p className="muted">Belum ada lisensi yang dibuat.</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render License Center**

Add:

```tsx
{view === 'licenses' && (
  <LicenseCenter session={adminSession} setMessage={setMessage} />
)}
```

- [ ] **Step 5: Add basic styles**

Add to `styles.css`:

```css
.license-result {
  display: grid;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #eef7f3;
  padding: 14px;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/App.tsx src/ui/api.ts src/ui/styles.css
git commit -m "feat: add admin license center"
```

## Task 8: Environment and Telegram Migration Notes

**Files:**
- Modify: `E:\asistenq\.env.example`
- Create: `E:\asistenq\docs\telegram-migration.md`
- Modify: `E:\asistenq\README.md`

- [ ] **Step 1: Add env keys**

Update `.env.example`:

```env
LICENSE_SECRET_SALT=vjstudio_secret_salt_2026_xyz
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_ID=
```

- [ ] **Step 2: Create Telegram migration notes**

Create `docs/telegram-migration.md`:

```md
# Telegram Migration Notes

The old VJ Studio Telegram bot features will move into AsistenQ in phases.

## Do Not Commit Secrets
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_OWNER_ID`
- GitHub personal access tokens
- License salts

## Old Features To Rebuild
- Generate license
- Trial 1 day
- Reset device
- Ban/unban HWID
- List licenses
- Package management
- Voucher management
- Announcement management
- Activation notifications

## First Integration Target
Send Telegram notifications when a VJ Studio license is generated or activated.
```

- [ ] **Step 3: Link docs from README**

Add to `README.md`:

```md
## License Center
AsistenQ includes a product-scoped License Center for VJ Studio first, then future tools.

## Telegram
Telegram migration notes are in `docs/telegram-migration.md`.
```

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md docs/telegram-migration.md
git commit -m "docs: add license environment and telegram migration notes"
```

## Final Verification

After all tasks:

```bash
npm test
npm run lint
npm run build
```

Expected:
- All Vitest tests pass.
- TypeScript emits no errors.
- Vite frontend build succeeds.
- `server-dist/index.js` is generated.

Manual local checks:

```bash
npm start
```

Open:
- `http://127.0.0.1:4000`
- `http://127.0.0.1:4000/api/health`
- `http://127.0.0.1:4000/api/license/packages?product=vjstudio`

Expected:
- Homepage renders public storefront.
- Health returns `{ "ok": true, "app": "AsistenQ" }`.
- Packages returns VJ Studio plans.

## Coverage Check

- Multi-product model: Tasks 1 and 2.
- Homepage public storefront: Task 6.
- VJ Studio as first test product: Tasks 2, 3, 4, 5, and 7.
- License key compatibility: Task 3.
- Packages, voucher, announcement, banned HWID API: Task 5.
- License Center admin: Task 7.
- Telegram migration foundation and secrets: Task 8.
