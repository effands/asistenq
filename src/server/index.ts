import cors from 'cors';
import express from 'express';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { createId, formatCurrency } from '../shared/domain';
import { signSession, requireAdminScope, requireSession } from './auth';
import { seedInitialData } from './seed';
import {
  adminLicenseDashboard,
  activateLicense,
  banHwid,
  createAdmin,
  createCheckout,
  createMember,
  createProductRecord,
  generateToolLicense,
  markOrderPaid,
  memberLicenseDashboard,
  publicCatalog,
  publicPlansForProduct,
  requestPasswordReset,
  resetPassword,
  resetLicenseDevice,
  unbanHwid,
  verifyLicense,
  verifyAdminLogin,
  verifyMemberLogin,
  verifyVoucher
} from './services';
import { createFileStore } from './store';

const app = express();
const store = createFileStore();
const port = Number(process.env.API_PORT ?? 4000);
const isProduction = process.env.NODE_ENV === 'production';
const publicDir = path.resolve(process.cwd(), 'dist');
const hasBuiltFrontend = fs.existsSync(path.join(publicDir, 'index.html'));
const shouldServeFrontend = isProduction || hasBuiltFrontend;
const execAsync = promisify(exec);

if (!isProduction) {
  app.use(cors({ origin: ['http://127.0.0.1:3000', 'http://localhost:3000'] }));
}

app.use(express.json());

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const memberRegisterSchema = loginSchema.extend({
  name: z.string().min(2),
  whatsapp: z.string().min(8),
  telegramId: z.string().min(3)
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
  accountType: z.enum(['admin', 'member']).default('member')
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  accountType: z.enum(['admin', 'member']).default('member'),
  password: z.string().min(8)
});

const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  type: z.enum(['tool', 'course', 'ebook', 'video', 'bundle', 'free', 'class']),
  billingPeriod: z.enum(['trial', 'monthly', 'annual', 'lifetime', 'one_time']),
  price: z.number().int().nonnegative(),
  headline: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  accessUrl: z.string().optional()
});

const adminCreateSchema = memberRegisterSchema.extend({
  role: z.enum(['super_admin', 'admin']),
  scopes: z.array(z.enum(['admins', 'products', 'members', 'orders', 'subscriptions', 'content']))
});

const licenseProductQuerySchema = z.object({
  product: z.string().min(1)
});

const voucherQuerySchema = licenseProductQuerySchema.extend({
  code: z.string().min(1)
});

const generateLicenseSchema = z.object({
  productSlug: z.string().min(1),
  planCode: z.string().min(1),
  email: z.string().email(),
  hwid: z.string().min(1)
});

const licenseTokenSchema = z.object({
  productSlug: z.string().min(1),
  token: z.string().min(1),
  hwid: z.string().min(1)
});

const resetLicenseSchema = z.object({
  licenseId: z.string().min(1),
  newHwid: z.string().min(1)
});

const hwidActionSchema = z.object({
  productSlug: z.string().min(1),
  hwid: z.string().min(1),
  reason: z.string().default('')
});

const toolEventSchema = z.object({
  productSlug: z.string().min(1),
  eventType: z.string().min(1),
  hwid: z.string().optional(),
  email: z.string().email().optional(),
  message: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

const deploymentSettingsSchema = z.object({
  githubToken: z.string().optional(),
  githubRepo: z.string().min(3).default('effands/asistenq'),
  githubBranch: z.string().min(1).default('master')
});

function publicProduct(product: typeof store.data.products[number]) {
  return {
    ...product,
    formattedPrice: formatCurrency(product.price)
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'AsistenQ' });
});

function handleLegacyActivation(req: express.Request, res: express.Response) {
  const query = z.object({
    token: z.string().min(1),
    hwid: z.string().min(1)
  }).parse(req.query);

  try {
    res.json(activateLicense(store, {
      productSlug: 'vjstudio',
      token: query.token,
      hwid: query.hwid
    }));
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Invalid parameters'
    });
  }
}

app.get('/activate', handleLegacyActivation);
app.get('/api/activate', handleLegacyActivation);

app.get('/packages', (_req, res) => {
  res.json(publicPlansForProduct(store, 'vjstudio'));
});

app.get('/api/packages', (_req, res) => {
  res.json(publicPlansForProduct(store, 'vjstudio'));
});

app.get('/announcement', (_req, res) => {
  const product = store.data.products.find((item) => item.slug === 'vjstudio');
  const announcement = store.data.announcements.find((item) => item.productId === product?.id && item.enabled);

  res.json(announcement ?? {});
});

app.get('/api/announcement', (_req, res) => {
  const product = store.data.products.find((item) => item.slug === 'vjstudio');
  const announcement = store.data.announcements.find((item) => item.productId === product?.id && item.enabled);

  res.json(announcement ?? {});
});

app.get('/banned', (_req, res) => {
  const product = store.data.products.find((item) => item.slug === 'vjstudio');
  const banned = store.data.bannedHwids
    .filter((item) => item.productId === product?.id)
    .map((item) => item.hwid);

  res.type('text/plain').send(banned.join('\n'));
});

app.get('/api/banned', (_req, res) => {
  const product = store.data.products.find((item) => item.slug === 'vjstudio');
  const banned = store.data.bannedHwids
    .filter((item) => item.productId === product?.id)
    .map((item) => item.hwid);

  res.type('text/plain').send(banned.join('\n'));
});

app.get('/verify_voucher', (req, res) => {
  const query = z.object({
    code: z.string().min(1)
  }).parse(req.query);

  res.json(verifyVoucher(store, {
    productSlug: 'vjstudio',
    code: query.code
  }));
});

app.get('/api/verify_voucher', (req, res) => {
  const query = z.object({
    code: z.string().min(1)
  }).parse(req.query);

  res.json(verifyVoucher(store, {
    productSlug: 'vjstudio',
    code: query.code
  }));
});

app.post('/api/admin/login', async (req, res) => {
  const body = loginSchema.parse(req.body);
  const admin = await verifyAdminLogin(store, body.email, body.password);
  const token = signSession({
    id: admin.id,
    email: admin.email,
    type: 'admin',
    role: admin.role,
    scopes: admin.scopes
  });

  res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, scopes: admin.scopes } });
});

app.post('/api/member/register', async (req, res) => {
  const body = memberRegisterSchema.parse(req.body);
  const member = await createMember(store, body);
  const token = signSession({ id: member.id, email: member.email, type: 'member' });

  res.status(201).json({ token, user: { id: member.id, name: member.name, email: member.email } });
});

app.post('/api/member/login', async (req, res) => {
  const body = loginSchema.parse(req.body);
  const member = await verifyMemberLogin(store, body.email, body.password);
  const token = signSession({ id: member.id, email: member.email, type: 'member' });

  res.json({ token, user: { id: member.id, name: member.name, email: member.email } });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const body = forgotPasswordSchema.parse(req.body);
  const result = await requestPasswordReset(store, body);
  const showResetLink = !isProduction || process.env.SHOW_RESET_LINKS === 'true';

  res.json({
    ok: true,
    message: 'Jika email terdaftar, instruksi reset password sudah disiapkan.',
    ...(showResetLink && result.resetUrl ? { resetUrl: result.resetUrl, expiresAt: result.expiresAt } : {})
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const body = resetPasswordSchema.parse(req.body);
  await resetPassword(store, body);
  res.json({ ok: true, message: 'Password berhasil diganti. Silakan login kembali.' });
});

app.get('/api/products', (_req, res) => {
  res.json(store.data.products.filter((product) => product.active).map(publicProduct));
});

app.get('/api/catalog', (_req, res) => {
  res.json(publicCatalog(store));
});

app.get('/api/products/:slug', (req, res) => {
  const product = store.data.products.find((item) => item.slug === req.params.slug && item.active);

  if (!product) {
    res.status(404).json({ message: 'product not found' });
    return;
  }

  res.json(publicProduct(product));
});

app.get('/api/license/packages', (req, res) => {
  const query = licenseProductQuerySchema.parse(req.query);
  res.json(publicPlansForProduct(store, query.product));
});

app.get('/api/license/announcement', (req, res) => {
  const query = licenseProductQuerySchema.parse(req.query);
  const product = store.data.products.find((item) => item.slug === query.product);
  const announcement = store.data.announcements.find((item) => item.productId === product?.id && item.enabled);

  res.json(announcement ?? {});
});

app.get('/api/license/banned', (req, res) => {
  const query = licenseProductQuerySchema.parse(req.query);
  const product = store.data.products.find((item) => item.slug === query.product);
  const banned = store.data.bannedHwids
    .filter((item) => item.productId === product?.id)
    .map((item) => item.hwid);

  res.type('text/plain').send(banned.join('\n'));
});

app.get('/api/license/verify-voucher', (req, res) => {
  const query = voucherQuerySchema.parse(req.query);
  res.json(verifyVoucher(store, {
    productSlug: query.product,
    code: query.code
  }));
});

app.post('/api/license/activate', (req, res) => {
  const body = licenseTokenSchema.parse(req.body);
  res.json(activateLicense(store, body));
});

app.post('/api/license/verify', (req, res) => {
  const body = licenseTokenSchema.parse(req.body);
  res.json(verifyLicense(store, body));
});

app.post('/api/tool-events', (req, res) => {
  const eventSecret = process.env.TOOL_EVENT_SECRET;
  if (eventSecret && req.header('x-asistenq-tool-secret') !== eventSecret) {
    res.status(403).json({ message: 'invalid tool event secret' });
    return;
  }

  const body = toolEventSchema.parse(req.body);
  store.data.auditLogs.push({
    id: createId('audit'),
    actorId: body.email ?? body.hwid ?? 'anonymous-tool',
    action: `tool:${body.eventType}`,
    targetType: body.productSlug,
    targetId: body.hwid ?? body.email ?? body.productSlug,
    createdAt: new Date().toISOString()
  });
  store.save();

  res.status(201).json({ ok: true, message: 'Tool event received' });
});

app.post('/api/license/generate', requireSession, requireAdminScope('products'), (req, res) => {
  const body = generateLicenseSchema.parse(req.body);
  res.status(201).json(generateToolLicense(store, body));
});

app.post('/api/license/reset-device', requireSession, requireAdminScope('products'), (req, res) => {
  const body = resetLicenseSchema.parse(req.body);
  res.json(resetLicenseDevice(store, body));
});

app.post('/api/license/ban-hwid', requireSession, requireAdminScope('products'), (req, res) => {
  const body = hwidActionSchema.parse(req.body);
  res.status(201).json(banHwid(store, body));
});

app.post('/api/license/unban-hwid', requireSession, requireAdminScope('products'), (req, res) => {
  const body = hwidActionSchema.omit({ reason: true }).parse(req.body);
  res.json(unbanHwid(store, body));
});

app.get('/api/admin/summary', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json({
    products: store.data.products.length,
    members: store.data.members.length,
    orders: store.data.orders.length,
    activeSubscriptions: store.data.subscriptions.filter((item) => item.status === 'active').length
  });
});

app.post('/api/admin/reset-operational-data', requireSession, requireAdminScope('products'), (_req, res) => {
  store.data.orders = [];
  store.data.subscriptions = [];
  store.data.licenses = [];
  store.data.bannedHwids = [];
  store.data.vouchers = [];
  store.data.passwordResets = [];
  store.data.auditLogs = [];
  store.save();

  res.json({ ok: true, message: 'Data operasional berhasil direset.' });
});

app.get('/api/admin/admins', requireSession, requireAdminScope('admins'), (_req, res) => {
  res.json(store.data.admins.map(({ passwordHash: _passwordHash, ...admin }) => admin));
});

app.post('/api/admin/admins', requireSession, requireAdminScope('admins'), async (req, res) => {
  const body = adminCreateSchema.parse(req.body);
  const admin = await createAdmin(store, {
    actor: { role: req.user?.role ?? 'admin', scopes: req.user?.scopes ?? [] },
    ...body
  });
  const { passwordHash: _passwordHash, ...safeAdmin } = admin;

  res.status(201).json(safeAdmin);
});

app.get('/api/admin/products', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json(store.data.products.map(publicProduct));
});

app.get('/api/admin/members', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json(store.data.members.map(({ passwordHash: _passwordHash, ...member }) => {
    const memberOrders = store.data.orders.filter((order) => order.memberId === member.id);
    return {
      ...member,
      licenseCount: store.data.licenses.filter((license) => license.email === member.email).length,
      orderCount: memberOrders.length,
      subscriptionCount: store.data.subscriptions.filter((subscription) => subscription.memberId === member.id).length,
      latestOrder: memberOrders.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    };
  }));
});

app.get('/api/admin/licenses', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json(adminLicenseDashboard(store));
});

app.post('/api/admin/products', requireSession, requireAdminScope('products'), (req, res) => {
  const body = productSchema.parse(req.body);
  const product = createProductRecord(store, body);

  res.status(201).json(publicProduct(product));
});

function maskedSecret(value?: string): string {
  if (!value) return '';
  if (value.length <= 10) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function hideSecret(text: string, secret: string): string {
  return secret ? text.replaceAll(secret, '***') : text;
}

app.get('/api/admin/deploy/settings', requireSession, requireAdminScope('products'), (_req, res) => {
  const settings = store.data.deploymentSettings ?? {};
  const token = settings.githubToken ?? process.env.GITHUB_TOKEN ?? '';
  res.json({
    githubRepo: settings.githubRepo ?? 'effands/asistenq',
    githubBranch: settings.githubBranch ?? 'master',
    hasGithubToken: Boolean(token),
    maskedGithubToken: maskedSecret(token),
    updatedAt: settings.updatedAt
  });
});

app.post('/api/admin/deploy/settings', requireSession, requireAdminScope('products'), (req, res) => {
  const parsed = deploymentSettingsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: 'Data GitHub belum lengkap. Cek repository, branch, dan token.' });
    return;
  }

  const body = parsed.data;
  const current = store.data.deploymentSettings ?? {};
  const nextToken = body.githubToken?.trim() || current.githubToken || process.env.GITHUB_TOKEN || '';

  try {
    store.data.deploymentSettings = {
      githubRepo: body.githubRepo.trim(),
      githubBranch: body.githubBranch.trim(),
      githubToken: nextToken,
      updatedAt: new Date().toISOString()
    };
    store.save();

    res.json({
      ok: true,
      message: 'Token GitHub tersimpan.',
      githubRepo: store.data.deploymentSettings.githubRepo,
      githubBranch: store.data.deploymentSettings.githubBranch,
      hasGithubToken: Boolean(nextToken),
      maskedGithubToken: maskedSecret(nextToken),
      updatedAt: store.data.deploymentSettings.updatedAt
    });
  } catch (error) {
    res.status(500).json({
      message: 'Token gagal disimpan ke data server.',
      detail: error instanceof Error ? error.message : 'unknown save error'
    });
  }
});

app.post('/api/admin/deploy/update', requireSession, requireAdminScope('products'), async (_req, res) => {
  const settings = store.data.deploymentSettings ?? {};
  const githubToken = settings.githubToken ?? process.env.GITHUB_TOKEN ?? '';
  const githubRepo = settings.githubRepo ?? 'effands/asistenq';
  const githubBranch = settings.githubBranch ?? 'master';
  const remote = githubToken
    ? `https://${encodeURIComponent(githubToken)}@github.com/${githubRepo}.git`
    : 'origin';
  const command = `git pull ${remote} ${githubBranch} && npm install --include=dev && npm run build`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 180000,
      maxBuffer: 1024 * 1024
    });

    res.json({
      ok: true,
      message: 'Update selesai. Restart aplikasi Node.js dari panel hosting agar proses memakai build terbaru.',
      stdout: hideSecret(stdout, githubToken),
      stderr: hideSecret(stderr, githubToken)
    });
  } catch (error) {
    const detail = hideSecret(error instanceof Error ? error.message : 'deploy failed', githubToken);
    res.status(500).json({
      ok: false,
      message: 'Update gagal. Cek log untuk detail.',
      detail
    });
  }
});

app.get('/api/admin/orders', requireSession, requireAdminScope('orders'), (_req, res) => {
  res.json(store.data.orders);
});

app.post('/api/admin/orders/:id/paid', requireSession, requireAdminScope('orders'), (req, res) => {
  res.json(markOrderPaid(store, String(req.params.id)));
});

app.post('/api/checkout', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  const body = z.object({ productId: z.string() }).parse(req.body);
  res.status(201).json(createCheckout(store, req.user.id, body.productId));
});

app.get('/api/member/licenses', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  res.json(memberLicenseDashboard(store, req.user.id));
});

if (shouldServeFrontend) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

seedInitialData(store).then(() => {
  app.listen(port, () => {
    console.log(`AsistenQ running on port ${port}`);
  });
});
