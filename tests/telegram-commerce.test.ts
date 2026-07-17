import { describe, expect, it } from 'vitest';
import {
  createTelegramProduct,
  deactivateTelegramProduct,
  updateTelegramPlan,
  createTelegramCheckout,
  listTelegramCatalog,
  listSubmittedPaymentProofs,
  registerTelegramBuyer,
  reopenTelegramInvoice,
  reviewPaymentProof,
  submitPaymentProof
} from '../src/server/telegram-commerce';
import { createMemoryStore } from '../src/server/store';
import { createProductRecord } from '../src/server/services';

describe('Telegram commerce data model', () => {
  it('normalizes missing download grants for partial data', () => {
    const store = createMemoryStore({ products: [], orders: [] });

    expect(store.data.downloadGrants).toEqual([]);
  });
});

describe('Telegram buyer commerce', () => {
  it('creates and then reuses a buyer by Telegram ID', async () => {
    const store = createMemoryStore();
    const input = {
      telegramId: '1001',
      name: 'Budi',
      email: 'budi@example.com',
      whatsapp: '08123456789'
    };

    const first = await registerTelegramBuyer(store, input);
    const second = await registerTelegramBuyer(store, input);

    expect(second.id).toBe(first.id);
    expect(store.data.members).toHaveLength(1);
  });

  it('rejects an email linked to another Telegram account', async () => {
    const store = createMemoryStore();
    await registerTelegramBuyer(store, {
      telegramId: '1001', name: 'Budi', email: 'same@example.com', whatsapp: '0812'
    });

    await expect(registerTelegramBuyer(store, {
      telegramId: '2002', name: 'Sari', email: 'same@example.com', whatsapp: '0813'
    })).rejects.toThrow('email sudah terhubung ke akun Telegram lain');
  });

  it('rejects linking an existing unverified email account', async () => {
    const store = createMemoryStore({
      members: [{
        id: 'member_existing',
        name: 'Nama Lama',
        email: 'buyer@example.com',
        whatsapp: '',
        telegramId: '',
        passwordHash: 'existing-hash',
        active: true,
        createdAt: '2026-07-17T00:00:00.000Z'
      }]
    });

    await expect(registerTelegramBuyer(store, {
      telegramId: '1001', name: 'Nama Baru', email: ' BUYER@example.com ', whatsapp: '0812'
    })).rejects.toThrow('email sudah terdaftar; hubungkan Telegram melalui dashboard');
    expect(store.data.members).toHaveLength(1);
    expect(store.data.members[0].telegramId).toBe('');
  });

  it('lists only available products and plans without private download sources', () => {
    const store = createMemoryStore();
    const visible = createProductRecord(store, {
      name: 'Template Video',
      slug: 'template-video',
      type: 'tool',
      visibility: 'public',
      billingPeriod: 'one_time',
      price: 150000,
      active: true,
      plans: [{
        code: 'FULL', name: 'Paket Lengkap', price: 150000,
        billingPeriod: 'one_time', durationDays: null, isActive: true
      }]
    });
    visible.downloadSourceUrl = 'https://private.example/file.zip';
    visible.courseMaterials = [{
      id: 'secret_material', type: 'ebook', title: 'Materi Privat', url: 'https://private.example/material.pdf'
    }];
    visible.accessUrl = 'https://private.example/member-access';
    visible.externalUrl = 'https://private.example/external-app';
    createProductRecord(store, {
      name: 'Draft', slug: 'draft', type: 'tool', visibility: 'draft',
      billingPeriod: 'one_time', price: 1000,
      plans: [{
        code: 'ONE', name: 'Satu', price: 1000,
        billingPeriod: 'one_time', durationDays: null, isActive: true
      }]
    });
    store.data.plans.push({
      id: 'inactive_plan', productId: visible.id, code: 'OLD', name: 'Lama',
      price: 1000, billingPeriod: 'one_time', durationDays: null,
      isFree: false, isActive: false
    });

    const catalog = listTelegramCatalog(store);

    expect(catalog).toHaveLength(1);
    expect(Object.keys(catalog[0]).sort()).toEqual([
      'category', 'coverUrl', 'description', 'fulfillmentType', 'headline',
      'id', 'logoUrl', 'name', 'plans', 'slug', 'type'
    ]);
    expect(JSON.stringify(catalog)).not.toContain('https://private.example');
    expect(catalog[0].plans).toEqual([
      expect.objectContaining({ code: 'FULL', formattedPrice: 'Rp150.000' })
    ]);
  });

  it('creates one 30-minute checkout for the same buyer product and plan', async () => {
    const store = createMemoryStore();
    await registerTelegramBuyer(store, {
      telegramId: '1001', name: 'Budi', email: 'budi@example.com', whatsapp: '0812'
    });
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro', slug: 'vjstudio-pro', type: 'tool',
      visibility: 'public', billingPeriod: 'monthly', price: 99000, active: true,
      plans: [{
        code: '3M', name: 'Lisensi 3 Bulan', price: 249000,
        billingPeriod: 'monthly', durationDays: 90, isActive: true
      }]
    });
    const plan = store.data.plans.find((item) => item.productId === product.id)!;
    const now = new Date('2026-07-17T08:00:00.000Z');

    const first = await createTelegramCheckout(store, {
      telegramId: '1001', productId: product.id, planId: plan.id
    }, now);
    const second = await createTelegramCheckout(store, {
      telegramId: '1001', productId: product.id, planId: plan.id
    }, now);

    expect(second.id).toBe(first.id);
    expect(first.expiresAt).toBe('2026-07-17T08:30:00.000Z');
    expect(first.amount).toBe(249000);
    expect(first.uniqueCode).toBeGreaterThanOrEqual(100);
    expect(first.uniqueCode).toBeLessThanOrEqual(999);
    expect(first).toMatchObject({
      planId: plan.id,
      telegramId: '1001',
      paymentProofStatus: 'none'
    });
  });

  it('serializes concurrent checkout attempts into one pending invoice', async () => {
    const store = createMemoryStore();
    await registerTelegramBuyer(store, {
      telegramId: '1001', name: 'Budi', email: 'parallel@example.com', whatsapp: '0812'
    });
    const product = createProductRecord(store, {
      name: 'VJ Studio Pro', slug: 'vjstudio-parallel', type: 'tool',
      visibility: 'public', billingPeriod: 'monthly', price: 99000,
      plans: [{
        code: '3M', name: 'Lisensi 3 Bulan', price: 249000,
        billingPeriod: 'monthly', durationDays: 90, isActive: true
      }]
    });
    const plan = store.data.plans.find((item) => item.productId === product.id)!;
    const input = { telegramId: '1001', productId: product.id, planId: plan.id };
    const now = new Date('2026-07-17T08:00:00.000Z');

    const [first, second] = await Promise.all([
      createTelegramCheckout(store, input, now),
      createTelegramCheckout(store, input, now)
    ]);

    expect(second.id).toBe(first.id);
    expect(store.data.orders).toHaveLength(1);
    expect(new Set(store.data.orders.map((order) => order.invoiceNumber)).size).toBe(1);
    expect(store.data.auditLogs.filter((item) => item.action === 'telegram.checkout.created')).toHaveLength(1);
    expect(store.data.auditLogs.at(-1)).toMatchObject({ actorId: '1001', targetType: 'order', targetId: first.id });
  });

  it('accepts proof only from its buyer and reviews identical approval once', () => {
    const store = createMemoryStore({
      members: [{ id: 'm1', name: 'Buyer', email: 'b@example.com', passwordHash: 'x', active: true, telegramId: 'buyer-1', createdAt: '2026-07-17T00:00:00Z' }],
      products: [{ id: 'p1', name: 'Tool', slug: 'tool', type: 'tool', billingPeriod: 'one_time', price: 1000, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' }],
      orders: [{ id: 'o1', memberId: 'm1', productId: 'p1', invoiceNumber: 'INV-1', amount: 1000, status: 'pending', qrisPayload: 'q', expiresAt: '2026-07-17T08:30:00Z', createdAt: '2026-07-17T08:00:00Z' }]
    });
    const submitted = submitPaymentProof(store, { telegramId: 'buyer-1', invoiceNumber: 'INV-1', fileId: 'file-1' }, new Date('2026-07-17T08:10:00Z'));
    submitPaymentProof(store, { telegramId: 'buyer-1', invoiceNumber: 'INV-1', fileId: 'file-1' }, new Date('2026-07-17T08:10:30Z'));
    expect(submitted.paymentProofStatus).toBe('submitted');
    expect(() => submitPaymentProof(store, { telegramId: 'buyer-2', invoiceNumber: 'INV-1', fileId: 'stolen' })).toThrow('order tidak ditemukan');
    const first = reviewPaymentProof(store, { ownerTelegramId: 'owner', invoiceNumber: 'INV-1', decision: 'approve' }, new Date('2026-07-17T08:11:00Z'));
    const second = reviewPaymentProof(store, { ownerTelegramId: 'owner', invoiceNumber: 'INV-1', decision: 'approve' }, new Date('2026-07-17T08:12:00Z'));
    expect(second.order.id).toBe(first.order.id);
    expect(store.data.subscriptions).toHaveLength(1);
    expect(listSubmittedPaymentProofs(store)).toHaveLength(0);
    expect(store.data.auditLogs.filter((item) => item.action === 'telegram.payment_proof.submitted')).toHaveLength(1);
    expect(store.data.auditLogs.filter((item) => item.action === 'telegram.payment_proof.approved')).toHaveLength(1);
  });

  it('requires reopening an expired submitted invoice before approval', () => {
    const store = createMemoryStore({
      members: [{ id: 'm1', name: 'Buyer', email: 'b@example.com', passwordHash: 'x', active: true, telegramId: 'buyer-1', createdAt: '' }],
      products: [{ id: 'p1', name: 'Tool', slug: 'tool', type: 'tool', billingPeriod: 'one_time', price: 1000, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' }],
      orders: [{ id: 'o1', memberId: 'm1', productId: 'p1', invoiceNumber: 'INV-X', amount: 1000, status: 'expired', qrisPayload: 'q', paymentProofFileId: 'file', paymentProofStatus: 'submitted', paymentProofSubmittedAt: '2026-07-17T08:20:00Z', createdAt: '' }]
    });
    expect(() => reviewPaymentProof(store, { ownerTelegramId: 'owner', invoiceNumber: 'INV-X', decision: 'approve' })).toThrow('invoice harus dibuka kembali');
    const reopened = reopenTelegramInvoice(store, { ownerTelegramId: 'owner', invoiceNumber: 'INV-X' }, new Date('2026-07-17T09:00:00Z'));
    expect(reopened.expiresAt).toBe('2026-07-17T09:30:00.000Z');
    expect(reopened.paymentProofSubmittedAt).toBe('2026-07-17T08:20:00Z');
  });
});

describe('Telegram owner product management', () => {
  it('creates a draft product with one active plan and fulfillment type', () => {
    const store = createMemoryStore();
    const result = createTelegramProduct(store, {
      name: 'Mixer Pro', slug: 'mixer-pro', fulfillmentType: 'license',
      description: 'Mixer audio', status: 'draft',
      plan: { code: '1M', name: '1 Bulan', price: 59000, durationDays: 30 }
    }, 'owner');

    expect(result.product.visibility).toBe('draft');
    expect(result.product.fulfillmentType).toBe('license');
    expect(result.plan).toMatchObject({ price: 59000, isActive: true });
    expect(store.data.auditLogs.at(-1)).toMatchObject({
      actorId: 'owner', action: 'telegram.product.created', targetType: 'product', targetId: result.product.id
    });
  });

  it('deactivates a product without deleting order history', () => {
    const store = createMemoryStore({
      products: [{ id: 'product_1', name: 'Tool', slug: 'tool', type: 'tool', billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' }],
      orders: [{ id: 'order_1', memberId: 'member_1', productId: 'product_1', invoiceNumber: 'INV-1', amount: 1, status: 'paid', qrisPayload: 'q', createdAt: '' }]
    });

    deactivateTelegramProduct(store, 'product_1');

    expect(store.data.products[0]).toMatchObject({ active: false, visibility: 'draft' });
    expect(store.data.orders).toHaveLength(1);
  });

  it('updates future plan price without changing existing order amounts', () => {
    const store = createMemoryStore({
      plans: [{ id: 'plan_1', productId: 'product_1', code: 'ONE', name: 'One', price: 1000, billingPeriod: 'one_time', durationDays: null, isFree: false, isActive: true }],
      orders: [{ id: 'order_1', memberId: 'member_1', productId: 'product_1', planId: 'plan_1', invoiceNumber: 'INV-1', amount: 1000, totalAmount: 1123, status: 'pending', qrisPayload: 'q', createdAt: '' }]
    });

    updateTelegramPlan(store, 'plan_1', { price: 2000 });

    expect(store.data.plans[0].price).toBe(2000);
    expect(store.data.orders[0]).toMatchObject({ amount: 1000, totalAmount: 1123 });
  });
});
