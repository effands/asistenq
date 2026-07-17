import { describe, expect, it } from 'vitest';
import {
  createTelegramCheckout,
  listTelegramCatalog,
  registerTelegramBuyer
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

  it('links an existing unlinked member by normalized email', async () => {
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

    const member = await registerTelegramBuyer(store, {
      telegramId: '1001', name: 'Nama Baru', email: ' BUYER@example.com ', whatsapp: '0812'
    });

    expect(member).toMatchObject({
      id: 'member_existing', telegramId: '1001', name: 'Nama Baru', whatsapp: '0812'
    });
    expect(store.data.members).toHaveLength(1);
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
    expect(catalog[0]).not.toHaveProperty('downloadSourceUrl');
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
});
