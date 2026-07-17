import { describe, expect, it } from 'vitest';
import { fulfillPaidOrder } from '../src/server/order-fulfillment';
import { createMemoryStore } from '../src/server/store';

describe('paid cart fulfillment', () => {
  it('fulfills each digital product once across retries', () => {
    const store = createMemoryStore({
      members: [{ id: 'm', name: 'Buyer', email: 'buyer@example.com', passwordHash: 'x', active: true, createdAt: '' }],
      products: [
        { id: 'license', name: 'License', slug: 'license', type: 'tool', visibility: 'public', fulfillmentType: 'license', billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' },
        { id: 'download', name: 'File', slug: 'file', type: 'tool', visibility: 'public', fulfillmentType: 'download', downloadSourceUrl: 'https://files.example.com/file.zip', billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' },
        { id: 'url', name: 'Web', slug: 'web', type: 'tool', visibility: 'public', fulfillmentType: 'url', externalUrl: 'https://example.com/app', billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' },
        { id: 'course', name: 'Class', slug: 'class', type: 'course', visibility: 'public', fulfillmentType: 'course', accessUrl: '/member/class', billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', createdAt: '', updatedAt: '' }
      ],
      plans: ['license', 'download', 'url', 'course'].map((productId) => ({ id: `plan-${productId}`, productId, code: 'ONE', name: 'One', price: 1, billingPeriod: 'one_time' as const, durationDays: null, isFree: false, isActive: true })),
      orders: [{ id: 'o', memberId: 'm', productId: 'license', planId: 'plan-license', customerEmail: 'buyer@example.com', customerHwid: 'CA00E2C30BA61C8D', amount: 4, totalAmount: 104, status: 'paid', qrisPayload: '', createdAt: '', orderItems: ['license', 'download', 'url', 'course'].map((productId) => ({ id: `item-${productId}`, productId, planId: `plan-${productId}`, productName: productId, planName: 'One', unitAmount: 1, fulfillmentType: productId as 'license' | 'download' | 'url' | 'course', fulfillmentStatus: 'pending' })) }]
    });
    fulfillPaidOrder(store, 'o', new Date('2026-07-17T00:00:00Z'));
    fulfillPaidOrder(store, 'o', new Date('2026-07-17T01:00:00Z'));
    expect(store.data.orders[0].orderItems?.every((item) => item.fulfillmentStatus === 'fulfilled')).toBe(true);
    expect(store.data.licenses).toHaveLength(1);
    expect(store.data.downloadGrants).toHaveLength(1);
    expect(store.data.accessGrants).toHaveLength(2);
  });
});
