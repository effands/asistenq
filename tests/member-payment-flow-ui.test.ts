import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = fs.readFileSync(path.resolve('src/ui/App.tsx'), 'utf8');

describe('member payment flow UI', () => {
  it('uses the invoice-aware Telegram bot redirect instead of generic sharing', () => {
    expect(appSource).not.toContain('https://t.me/share/url');
    expect(appSource).toContain('/api/telegram/confirm/');
  });

  it('shows proof review state and rejection reason in member orders', () => {
    expect(appSource).toContain('paymentProofStatus');
    expect(appSource).toContain('paymentProofRejectionReason');
    expect(appSource).toContain('Bukti sedang diperiksa');
  });
});
