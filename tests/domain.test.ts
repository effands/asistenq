import { describe, expect, it } from 'vitest';
import {
  canAdminAccess,
  createProduct,
  createSubscription,
  formatCurrency,
  nextSubscriptionEnd
} from '../src/shared/domain';

describe('product domain', () => {
  it('creates active monthly tool products with safe defaults', () => {
    const product = createProduct({
      name: 'AsistenQ YouTube Cutter',
      slug: 'youtube-cutter',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 99000
    });

    expect(product.active).toBe(true);
    expect(product.type).toBe('tool');
    expect(product.billingPeriod).toBe('monthly');
  });

  it('creates annual class products for premium learning access', () => {
    const product = createProduct({
      name: 'Kelas AsistenQ Creator',
      slug: 'kelas-creator',
      type: 'class',
      billingPeriod: 'annual',
      price: 799000
    });

    expect(product.type).toBe('class');
    expect(product.billingPeriod).toBe('annual');
  });
});

describe('subscription domain', () => {
  it('adds 30 days for monthly tool subscriptions', () => {
    const startsAt = new Date('2026-06-28T00:00:00.000Z');
    const endsAt = nextSubscriptionEnd(startsAt, 'monthly');

    expect(endsAt.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('adds 12 months for annual class subscriptions', () => {
    const startsAt = new Date('2026-06-28T00:00:00.000Z');
    const endsAt = nextSubscriptionEnd(startsAt, 'annual');

    expect(endsAt.toISOString()).toBe('2027-06-28T00:00:00.000Z');
  });

  it('activates a subscription from a paid order', () => {
    const subscription = createSubscription({
      memberId: 'member_1',
      productId: 'product_1',
      billingPeriod: 'monthly',
      paidAt: new Date('2026-06-28T00:00:00.000Z')
    });

    expect(subscription.status).toBe('active');
    expect(subscription.endsAt).toBe('2026-07-28T00:00:00.000Z');
  });
});

describe('admin permissions', () => {
  it('allows super admins to access every scope', () => {
    expect(canAdminAccess({ role: 'super_admin', scopes: [] }, 'products')).toBe(true);
    expect(canAdminAccess({ role: 'super_admin', scopes: [] }, 'admins')).toBe(true);
  });

  it('limits regular admins to their assigned scopes', () => {
    const admin = { role: 'admin' as const, scopes: ['products' as const] };

    expect(canAdminAccess(admin, 'products')).toBe(true);
    expect(canAdminAccess(admin, 'admins')).toBe(false);
  });
});

describe('presentation helpers', () => {
  it('formats Indonesian rupiah', () => {
    expect(formatCurrency(99000)).toBe('Rp99.000');
  });
});
