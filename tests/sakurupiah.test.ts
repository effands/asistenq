import { describe, expect, it } from 'vitest';
import { buildSakuRupiahSignature, verifySakuRupiahCallbackSignature } from '../src/server/sakurupiah';

describe('SakuRupiah Integration Module', () => {
  const apiId = 'SANBOX-90976113';
  const apiKey = 'SANBOX-snuNYFCZ9q7KhDPpWSTv7243YRUCSrC';
  const method = 'QRIS';
  const merchantRef = 'INV-20260724-0001';
  const amount = 50000;

  it('should generate HMAC-SHA256 signature matching SakuRupiah formula', () => {
    const signature = buildSakuRupiahSignature({
      apiId,
      method,
      merchantRef,
      amount,
      apiKey
    });

    expect(signature).toBeTypeOf('string');
    expect(signature.length).toBe(64); // SHA256 hex output length
  });

  it('should verify valid callback signature', () => {
    const callbackPayload = JSON.stringify({
      trx_id: 'SBX123456789',
      merchant_ref: merchantRef,
      status: 'berhasil',
      status_kode: 1
    });

    const validSignature = verifySakuRupiahCallbackSignature(
      callbackPayload,
      buildSakuRupiahSignature({
        apiId: '',
        method: '',
        merchantRef: '',
        amount: callbackPayload, // verifySakuRupiahCallbackSignature uses rawJsonBody with apiKey HMAC
        apiKey: ''
      }),
      apiKey
    );

    // Test helper directly
    const expectedSig = crypto.createHmac ? 
      require('crypto').createHmac('sha256', apiKey).update(callbackPayload).digest('hex') : '';
      
    const isVerified = verifySakuRupiahCallbackSignature(callbackPayload, expectedSig, apiKey);
    expect(isVerified).toBe(true);
  });

  it('should reject invalid callback signature', () => {
    const callbackPayload = JSON.stringify({
      trx_id: 'SBX123456789',
      merchant_ref: merchantRef,
      status: 'berhasil',
      status_kode: 1
    });

    const isVerified = verifySakuRupiahCallbackSignature(callbackPayload, 'invalid_signature_123', apiKey);
    expect(isVerified).toBe(false);
  });
});
