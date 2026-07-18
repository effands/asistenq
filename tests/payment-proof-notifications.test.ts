import { describe, expect, it } from 'vitest';
import { buildPaymentProofNotification } from '../src/server/payment-proof-notifications';

describe('payment proof owner notifications', () => {
  it('contains transaction context and actionable owner buttons', () => {
    const notification = buildPaymentProofNotification({
      invoice: 'INV-20260718-0010',
      buyer: 'Kios Adv <kiosadv@gmail.com>',
      product: 'MIXIN9',
      plan: 'Lisensi 1 Bulan',
      total: 'Rp35.080',
      source: 'MIXIN9'
    }, 'https://asistenq.com/admin/orders/INV-20260718-0010');

    expect(notification.caption).toContain('INV-20260718-0010');
    expect(notification.caption).toContain('Kios Adv <kiosadv@gmail.com>');
    expect(notification.caption).toContain('MIXIN9');
    expect(notification.caption).toContain('Lisensi 1 Bulan');
    expect(notification.caption).toContain('Rp35.080');
    expect(notification.caption).toContain('Sumber: MIXIN9');
    expect(notification.reply_markup.inline_keyboard.flat().map((button) => button.callback_data ?? button.url)).toEqual([
      'proof_ok:INV-20260718-0010',
      'proof_no:INV-20260718-0010',
      'order:INV-20260718-0010',
      'https://asistenq.com/admin/orders/INV-20260718-0010'
    ]);
  });
});
