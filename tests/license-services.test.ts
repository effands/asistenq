import { beforeEach, describe, expect, it } from 'vitest';
import { seedInitialData } from '../src/server/seed';
import {
  adminLicenseDashboard,
  activateLicense,
  banHwid,
  createMember,
  generateDirectToolLicense,
  generateToolLicense,
  memberLicenseDashboard,
  productLicenseConfig,
  publicPlansForProduct,
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
    const oldKey = license.key;

    const updated = resetLicenseDevice(store, {
      licenseId: license.id,
      newHwid: 'new-hwid',
      actorType: 'member',
      actorId: 'member-1',
      now: new Date('2026-06-29T00:00:00.000Z'),
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    expect(updated.hwid).toBe('NEW-HWID');
    expect(updated.key).not.toBe(oldKey);
    expect(store.data.bannedHwids.some((item) => item.hwid === 'OLD-HWID')).toBe(true);
    expect(updated.status).toBe('generated');
    expect(updated.expiresAt).toBe(license.expiresAt);
    expect(updated.resetQuota.remaining).toBe(1);
    expect(store.data.licenseDeviceResetEvents).toMatchObject([{
      licenseId: license.id, oldHwid: 'OLD-HWID', newHwid: 'NEW-HWID', actorType: 'member'
    }]);
  });

  it('limits member device resets to two per rolling seven days', () => {
    const license = generateToolLicense(store, {
      productSlug: 'vjstudio', planCode: '1M', email: 'buyer@example.com', hwid: 'AAAAAAAAAAAAAAAA',
      now: new Date('2026-06-28T00:00:00.000Z'), salt: 'vjstudio_secret_salt_2026_xyz'
    });
    resetLicenseDevice(store, {
      licenseId: license.id, newHwid: 'BBBBBBBBBBBBBBBB', actorType: 'member', actorId: 'member-1',
      now: new Date('2026-06-29T00:00:00.000Z')
    });
    const second = resetLicenseDevice(store, {
      licenseId: license.id, newHwid: 'CCCCCCCCCCCCCCCC', actorType: 'member', actorId: 'member-1',
      now: new Date('2026-06-30T00:00:00.000Z')
    });
    expect(second.resetQuota.remaining).toBe(0);
    expect(second.resetQuota.nextAvailableAt).toBe('2026-07-06T00:00:00.000Z');

    expect(() => resetLicenseDevice(store, {
      licenseId: license.id, newHwid: 'DDDDDDDDDDDDDDDD', actorType: 'member', actorId: 'member-1',
      now: new Date('2026-07-01T00:00:00.000Z')
    })).toThrow('Batas reset perangkat 2 kali dalam 7 hari telah habis.');

    expect(resetLicenseDevice(store, {
      licenseId: license.id, newHwid: 'DDDDDDDDDDDDDDDD', actorType: 'member', actorId: 'member-1',
      now: new Date('2026-07-06T00:00:00.001Z')
    }).resetQuota.remaining).toBe(0);
  });

  it('does not consume member quota for unchanged HWID and does not limit admin resets', () => {
    const license = generateToolLicense(store, {
      productSlug: 'vjstudio', planCode: '1M', email: 'buyer@example.com', hwid: 'AAAAAAAAAAAAAAAA',
      now: new Date('2026-06-28T00:00:00.000Z')
    });
    expect(() => resetLicenseDevice(store, {
      licenseId: license.id, newHwid: 'AAAAAAAAAAAAAAAA', actorType: 'member', actorId: 'member-1',
      now: new Date('2026-06-29T00:00:00.000Z')
    })).toThrow('HWID baru harus berbeda.');
    expect(store.data.licenseDeviceResetEvents).toHaveLength(0);

    for (const [index, hwid] of ['BBBBBBBBBBBBBBBB', 'CCCCCCCCCCCCCCCC', 'DDDDDDDDDDDDDDDD'].entries()) {
      resetLicenseDevice(store, {
        licenseId: license.id, newHwid: hwid, actorType: 'admin', actorId: 'admin-1',
        now: new Date(['2026-06-29T00:00:00.000Z', '2026-06-30T00:00:00.000Z', '2026-07-01T00:00:00.000Z'][index])
      });
    }
    expect(store.data.licenseDeviceResetEvents).toHaveLength(3);
    expect(store.data.licenseDeviceResetEvents.every((event) => event.actorType === 'admin')).toBe(true);
  });

  it('returns admin license dashboard rows with product and plan details', () => {
    const license = generateToolLicense(store, {
      productSlug: 'vjstudio',
      planCode: '1M',
      email: 'buyer@example.com',
      hwid: 'CA00E2C30BA61C8D',
      now: new Date('2026-06-28T00:00:00.000Z'),
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    const dashboard = adminLicenseDashboard(store);

    expect(dashboard.licenses).toHaveLength(1);
    expect(dashboard.licenses[0]).toMatchObject({
      id: license.id,
      email: 'buyer@example.com',
      hwid: 'CA00E2C30BA61C8D',
      product: { slug: 'vjstudio', name: 'VJ Studio Pro' },
      plan: { code: '1M', name: 'Lisensi 1 Bulan' }
    });
    expect(dashboard.plans.some((plan) => plan.productSlug === 'vjstudio' && plan.code === '1M')).toBe(true);
  });

  it('returns member owned licenses by account email', async () => {
    const member = await createMember(store, {
      name: 'Buyer',
      email: 'buyer@example.com',
      password: 'secret123'
    });
    generateToolLicense(store, {
      productSlug: 'vjstudio',
      planCode: '1M',
      email: 'BUYER@example.com',
      hwid: 'CA00E2C30BA61C8D',
      now: new Date('2026-06-28T00:00:00.000Z'),
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    const dashboard = memberLicenseDashboard(store, member.id);

    expect(dashboard.licenses).toHaveLength(1);
    expect(dashboard.licenses[0]).toMatchObject({
      email: 'buyer@example.com',
      product: { name: 'VJ Studio Pro', slug: 'vjstudio' },
      plan: { code: '1M' },
      activationUrl: '/api/license/activate',
      resetQuota: { limit: 2, remaining: 2, nextAvailableAt: null }
    });
  });

  it('returns invalid for unknown vouchers', () => {
    expect(verifyVoucher(store, { productSlug: 'vjstudio', code: 'NOPE' })).toEqual({
      valid: false,
      message: 'Voucher tidak valid / kedaluwarsa.'
    });
  });

  it('publishes only approved VJ Studio plans in display order', () => {
    const plans = publicPlansForProduct(store, 'vjstudio');

    expect(plans.map((item) => item.code)).toEqual(['1M', '3M', '6M', '1Y']);
    expect(plans.every((item) => item.productSlug === 'vjstudio')).toBe(true);
    expect(plans.find((item) => item.code === '6M')).toMatchObject({
      price: 225900,
      badge: 'Best Seller',
      highlighted: true
    });
  });

  it('creates one orderless direct license and reuses the active duplicate', () => {
    store.data.members.push({
      id: 'member-linked', name: 'Linked Buyer', email: 'buyer@example.com', passwordHash: 'hash',
      telegramId: 'buyer-telegram-1', active: true, createdAt: new Date().toISOString()
    });
    const input = {
      productSlug: 'vjstudio', planCode: '1M', email: 'BUYER@example.com',
      hwid: 'CA00E2C30BA61C8D', now: new Date('2026-07-17T00:00:00.000Z')
    };

    const first = generateDirectToolLicense(store, input);
    const second = generateDirectToolLicense(store, input);

    expect(first.reused).toBe(false);
    expect(first.license.orderId).toBeUndefined();
    expect(first.buyerTelegramId).toBe('buyer-telegram-1');
    expect(second).toMatchObject({ reused: true, buyerTelegramId: 'buyer-telegram-1' });
    expect(second.license.id).toBe(first.license.id);
    expect(store.data.licenses).toHaveLength(1);
  });

  it('returns a versioned VJ Studio license configuration', () => {
    expect(productLicenseConfig(store, 'vjstudio')).toMatchObject({
      version: 1,
      product: 'vjstudio',
      plans: [
        { code: '1M', price: 49900 },
        { code: '3M', price: 129900 },
        { code: '6M', price: 225900, badge: 'Best Seller', highlighted: true },
        { code: '1Y', price: 399000 }
      ]
    });
  });

  it('returns paid MIXIN9 license plans in display order', () => {
    expect(productLicenseConfig(store, 'mixin9')).toMatchObject({
      version: 1,
      product: 'mixin9',
      plans: [
        { code: '1M', price: 35000, durationDays: 30 },
        { code: '6M', price: 99000, durationDays: 180, highlighted: true },
        { code: '1Y', price: 155000, durationDays: 365 }
      ]
    });
  });

  it('migrates legacy free MIXIN9 plans without touching other product prices', async () => {
    const legacyStore = createMemoryStore({
      products: [{
        id: 'legacy-mixin9',
        name: 'MIXIN9',
        slug: 'mixin9',
        type: 'tool',
        billingPeriod: 'one_time',
        price: 0,
        active: true,
        headline: 'Old',
        description: 'Old',
        coverUrl: '',
        accessUrl: '/member',
        createdAt: '2026-07-17T00:00:00.000Z',
        updatedAt: '2026-07-17T00:00:00.000Z'
      }, {
        id: 'other-product',
        name: 'Other',
        slug: 'other-product',
        type: 'tool',
        billingPeriod: 'monthly',
        price: 123456,
        active: true,
        headline: 'Other',
        description: 'Other',
        coverUrl: '',
        accessUrl: '/member',
        createdAt: '2026-07-17T00:00:00.000Z',
        updatedAt: '2026-07-17T00:00:00.000Z'
      }],
      plans: [
        { id: 'legacy-free', productId: 'legacy-mixin9', code: 'DEFAULT', name: 'Akses Gratis', price: 0, billingPeriod: 'one_time', durationDays: null, isFree: true, isActive: true },
        { id: 'other-plan', productId: 'other-product', code: '1M', name: 'Other Plan', price: 123456, billingPeriod: 'monthly', durationDays: 30, isFree: false, isActive: true }
      ]
    });

    await seedInitialData(legacyStore);

    expect(productLicenseConfig(legacyStore, 'mixin9').plans).toMatchObject([
      { code: '1M', price: 35000 },
      { code: '6M', price: 99000 },
      { code: '1Y', price: 155000 }
    ]);
    expect(legacyStore.data.plans.find((plan) => plan.id === 'other-plan')?.price).toBe(123456);
  });
});
