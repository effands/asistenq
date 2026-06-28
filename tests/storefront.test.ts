import { describe, expect, it } from 'vitest';
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
    expect(store.data.admins).toEqual(legacyData.admins);
    expect(store.data.members).toEqual(legacyData.members);
    expect(store.data.products).toEqual(legacyData.products);
    expect(store.data.orders).toEqual(legacyData.orders);
    expect(store.data.subscriptions).toEqual(legacyData.subscriptions);
    expect(store.data.auditLogs).toEqual(legacyData.auditLogs);
  });
});
