import { describe, expect, it } from 'vitest';
import {
  generateLicenseKey,
  normalizeHwid,
  resolveLicenseExpiry
} from '../src/shared/domain';

const vjSalt = 'vjstudio_secret_salt_2026_xyz';

describe('license domain', () => {
  it('normalizes HWID the same way as the legacy VJ Studio generator', () => {
    expect(normalizeHwid('  b3f9a1d8e7c2f0a5  ')).toBe('B3F9A1D8E7C2F0A5');
  });

  it('generates VJ-compatible monthly keys from duration days', () => {
    const generatedAt = new Date('2026-06-28T10:30:00.000Z');
    const expiresAt = resolveLicenseExpiry(generatedAt, 30);

    expect(expiresAt).toBe('20260728');
    expect(generateLicenseKey({
      hwid: ' b3f9a1d8e7c2f0a5 ',
      expiresAt,
      salt: vjSalt
    })).toBe('20260728-1B437F5927936ADB');
  });

  it('generates VJ-compatible lifetime keys', () => {
    expect(resolveLicenseExpiry(new Date('2026-06-28T00:00:00.000Z'), null)).toBe('LIFETIME');
    expect(generateLicenseKey({
      hwid: 'B3F9A1D8E7C2F0A5',
      expiresAt: 'LIFETIME',
      salt: vjSalt
    })).toBe('LIFETIME-88BADCB96C6FFBC9');
  });
});
