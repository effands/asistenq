import { describe, expect, it } from 'vitest';
import {
  buildDynamicQrisPayload,
  generateDynamicQris,
  isValidQrisCrc,
  validateStaticQrisPayload
} from '../src/server/qris';

const STATIC_QRIS = '00020101021126570011ID.DANA.WWW011893600915303265462802090326546280303UMI51440014ID.CO.QRIS.WWW0215ID10265329452210303UMI5204504553033605802ID5905ZIQVA6011Kab. Malang6105651676304F3F6';
const DYNAMIC_50000 = '00020101021226570011ID.DANA.WWW011893600915303265462802090326546280303UMI51440014ID.CO.QRIS.WWW0215ID10265329452210303UMI5204504553033605405500005802ID5905ZIQVA6011Kab. Malang6105651676304A2AF';

describe('QRIS generator', () => {
  it('accepts the ZIQVA static QRIS with a valid CRC', () => {
    expect(isValidQrisCrc(STATIC_QRIS)).toBe(true);
    expect(validateStaticQrisPayload(STATIC_QRIS)).toBe(STATIC_QRIS);
  });

  it('embeds an integer amount and recalculates CRC', () => {
    const payload = buildDynamicQrisPayload(STATIC_QRIS, 50000);
    expect(payload).toBe(DYNAMIC_50000);
    expect(payload).toContain('010212');
    expect(payload).toContain('5405500005802ID');
    expect(isValidQrisCrc(payload)).toBe(true);
  });

  it.each([0, -1, 10.5, Number.NaN])('rejects invalid amount %s', (amount) => {
    expect(() => buildDynamicQrisPayload(STATIC_QRIS, amount)).toThrow('nominal QRIS');
  });

  it('rejects invalid CRC and malformed structure', () => {
    expect(() => validateStaticQrisPayload(`${STATIC_QRIS.slice(0, -4)}0000`)).toThrow('CRC');
    expect(() => validateStaticQrisPayload(STATIC_QRIS.replace('5802ID', '5802XX'))).toThrow('struktur');
    expect(() => validateStaticQrisPayload(STATIC_QRIS.replace('010211', '010212'))).toThrow('statis');
  });

  it('produces different QR data URLs for different totals', async () => {
    const first = await generateDynamicQris(STATIC_QRIS, 50000);
    const second = await generateDynamicQris(STATIC_QRIS, 50001);
    expect(first.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(second.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(first.payload).not.toBe(second.payload);
    expect(first.dataUrl).not.toBe(second.dataUrl);
  });
});
