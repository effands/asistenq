import { describe, expect, it } from 'vitest';
import { validateCart } from '../src/server/cart-checkout';
import { createMemoryStore } from '../src/server/store';

function cartStore() {
  return createMemoryStore({
    products: [
      { id: 'p1', name: 'Tool', slug: 'tool', type: 'tool', visibility: 'public', billingPeriod: 'one_time', price: 49900, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' },
      { id: 'p2', name: 'Class', slug: 'class', type: 'course', visibility: 'public', billingPeriod: 'one_time', price: 29900, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' }
    ],
    plans: [
      { id: 'plan1', productId: 'p1', code: 'ONE', name: 'One', price: 49900, billingPeriod: 'one_time', durationDays: null, isFree: false, isActive: true },
      { id: 'plan2', productId: 'p2', code: 'CLASS', name: 'Class', price: 29900, billingPeriod: 'one_time', durationDays: null, isFree: false, isActive: true }
    ],
    vouchers: [{ id: 'v1', productId: null, code: 'SAVE10', discountType: 'percent', discountValue: 10, expiresAt: null, maxUse: null, usedCount: 0, active: true }]
  });
}

describe('cart checkout validation', () => {
  it('uses server plan prices and applies one voucher to the combined subtotal', () => {
    const result = validateCart(cartStore(), {
      items: [{ productId: 'p1', planId: 'plan1' }, { productId: 'p2', planId: 'plan2' }],
      voucherCode: 'SAVE10'
    });
    expect(result.items.map((item) => item.unitAmount)).toEqual([49900, 29900]);
    expect(result.subtotal).toBe(79800);
    expect(result.discountAmount).toBe(7980);
    expect(result.amount).toBe(71820);
  });

  it('rejects duplicate and unavailable cart entries', () => {
    expect(() => validateCart(cartStore(), { items: [{ productId: 'p1', planId: 'plan1' }, { productId: 'p1', planId: 'plan1' }] })).toThrow('duplikat');
    expect(() => validateCart(cartStore(), { items: [{ productId: 'missing', planId: 'plan1' }] })).toThrow('tidak tersedia');
  });
});
