import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';
import {
  createAdmin,
  createCheckout,
  createMember,
  createProductRecord,
  formatInvoiceHtml,
  generateLicenseForPaidOrder,
  expirePendingOrders,
  listPendingOrders,
  markOrderPaid,
  markOrderPaidByInvoice,
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

    const order = await createCheckout(store, member.id, product.id);
    expect(order.status).toBe('pending');
    expect(order.invoiceNumber).toMatch(/^INV-/);
    expect(order.uniqueCode).toBeGreaterThanOrEqual(100);
    expect(order.uniqueCode).toBeLessThanOrEqual(999);
    expect(order.totalAmount).toBe(order.amount + (order.uniqueCode ?? 0));
    expect(order.expiresAt).toBeTruthy();
    expect(order.paymentQrUrl).toMatch(/^data:image\/png;base64,/);
    expect(order.qrisPayload).toContain(`54${String(order.totalAmount).length.toString().padStart(2, '0')}${order.totalAmount}`);
    expect(order.qrisPayload).toContain('010212');

    const result = markOrderPaid(store, order.id, new Date('2026-06-28T00:00:00.000Z'));

    expect(result.order.status).toBe('paid');
    expect(result.subscription.endsAt).toBe('2026-07-28T00:00:00.000Z');
  });

  it('does not store a paid checkout when static QRIS is invalid', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'buyer@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'Paid', slug: 'paid', type: 'tool', billingPeriod: 'monthly', price: 49900
    });
    store.data.deploymentSettings = { ...store.data.deploymentSettings, qrisStaticPayload: 'invalid' };

    await expect(createCheckout(store, member.id, product.id)).rejects.toThrow('QRIS');
    expect(store.data.orders).toHaveLength(0);
  });

  it('creates a free checkout without QRIS configuration', async () => {
    const member = await createMember(store, { name: 'Free Buyer', email: 'free@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'Free Tool', slug: 'free-tool', type: 'tool', billingPeriod: 'one_time', price: 0
    });
    store.data.deploymentSettings = {
      githubRepo: 'effands/asistenq',
      githubBranch: 'master',
      qrisStaticPayload: ''
    };

    const order = await createCheckout(store, member.id, product.id);

    expect(order.totalAmount).toBe(0);
    expect(order.paymentQrUrl).toBeUndefined();
  });

  it('creates license plans when a product is created with tiered pricing', () => {
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro',
      slug: 'vjstudio-pro',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 99000,
      plans: [
        { code: 'TRIAL', name: 'Trial 1 Hari', price: 0, billingPeriod: 'trial', durationDays: 1, isFree: true, isActive: true },
        { code: '3M', name: 'Lisensi 3 Bulan', price: 249000, billingPeriod: 'monthly', durationDays: 90, isActive: true },
        { code: 'OFF', name: 'Tidak Aktif', price: 1, billingPeriod: 'one_time', durationDays: null, isActive: false }
      ]
    });

    expect(store.data.plans.filter((plan) => plan.productId === product.id)).toMatchObject([
      { code: 'TRIAL', price: 0, durationDays: 1, isFree: true, isActive: true },
      { code: '3M', price: 249000, durationDays: 90, isFree: false, isActive: true }
    ]);
  });

  it('stores internal and external tool destinations without changing legacy defaults', () => {
    const internal = createProductRecord(store, {
      name: 'Internal Tool', slug: 'internal-tool', type: 'tool', billingPeriod: 'monthly', price: 0
    });
    const external = createProductRecord(store, {
      name: 'External Tool', slug: 'external-tool', type: 'tool', billingPeriod: 'monthly', price: 99000,
      destinationType: 'external', externalUrl: 'https://example.com/tool', openMode: 'new_tab', trackLiveUsers: false
    });

    expect(internal).toMatchObject({ destinationType: 'internal', openMode: 'same_tab', trackLiveUsers: true });
    expect(external).toMatchObject({
      destinationType: 'external', externalUrl: 'https://example.com/tool', openMode: 'new_tab', trackLiveUsers: false
    });
  });

  it('expires pending invoices after 24 hours', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'buyer@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro',
      slug: 'vjstudio',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 49900
    });
    const order = await createCheckout(store, member.id, product.id, new Date('2026-06-28T00:00:00.000Z'));

    expect(order.expiresAt).toBe('2026-06-29T00:00:00.000Z');

    const expired = expirePendingOrders(store, new Date('2026-06-29T00:00:01.000Z'));

    expect(expired).toBe(1);
    expect(store.data.orders[0].status).toBe('expired');
  });

  it('supports plan price and custom lifetime without changing the default checkout API', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'plan@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro', slug: 'vjstudio-options', type: 'tool', billingPeriod: 'monthly', price: 99000
    });
    const now = new Date('2026-07-17T08:00:00.000Z');

    const order = await createCheckout(store, member.id, product.id, now, {
      planId: 'plan_3m', price: 249000, telegramId: '1001', lifetimeMinutes: 30
    });

    expect(order).toMatchObject({
      planId: 'plan_3m', telegramId: '1001', amount: 249000,
      expiresAt: '2026-07-17T08:30:00.000Z', paymentProofStatus: 'none'
    });
  });

  it('lists pending orders and marks an invoice paid for Telegram approval', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'buyer@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro',
      slug: 'vjstudio',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 49900
    });
    const order = await createCheckout(store, member.id, product.id);

    expect(listPendingOrders(store, 5)[0]).toMatchObject({
      invoiceNumber: order.invoiceNumber,
      memberEmail: 'buyer@asistenq.com',
      productSlug: 'vjstudio'
    });

    const paid = markOrderPaidByInvoice(store, order.invoiceNumber ?? '', new Date('2026-06-28T00:00:00.000Z'));

    expect(paid.order.status).toBe('paid');
    expect(store.data.subscriptions).toHaveLength(1);
  });

  it('keeps manual payment verification idempotent', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'idempotent@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'Course', slug: 'course-idempotent', type: 'course', billingPeriod: 'annual', price: 799000
    });
    const order = await createCheckout(store, member.id, product.id);

    const first = markOrderPaid(store, order.id, new Date('2026-06-28T00:00:00.000Z'));
    const second = markOrderPaid(store, order.id, new Date('2026-06-28T01:00:00.000Z'));

    expect(second.subscription.id).toBe(first.subscription.id);
    expect(store.data.subscriptions).toHaveLength(1);
    expect(second.order.paidAt).toBe('2026-06-28T00:00:00.000Z');
  });

  it('rejects manual verification for an expired order', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'expired@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'Expired Course', slug: 'expired-course', type: 'course', billingPeriod: 'annual', price: 799000
    });
    const order = await createCheckout(store, member.id, product.id, new Date('2026-06-28T00:00:00.000Z'));
    expirePendingOrders(store, new Date('2026-06-29T00:00:01.000Z'));

    expect(() => markOrderPaid(store, order.id)).toThrow('expired');
    expect(store.data.subscriptions).toHaveLength(0);
  });

  it('generates a license from a paid invoice and HWID', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'buyer@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro',
      slug: 'vjstudio',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 49900
    });
    store.data.plans.push({
      id: 'plan_1m',
      productId: product.id,
      code: '1M',
      name: 'Lisensi 1 Bulan',
      price: 49900,
      billingPeriod: 'monthly',
      durationDays: 30,
      isFree: false,
      isActive: true
    });
    const order = await createCheckout(store, member.id, product.id);
    markOrderPaid(store, order.id, new Date('2026-06-28T00:00:00.000Z'));

    const license = generateLicenseForPaidOrder(store, {
      invoiceNumber: order.invoiceNumber ?? '',
      hwid: 'CA00E2C30BA61C8D',
      planCode: '1M',
      now: new Date('2026-06-28T00:00:00.000Z'),
      salt: 'vjstudio_secret_salt_2026_xyz'
    });

    expect(license).toMatchObject({
      email: 'buyer@asistenq.com',
      hwid: 'CA00E2C30BA61C8D',
      status: 'generated'
    });
  });

  it('renders a downloadable invoice html for a member order', async () => {
    const member = await createMember(store, { name: 'Buyer', email: 'buyer@asistenq.com', password: 'secret123' });
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro',
      slug: 'vjstudio',
      type: 'tool',
      billingPeriod: 'monthly',
      price: 49900
    });
    const order = await createCheckout(store, member.id, product.id);

    const html = formatInvoiceHtml(store, order.id, member.id);

    expect(html).toContain(order.invoiceNumber);
    expect(html).toContain('VJ Studio Pro');
    expect(html).toContain('buyer@asistenq.com');
    expect(html).toContain('Total Bayar');
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
