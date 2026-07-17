import { describe, expect, it } from 'vitest';
import { validateCart } from '../src/server/cart-checkout';
import { createMemoryStore } from '../src/server/store';
import { createCartCheckout } from '../src/server/services';

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

  it('creates one invoice and one QRIS for the combined cart', async () => {
    const store = cartStore();
    store.data.members.push({ id: 'm1', name: 'Buyer', email: 'buyer@example.com', passwordHash: 'x', active: true, createdAt: '' });
    store.data.deploymentSettings = { qrisStaticPayload: '00020101021126570011ID.DANA.WWW011893600915303265462802090326546280303UMI51440014ID.CO.QRIS.WWW0215ID10265329452210303UMI5204504553033605802ID5905ZIQVA6011Kab. Malang6105651676304F3F6' };
    const order = await createCartCheckout(store, 'm1', { items: [{ productId: 'p1', planId: 'plan1' }, { productId: 'p2', planId: 'plan2' }], customerHwid: 'ABCDEF1234567890' }, new Date('2026-07-17T00:00:00Z'));
    expect(order.orderItems).toHaveLength(2);
    expect(order.amount).toBe(79800);
    expect(order.uniqueCode).toBeGreaterThanOrEqual(100);
    expect(order.uniqueCode).toBeLessThanOrEqual(999);
    expect(order.totalAmount).toBe(order.amount + order.uniqueCode!);
    expect(store.data.orders).toHaveLength(1);
    expect(order.customerHwid).toBe('ABCDEF1234567890');
  });
});
