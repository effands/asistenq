import { beforeEach, describe, expect, it } from 'vitest';
import { seedInitialData } from '../src/server/seed';
import {
  activateLicense,
  banHwid,
  generateToolLicense,
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

  it('returns public plans for a product slug', () => {
    const plans = publicPlansForProduct(store, 'vjstudio');

    expect(plans.map((item) => item.code)).toContain('1M');
    expect(plans.every((item) => item.productSlug === 'vjstudio')).toBe(true);
  });
});
