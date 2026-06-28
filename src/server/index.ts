import cors from 'cors';
import express from 'express';
import AdmZip from 'adm-zip';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';
import { createId, formatCurrency } from '../shared/domain';
import { clearSessionCookie, readSession, sessionCookie, signSession, requireAdminScope, requireSession } from './auth';
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
  updateProductRecord,
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
const cpanelNodeBin = path.join(process.env.HOME ?? '', 'nodevenv/repositories/asistenq/20/bin');

if (!isProduction) {
  app.use(cors({ origin: ['http://127.0.0.1:3000', 'http://localhost:3000'] }));
}

app.use(express.json());

const landingImportDir = path.resolve('data/landing-imports');
const bundledLandingDir = path.resolve('landings');
const bundledToolDir = path.resolve('tools-dist');
const ignoredLandingZipPaths = [
  /^node_modules\//,
  /^src\//,
  /^\.git\//,
  /^\.env(?:\.|$)/,
  /^package(?:-lock)?\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^tsconfig(?:\..*)?\.json$/,
  /^vite\.config\./,
  /^README(?:\..*)?$/i,
  /^metadata\.json$/
];

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\/+/, '');
}

function shouldIgnoreLandingEntry(entryName: string): boolean {
  return ignoredLandingZipPaths.some((pattern) => pattern.test(entryName));
}

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
  visibility: z.enum(['public', 'private', 'draft']).optional(),
  accessMode: z.enum(['public', 'free_member', 'trial', 'paid', 'admin']).optional(),
  billingPeriod: z.enum(['trial', 'monthly', 'annual', 'lifetime', 'one_time']),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional(),
  discountLabel: z.string().optional(),
  promoText: z.string().optional(),
  logoUrl: z.string().optional(),
  landingPath: z.string().regex(/^\/[a-z0-9-]+$/).optional(),
  landingTemplate: z.string().optional(),
  ctaLabel: z.string().optional(),
  accessRequirement: z.string().optional(),
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
  hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, 'HWID harus tepat 16 karakter huruf/angka.')
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

function publicOrder(order: typeof store.data.orders[number]) {
  const product = store.data.products.find((item) => item.id === order.productId);
  return {
    ...order,
    product: product ? publicProduct(product) : undefined,
    formattedAmount: formatCurrency(order.amount),
    formattedTotalAmount: formatCurrency(order.totalAmount ?? order.amount)
  };
}

function hasActiveProductAccess(memberId: string, productId: string): boolean {
  const now = new Date();
  return store.data.subscriptions.some((subscription) => (
    subscription.memberId === memberId &&
    subscription.productId === productId &&
    subscription.status === 'active' &&
    new Date(subscription.endsAt) > now
  )) || store.data.orders.some((order) => (
    order.memberId === memberId &&
    order.productId === productId &&
    order.status === 'paid'
  ));
}

function canOpenProduct(req: express.Request, product: typeof store.data.products[number]): boolean {
  const mode = product.accessMode ?? 'public';
  if (mode === 'public') return true;

  const user = readSession(req);
  if (!user) return false;

  if (user.type === 'admin') return true;
  if (mode === 'admin') return false;
  if (mode === 'free_member') return user.type === 'member';

  if (user.type !== 'member') return false;
  return hasActiveProductAccess(user.id, product.id);
}

function sendProductAccessDenied(req: express.Request, res: express.Response, product: typeof store.data.products[number]) {
  const user = readSession(req);
  const target = encodeURIComponent(product.landingPath ?? `/${product.slug}`);
  const action = user
    ? `<a href="/member#produk">Ambil akses di member area</a>`
    : `<a href="/member?next=${target}">Login member dulu</a>`;

  res.status(user ? 403 : 401).send(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Akses Member Dibutuhkan</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#e9fbf5,#f7fff9);font-family:system-ui,sans-serif;color:#082f2a}
      main{max-width:520px;margin:24px;padding:34px;border:1px solid rgba(4,64,56,.16);border-radius:28px;background:rgba(255,255,255,.84);box-shadow:0 24px 70px rgba(4,64,56,.16)}
      h1{margin:0 0 12px;font-size:32px;line-height:1.08}p{color:#55716b;line-height:1.6}a{display:inline-flex;margin-top:14px;padding:14px 18px;border-radius:999px;background:#053b34;color:white;text-decoration:none;font-weight:800}
    </style>
  </head>
  <body><main><h1>Akses tools belum terbuka.</h1><p>${product.accessRequirement ?? 'Silakan login member dan ambil akses produk dulu.'}</p>${action}</main></body>
</html>`);
}

let genAiClient: GoogleGenAI | null = null;
function getGenAiClient() {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Konfigurasi AI belum aktif di server.');
    }
    genAiClient = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'asistenq-tools' } } });
  }
  return genAiClient;
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
  try {
    const body = loginSchema.parse(req.body);
    const admin = await verifyAdminLogin(store, body.email, body.password);
    const token = signSession({
      id: admin.id,
      email: admin.email,
      type: 'admin',
      role: admin.role,
      scopes: admin.scopes
    });

    res.setHeader('Set-Cookie', sessionCookie(token, isProduction));
    res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, scopes: admin.scopes } });
  } catch {
    res.status(401).json({ message: 'Email atau password admin salah.' });
  }
});

app.post('/api/member/register', async (req, res) => {
  try {
    const body = memberRegisterSchema.parse(req.body);
    const member = await createMember(store, body);
    const token = signSession({ id: member.id, email: member.email, type: 'member' });

    res.setHeader('Set-Cookie', sessionCookie(token, isProduction));
    res.status(201).json({ token, user: { id: member.id, name: member.name, email: member.email } });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'register failed' });
  }
});

app.post('/api/member/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const member = await verifyMemberLogin(store, body.email, body.password);
    const token = signSession({ id: member.id, email: member.email, type: 'member' });

    res.setHeader('Set-Cookie', sessionCookie(token, isProduction));
    res.json({ token, user: { id: member.id, name: member.name, email: member.email } });
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : 'login failed' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
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
  res.json(store.data.products.filter((product) => product.active && product.visibility === 'public').map(publicProduct));
});

app.get('/api/catalog', (_req, res) => {
  res.json(publicCatalog(store));
});

app.get('/api/products/:slug', (req, res) => {
  const product = store.data.products.find((item) => item.slug === req.params.slug && item.active && item.visibility === 'public');

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
  try {
    const body = generateLicenseSchema.parse(req.body);
    res.status(201).json(generateToolLicense(store, body));
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'Data lisensi tidak valid.';
    res.status(400).json({ message });
  }
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
    licenses: store.data.licenses.length,
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

app.put('/api/admin/products/:id', requireSession, requireAdminScope('products'), (req, res) => {
  const body = productSchema.partial().parse(req.body);
  const product = updateProductRecord(store, String(req.params.id), body);

  res.json(publicProduct(product));
});

app.post(
  '/api/admin/products/:id/landing-zip',
  requireSession,
  requireAdminScope('products'),
  express.raw({ type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], limit: '25mb' }),
  (req, res) => {
    const product = store.data.products.find((item) => item.id === String(req.params.id));

    if (!product) {
      res.status(404).json({ message: 'product not found' });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ message: 'File ZIP kosong atau tidak terbaca.' });
      return;
    }

    const safeSlug = product.slug.replace(/[^a-z0-9-]/g, '');
    const targetDir = path.join(landingImportDir, safeSlug);
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });

    const zip = new AdmZip(req.body);
    const entries = zip.getEntries();
    const hasBuiltDist = entries.some((entry) => normalizeZipEntryName(entry.entryName) === 'dist/index.html');
    let fileCount = 0;
    let ignoredCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const normalizedName = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!normalizedName || normalizedName.includes('../')) continue;
      const outputName = hasBuiltDist
        ? normalizedName.replace(/^dist\//, '')
        : normalizedName;

      if ((hasBuiltDist && normalizedName === outputName) || shouldIgnoreLandingEntry(outputName)) {
        ignoredCount += 1;
        continue;
      }

      fileCount += 1;

      if (fileCount > 300) {
        res.status(400).json({ message: 'ZIP terlalu besar: maksimal 300 file landing.' });
        return;
      }

      const outputPath = path.resolve(targetDir, outputName);
      if (!outputPath.startsWith(targetDir)) continue;

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, entry.getData());
    }

    if (!fs.existsSync(path.join(targetDir, 'index.html'))) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      res.status(400).json({ message: 'ZIP belum berisi landing siap pakai. Upload folder dist hasil build, atau ZIP yang punya index.html di root.' });
      return;
    }

    product.landingTemplate = 'zip-html';
    product.accessUrl = `/landing-imports/${safeSlug}/index.html`;
    product.updatedAt = new Date().toISOString();
    store.save();

    res.json({
      ok: true,
      message: `Landing ZIP tersimpan untuk ${product.name}.`,
      fileCount,
      ignoredCount,
      url: product.accessUrl
    });
  }
);

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
  const restartCommand = process.platform === 'win32'
    ? 'if not exist tmp mkdir tmp && type nul > tmp\\restart.txt'
    : 'mkdir -p tmp && touch tmp/restart.txt';
  const command = `git pull ${remote} ${githubBranch} && npm install --include=dev && npm run build && ${restartCommand}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 180000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        PATH: fs.existsSync(cpanelNodeBin) ? `${cpanelNodeBin}${path.delimiter}${process.env.PATH ?? ''}` : process.env.PATH
      }
    });

    if (process.env.NODE_ENV === 'production' || process.env.PASSENGER_APP_ENV) {
      res.on('finish', () => {
        setTimeout(() => process.exit(0), 500);
      });
    }

    res.json({
      ok: true,
      message: 'Update selesai. Aplikasi akan restart otomatis.',
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

app.post('/tools/jadwalinaja/api/youtube/upload-thumbnail', express.raw({ type: '*/*', limit: '15mb' }), async (req, res) => {
  try {
    const videoId = String(req.query.videoId ?? '');
    const authHeader = req.header('authorization');
    const contentType = req.header('content-type') || 'image/jpeg';

    if (!videoId) {
      res.status(400).json({ error: 'videoId wajib diisi.' });
      return;
    }

    if (!authHeader) {
      res.status(401).json({ error: 'Login Google YouTube dibutuhkan.' });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'Gambar thumbnail kosong.' });
      return;
    }

    const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': contentType
      },
      body: new Uint8Array(req.body)
    });

    const responseText = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: `YouTube menolak upload thumbnail: ${response.status}`, detail: responseText });
      return;
    }

    res.json({ success: true, data: responseText });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal upload thumbnail.' });
  }
});

app.post('/tools/jadwalinaja/api/gemini/generate', async (req, res) => {
  try {
    const body = z.object({
      topic: z.string().min(1),
      tone: z.string().optional(),
      count: z.number().optional(),
      language: z.string().optional(),
      startNum: z.number().optional(),
      includeEmojis: z.boolean().optional(),
      customTags: z.string().optional(),
      model: z.string().optional(),
      descriptionInstruction: z.string().optional()
    }).parse(req.body);

    const videoCount = Math.min(Math.max(Number(body.count) || 1, 1), 50);
    const startNumber = Number(body.startNum) || 1;
    const targetLang = body.language || 'Indonesian';
    const selectedTone = body.tone || 'Casual & Engaging';
    const emojisPref = body.includeEmojis === undefined ? true : Boolean(body.includeEmojis);
    const modelToUse = body.model || 'gemini-2.5-flash';
    const tagInstruction = body.customTags?.trim()
      ? `Prioritaskan keyword berikut: "${body.customTags.trim()}".`
      : '';
    const descPromoInstruction = body.descriptionInstruction?.trim()
      ? `Tambahkan atau adaptasi instruksi deskripsi berikut: "${body.descriptionInstruction.trim()}".`
      : '';

    const response = await getGenAiClient().models.generateContent({
      model: modelToUse,
      contents: `Buat ${videoCount} draft metadata video YouTube mulai nomor ${startNumber}.
Topik: "${body.topic}"
Tone: "${selectedTone}"
Bahasa: "${targetLang}"
Emoji: ${emojisPref ? 'boleh 1-2 emoji relevan' : 'tanpa emoji'}
${tagInstruction}
${descPromoInstruction}

Untuk setiap item berikan title 85-99 karakter, description 2-5 paragraf, tags 6-10 item, dan isAiGenerated boolean. Output JSON array saja.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              isAiGenerated: { type: Type.BOOLEAN }
            },
            required: ['title', 'description', 'tags', 'isAiGenerated']
          }
        }
      }
    });

    res.json({ videos: JSON.parse((response.text || '[]').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim() || '[]') });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal generate metadata.' });
  }
});

app.post('/tools/jadwalinaja/api/gemini/optimize-single', async (req, res) => {
  try {
    const body = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      isAiGenerated: z.boolean().optional(),
      instruction: z.string().optional(),
      language: z.string().optional(),
      model: z.string().optional()
    }).parse(req.body);
    const targetLang = body.language || 'Indonesian';

    const response = await getGenAiClient().models.generateContent({
      model: body.model || 'gemini-2.5-flash',
      contents: `Optimasi metadata video YouTube berikut dalam bahasa ${targetLang}.
Judul: "${body.title || ''}"
Deskripsi: "${body.description || ''}"
Tags: ${JSON.stringify(body.tags || [])}
Flag konten AI: ${body.isAiGenerated ? 'ya' : 'tidak'}
Instruksi: "${body.instruction || 'Buat judul menarik, deskripsi SEO lengkap, dan tag relevan.'}"
Output JSON object dengan title, description, tags, isAiGenerated.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            isAiGenerated: { type: Type.BOOLEAN }
          },
          required: ['title', 'description', 'tags', 'isAiGenerated']
        }
      }
    });

    res.json({ video: JSON.parse((response.text || '{}').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim() || '{}') });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal optimasi metadata.' });
  }
});

app.get('/api/admin/orders', requireSession, requireAdminScope('orders'), (_req, res) => {
  res.json(store.data.orders.map(publicOrder));
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
  res.status(201).json(publicOrder(createCheckout(store, req.user.id, body.productId)));
});

app.get('/api/member/orders', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  res.json(store.data.orders
    .filter((order) => order.memberId === req.user?.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(publicOrder));
});

app.get('/api/member/licenses', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  res.json(memberLicenseDashboard(store, req.user.id));
});

app.use('/api', (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => issue.message).join(', ')
    : error instanceof Error ? error.message : 'Permintaan gagal diproses.';
  res.status(error instanceof z.ZodError ? 400 : 500).json({ message });
});

if (shouldServeFrontend) {
  app.use('/landing-imports', express.static(landingImportDir));
  app.use('/landing-imports', express.static(bundledLandingDir));
  app.use('/tools/:slug', (req, res, next) => {
    const product = store.data.products.find((item) => item.slug === req.params.slug);
    if (product && !canOpenProduct(req, product)) {
      sendProductAccessDenied(req, res, product);
      return;
    }
    express.static(path.join(bundledToolDir, req.params.slug))(req, res, next);
  });
  app.get(/^\/[a-z0-9-]+$/, (req, res, next) => {
    const product = store.data.products.find((item) => item.landingPath === req.path || `/${item.slug}` === req.path);
    if (!product) {
      next();
      return;
    }

    if (product.landingTemplate === 'tool-app') {
      if (!canOpenProduct(req, product)) {
        sendProductAccessDenied(req, res, product);
        return;
      }

      const toolIndexPath = path.join(bundledToolDir, product.slug, 'index.html');
      if (fs.existsSync(toolIndexPath)) {
        res.sendFile(toolIndexPath);
        return;
      }
    }

    const importedIndexPath = path.join(landingImportDir, product.slug, 'index.html');
    const bundledIndexPath = path.join(bundledLandingDir, product.slug, 'index.html');
    const indexPath = fs.existsSync(importedIndexPath) ? importedIndexPath : bundledIndexPath;
    if (!fs.existsSync(indexPath)) {
      next();
      return;
    }

    res.sendFile(indexPath);
  });
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
