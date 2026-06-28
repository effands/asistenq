import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';
import {
  createAdmin,
  createCheckout,
  createMember,
  createProductRecord,
  markOrderPaid,
  requestPasswordReset,
  resetPassword,
  verifyMemberLogin
} from '../src/server/services';

describe('server services', () => {
  const store = createMemoryStore();

  beforeEach(() => {
    store.reset();
  });

  it('creates scoped admins from a super admin actor', async () => {
    const superAdmin = await createAdmin(store, {
      actor: { role: 'super_admin', scopes: [] },
      name: 'Owner',
      email: 'owner@asistenq.com',
      password: 'secret123',
      role: 'admin',
      scopes: ['products']
    });

    expect(superAdmin.email).toBe('owner@asistenq.com');
    expect(superAdmin.scopes).toEqual(['products']);
  });

  it('rejects admin creation from non-super admins', async () => {
    await expect(createAdmin(store, {
      actor: { role: 'admin', scopes: ['products'] },
      name: 'Staff',
      email: 'staff@asistenq.com',
      password: 'secret123',
      role: 'admin',
      scopes: ['products']
    })).rejects.toThrow('super admin access required');
  });

  it('rejects duplicate member email registration', async () => {
    await createMember(store, { name: 'Member', email: 'member@asistenq.com', password: 'secret123' });

    await expect(
      createMember(store, { name: 'Member 2', email: 'member@asistenq.com', password: 'secret123' })
    ).rejects.toThrow('email already exists');
  });

  it('creates QRIS checkout and activates monthly subscription after payment', async () => {
    const member = await createMember(store, { name: 'Member', email: 'member@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'AsistenQ YouTube Cutter',
      slug: 'youtube-cutter',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 99000
    });

    const order = createCheckout(store, member.id, product.id);
    expect(order.status).toBe('pending');
    expect(order.qrisPayload).toContain('ASISTENQ');

    const result = markOrderPaid(store, order.id, new Date('2026-06-28T00:00:00.000Z'));

    expect(result.order.status).toBe('paid');
    expect(result.subscription.endsAt).toBe('2026-07-28T00:00:00.000Z');
  });

  it('resets member password with a valid reset token', async () => {
    await createMember(store, { name: 'Member', email: 'member@asistenq.com', password: 'secret123' });
    const request = await requestPasswordReset(store, {
      email: 'member@asistenq.com',
      accountType: 'member',
      now: new Date('2026-06-28T00:00:00.000Z')
    });
    const token = new URL(request.resetUrl ?? '').searchParams.get('reset');

    expect(token).toBeTruthy();
    await resetPassword(store, {
      token: token ?? '',
      accountType: 'member',
      password: 'newsecret123',
      now: new Date('2026-06-28T00:10:00.000Z')
    });

    await expect(verifyMemberLogin(store, 'member@asistenq.com', 'secret123')).rejects.toThrow('invalid credentials');
    await expect(verifyMemberLogin(store, 'member@asistenq.com', 'newsecret123')).resolves.toMatchObject({
      email: 'member@asistenq.com'
    });
  });
});
