import { describe, expect, it } from 'vitest';
import { seedInitialData } from '../src/server/seed';
import { publicCatalog } from '../src/server/services';
import { createMemoryStore } from '../src/server/store';
import type { DatabaseShape } from '../src/shared/types';

describe('multi-product database shape', () => {
  it('starts with product-scoped collections', () => {
    const store = createMemoryStore();

    expect(store.data.products).toEqual([]);
    expect(store.data.plans).toEqual([]);
    expect(store.data.licenses).toEqual([]);
    expect(store.data.vouchers).toEqual([]);
    expect(store.data.announcements).toEqual([]);
    expect(store.data.bannedHwids).toEqual([]);
    expect(store.data.accessGrants).toEqual([]);
    expect(store.data.contentPages).toEqual([]);
    expect(store.data.subscribers).toEqual([]);
  });

  it('normalizes legacy partial data while preserving existing records', () => {
    const legacyData: Partial<DatabaseShape> = {
      admins: [{
        id: 'admin_1',
        name: 'Owner',
        email: 'owner@example.com',
        passwordHash: 'hash',
        role: 'super_admin',
        scopes: ['admins', 'products'],
        active: true,
        createdAt: '2026-06-28T00:00:00.000Z'
      }],
      members: [{
        id: 'member_1',
        name: 'Member',
        email: 'member@example.com',
        passwordHash: 'hash',
        active: true,
        createdAt: '2026-06-28T00:00:00.000Z'
      }],
      products: [{
        id: 'product_1',
        name: 'Legacy Product',
        slug: 'legacy-product',
        type: 'tool' as const,
        billingPeriod: 'monthly' as const,
        price: 49900,
        active: true,
        headline: 'Legacy headline',
        description: 'Legacy description',
        coverUrl: '',
        accessUrl: '/member',
        createdAt: '2026-06-28T00:00:00.000Z',
        updatedAt: '2026-06-28T00:00:00.000Z'
      }],
      orders: [{
        id: 'order_1',
        memberId: 'member_1',
        productId: 'product_1',
        amount: 49900,
        status: 'paid' as const,
        qrisPayload: 'qris',
        createdAt: '2026-06-28T00:00:00.000Z',
        paidAt: '2026-06-28T00:00:00.000Z'
      }],
      subscriptions: [{
        id: 'subscription_1',
        memberId: 'member_1',
        productId: 'product_1',
        billingPeriod: 'monthly' as const,
        status: 'active' as const,
        startsAt: '2026-06-28T00:00:00.000Z',
        endsAt: '2026-07-28T00:00:00.000Z',
        createdAt: '2026-06-28T00:00:00.000Z'
      }],
      auditLogs: [{
        id: 'audit_1',
        actorId: 'admin_1',
        action: 'created',
        targetType: 'product',
        targetId: 'product_1',
        createdAt: '2026-06-28T00:00:00.000Z'
      }]
    };

    const store = createMemoryStore(legacyData);

    expect(store.data.plans).toEqual([]);
    expect(store.data.licenses).toEqual([]);
    expect(store.data.vouchers).toEqual([]);
    expect(store.data.announcements).toEqual([]);
    expect(store.data.bannedHwids).toEqual([]);
    expect(store.data.accessGrants).toEqual([]);
    expect(store.data.contentPages).toEqual([]);
    expect(store.data.subscribers).toEqual([]);
    expect(store.data.orders[0].orderItems).toBeUndefined();
    expect(store.data.admins).toEqual(legacyData.admins);
    expect(store.data.members).toEqual(legacyData.members);
    expect(store.data.products).toEqual(legacyData.products);
    expect(store.data.orders).toEqual(legacyData.orders);
    expect(store.data.subscriptions).toEqual(legacyData.subscriptions);
    expect(store.data.auditLogs).toEqual(legacyData.auditLogs);
  });

  it('returns public products grouped by paid and free', async () => {
    const store = createMemoryStore();

    await seedInitialData(store);

    const catalog = publicCatalog(store);

    expect(catalog.featured.some((item) => item.slug === 'vjstudio')).toBe(true);
    expect(catalog.paid.some((item) => item.slug === 'kelas-youtube-online')).toBe(true);
    expect(catalog.free.some((item) => item.slug === 'youtube-starter-kit')).toBe(true);
  });
});

describe('initial catalog seed', () => {
  it('seeds VJ Studio with license plans plus course and free products', async () => {
    const store = createMemoryStore();

    await seedInitialData(store);

    const productSlugs = store.data.products.map((product) => product.slug);
    expect(productSlugs).toEqual(expect.arrayContaining([
      'vjstudio',
      'kelas-youtube-online',
      'youtube-starter-kit'
    ]));

    const vjStudio = store.data.products.find((product) => product.slug === 'vjstudio');
    expect(vjStudio).toMatchObject({
      name: 'VJ Studio Pro',
      type: 'tool',
      category: 'Video Editing',
      billingPeriod: 'monthly',
      visibility: 'public',
      featured: true
    });

    const vjPlans = store.data.plans
      .filter((plan) => plan.productId === vjStudio?.id)
      .map((plan) => ({
        code: plan.code,
        price: plan.price,
        billingPeriod: plan.billingPeriod,
        durationDays: plan.durationDays,
        isFree: plan.isFree
      }));

    expect(vjPlans).toEqual([
      { code: 'TRIAL', price: 0, billingPeriod: 'trial', durationDays: 1, isFree: true },
      { code: '1M', price: 49900, billingPeriod: 'monthly', durationDays: 30, isFree: false },
      { code: '2M', price: 85900, billingPeriod: 'monthly', durationDays: 60, isFree: false },
      { code: '3M', price: 129900, billingPeriod: 'monthly', durationDays: 90, isFree: false },
      { code: '6M', price: 225900, billingPeriod: 'monthly', durationDays: 180, isFree: false },
      { code: '1Y', price: 399000, billingPeriod: 'annual', durationDays: 365, isFree: false },
      { code: 'LIFETIME', price: 799000, billingPeriod: 'lifetime', durationDays: null, isFree: false }
    ]);
  });
});
