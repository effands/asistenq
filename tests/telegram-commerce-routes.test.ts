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
  it('lets only the owner create products without exposing a download source', async () => {
    const payload = {
      name: 'Digital Pack', slug: 'digital-pack', fulfillmentType: 'download',
      description: 'Files', status: 'draft', downloadSourceUrl: 'https://private.example.com/pack.zip',
      plan: { code: 'FULL', name: 'Full', price: 50000, durationDays: null }
    };
    expect((await botRequest('post', '/api/bot/owner/products').send(payload)).status).toBe(403);
    const response = await botRequest('post', '/api/bot/owner/products', ownerId).send(payload);
    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toContain('private.example.com');
    expect(store.data.products[0].downloadSourceUrl).toBe(payload.downloadSourceUrl);
  });

  it('accepts only a ZIP document for a download product and keeps its path private', async () => {
    const product = createProductRecord(store, {
      name: 'ZIP Pack', slug: 'zip-pack', type: 'tool', fulfillmentType: 'download',
      visibility: 'draft', billingPeriod: 'one_time', price: 1000
    });
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const response = await request(app).post(`/api/bot/owner/products/${product.id}/digital-file`)
      .set('x-asistenq-bot-secret', botSecret).set('x-telegram-user-id', ownerId)
      .attach('file', zipHeader, { filename: 'pack.zip', contentType: 'application/zip' });
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('digital-products');
    expect(store.data.products[0].downloadSourceUrl).toMatch(/digital-products[\\/]\S+\.zip$/);
  });
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

  it('does not let Telegram registration take over an existing email account', async () => {
    const response = await botRequest('post', '/api/bot/buyer/register', 'attacker')
      .send({ name: 'Attacker', email: 'buyer1@example.com', whatsapp: '0899999999' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('email sudah terhubung ke akun Telegram lain');
    expect(store.data.members[0].telegramId).toBe('buyer-1');
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

  it('keeps payment proof ownership and owner review boundaries', async () => {
    store.data.products.push({ id: 'p', name: 'Tool', slug: 'tool', type: 'tool', fulfillmentType: 'license', billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' });
    store.data.orders.push({ id: 'o', memberId: 'member-buyer-1', productId: 'p', invoiceNumber: 'INV-PROOF', amount: 1, status: 'pending', qrisPayload: 'q', expiresAt: '2099-01-01T00:00:00Z', createdAt: '' });
    const stolen = await botRequest('post', '/api/bot/buyer/payment-proof', 'buyer-2').send({ invoiceNumber: 'INV-PROOF', fileId: 'stolen' });
    expect(stolen.status).toBe(400);
    expect(store.data.orders[0].paymentProofFileId).toBeUndefined();
    expect((await botRequest('post', '/api/bot/buyer/payment-proof').send({ invoiceNumber: 'INV-PROOF', fileId: 'photo-1' })).status).toBe(200);
    const listed = await botRequest('get', '/api/bot/owner/payment-proofs', ownerId);
    expect(listed.body.orders[0]).toMatchObject({ invoiceNumber: 'INV-PROOF', paymentProofFileId: 'photo-1' });
    const reviewed = await botRequest('post', '/api/bot/owner/payment-proofs/INV-PROOF/review', ownerId).send({ decision: 'approve' });
    expect(reviewed.body.order).not.toHaveProperty('paymentProofFileId');
    expect(store.data.orders[0].status).toBe('paid');
  });

  it('fulfills a paid license only for the authenticated order owner', async () => {
    store.data.products.push({ id: 'p', name: 'Tool', slug: 'tool', type: 'tool', fulfillmentType: 'license', billingPeriod: 'monthly', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' });
    store.data.plans.push({ id: 'plan', productId: 'p', code: 'ONE', name: 'One', price: 1, billingPeriod: 'monthly', durationDays: 30, isFree: false, isActive: true });
    store.data.orders.push({ id: 'o', memberId: 'member-buyer-1', productId: 'p', planId: 'plan', invoiceNumber: 'INV-LIC', amount: 1, status: 'paid', qrisPayload: 'q', createdAt: '' });
    expect((await botRequest('post', '/api/bot/buyer/orders/INV-LIC/hwid', 'buyer-2').send({ hwid: 'ABCDEF1234567890' })).status).toBe(400);
    const issued = await botRequest('post', '/api/bot/buyer/orders/INV-LIC/hwid').send({ hwid: 'ABCDEF1234567890' });
    expect(issued.status).toBe(201);
    expect(issued.body).toMatchObject({ orderId: 'o', planId: 'plan' });
  });

  it('issues a download without exposing its source URL', async () => {
    store.data.products.push({ id: 'p', name: 'File', slug: 'file', type: 'tool', fulfillmentType: 'download', downloadSourceUrl: 'https://files.example.com/private.zip', billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' });
    store.data.orders.push({ id: 'o', memberId: 'member-buyer-1', productId: 'p', invoiceNumber: 'INV-DL', amount: 1, status: 'paid', qrisPayload: 'q', createdAt: '' });
    const response = await botRequest('post', '/api/bot/buyer/orders/INV-DL/download');
    expect(response.status).toBe(201);
    expect(response.body.downloadUrl).toMatch(/\/api\/download\//);
    expect(JSON.stringify(response.body)).not.toContain('files.example.com');
    expect(JSON.stringify(store.data.downloadGrants)).not.toContain(response.body.downloadUrl.split('/').pop());
  });
});
