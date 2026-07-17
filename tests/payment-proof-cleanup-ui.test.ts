import { describe, expect, it } from 'vitest';
import { paymentProofCleanupMessage } from '../src/ui/payment-proof-cleanup';

describe('payment proof cleanup UI message', () => {
  it('formats the deleted file count and byte total', () => {
    expect(paymentProofCleanupMessage({ files: 2, bytes: 1536 })).toBe('2 file bukti dihapus (1,5 KB).');
  });
});
