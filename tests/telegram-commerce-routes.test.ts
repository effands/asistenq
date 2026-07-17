import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, store } from '../src/server/index';
import { createProductRecord } from '../src/server/services';

const botSecret = 'test-bot-secret';
const ownerId = 'owner-1';

function botRequest(method: 'get' | 'post', path: string, telegramId = 'buyer-1') {
  return request(app)[method](path)
    .set('x-asistenq-bot-secret', botSecret)
    .set('x-telegram-user-id', telegramId);
}

beforeEach(() => {
  store.reset();
  store.data.deploymentSettings = {
    githubRepo: 'effands/asistenq',
    githubBranch: 'master',
    qrisStaticPayload: store.data.deploymentSettings?.qrisStaticPayload,
    botApiSecret: botSecret,
    telegramOwnerId: ownerId
  };
  store.data.members.push(
    {
      id: 'member-buyer-1', name: 'Buyer One', email: 'buyer1@example.com',
      whatsapp: '0811111111', telegramId: 'buyer-1', passwordHash: 'hash',
      active: true, createdAt: '2026-07-17T00:00:00.000Z'
    },
    {
      id: 'member-buyer-2', name: 'Buyer Two', email: 'buyer2@example.com',
      whatsapp: '0822222222', telegramId: 'buyer-2', passwordHash: 'hash',
      active: true, createdAt: '2026-07-17T00:00:00.000Z'
    }
  );
});

describe('Telegram commerce API boundaries', () => {
  it('requires the bot secret and Telegram identity on buyer routes', async () => {
    const noSecret = await request(app)
      .get('/api/bot/buyer/products')
      .set('x-telegram-user-id', 'buyer-1');
    expect(noSecret.status).toBe(403);

    const noIdentity = await request(app)
      .get('/api/bot/buyer/products')
      .set('x-asistenq-bot-secret', botSecret);
    expect(noIdentity.status).toBe(400);
  });

  it('rejects an owner route for a non-owner Telegram ID', async () => {
    const response = await botRequest('get', '/api/bot/owner/payment-proofs');

    expect(response.status).toBe(403);
  });

  it.each([
    ['get', '/api/bot/admin-summary'],
    ['get', '/api/bot/orders'],
    ['post', '/api/bot/orders/paid'],
    ['post', '/api/bot/license-generate'],
    ['post', '/api/bot/license-send'],
    ['get', '/api/bot/banned'],
    ['post', '/api/bot/ban-hwid'],
    ['post', '/api/bot/unban-hwid'],
    ['post', '/api/bot/deploy-update']
  ] as const)('protects owner operation %s %s', async (method, path) => {
    const response = await botRequest(method, path);

    expect(response.status).toBe(403);
  });

  it('registers a buyer using the authenticated Telegram ID', async () => {
    const response = await botRequest('post', '/api/bot/buyer/register', 'buyer-new')
      .send({ name: 'Buyer Baru', email: 'baru@example.com', whatsapp: '0833333333' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ telegramId: 'buyer-new', email: 'baru@example.com' });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('returns only safe catalog fields without private download sources', async () => {
    const product = createProductRecord(store, {
      name: 'File Digital', slug: 'file-digital', type: 'tool', visibility: 'public',
      billingPeriod: 'one_time', price: 50000, active: true,
      plans: [{
        code: 'FULL', name: 'Full', price: 50000, billingPeriod: 'one_time',
        durationDays: null, isActive: true
      }]
    });
    product.downloadSourceUrl = 'https://private.example/source.zip';
    product.accessUrl = 'https://private.example/member';

    const response = await botRequest('get', '/api/bot/buyer/products');

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain('private.example');
  });

  it('creates checkout for the authenticated buyer instead of a body identity', async () => {
    const product = createProductRecord(store, {
      name: 'Lisensi', slug: 'lisensi', type: 'tool', visibility: 'public',
      billingPeriod: 'one_time', price: 75000, active: true,
      plans: [{
        code: 'ONE', name: 'Satu', price: 75000, billingPeriod: 'one_time',
        durationDays: null, isActive: true
      }]
    });
    const plan = store.data.plans.find((item) => item.productId === product.id)!;

    const response = await botRequest('post', '/api/bot/buyer/checkout')
      .send({ productId: product.id, planId: plan.id, telegramId: 'buyer-2' });

    expect(response.status).toBe(201);
    expect(store.data.orders[0].memberId).toBe('member-buyer-1');
    expect(response.body.telegramId).toBe('buyer-1');
    expect(JSON.stringify(response.body)).not.toContain('downloadSourceUrl');
  });

  it('returns only orders owned by the buyer Telegram ID', async () => {
    store.data.orders.push(
      {
        id: 'order-1', memberId: 'member-buyer-1', productId: 'product-1',
        invoiceNumber: 'INV-BUYER-1', amount: 10000, status: 'pending', qrisPayload: 'qris-1',
        createdAt: '2026-07-17T00:00:00.000Z'
      },
      {
        id: 'order-2', memberId: 'member-buyer-2', productId: 'product-2',
        invoiceNumber: 'INV-BUYER-2', amount: 20000, status: 'pending', qrisPayload: 'qris-2',
        createdAt: '2026-07-17T00:00:00.000Z'
      }
    );

    const response = await botRequest('get', '/api/bot/buyer/orders');

    expect(response.status).toBe(200);
    expect(response.body.orders.map((order: { invoiceNumber: string }) => order.invoiceNumber))
      .toEqual(['INV-BUYER-1']);
  });
});
