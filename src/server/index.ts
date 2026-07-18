import cors from 'cors';
import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { createId, formatCurrency } from '../shared/domain';
import { clearSessionCookie, readSession, sessionCookie, signSession, requireAdminScope, requireSession } from './auth';
import { getTelegramBotStatus, startTelegramBot, stopTelegramBot } from './bot-control';
import { buildGitHubRemote, deploymentAuditArgs, deploymentInstallArgs, deploymentPullArgs, parseDeploymentSettings, runCommand, schedulePassengerRestart } from './deploy';
import { clearPaymentProofDirectory, removePaymentProof } from './payment-proof-storage';
import { notifyOwnerOfPaymentProof } from './payment-proof-notifications';
import { seedInitialData } from './seed';
import {
  adminLicenseDashboard,
  activateLicense,
  banHwid,
  createAdmin,
  createCheckout,
  createCartCheckout,
  createLicenseCheckout,
  canAccessLicenseOrder,
  createMember,
  expirePendingOrders,
  formatInvoiceHtml,
  invoiceReminderHours,
  createProductRecord,
  deleteProductRecord,
  generateDirectToolLicense,
  generateToolLicense,
  generateLicenseForPaidOrder,
  listPendingOrders,
  markOrderPaid,
  markOrderPaidByInvoice,
  memberLicenseDashboard,
  publicCatalog,
  publicPlansForProduct,
  productLicenseConfig,
  requestPasswordReset,
  resetPassword,
  resetLicenseDevice,
  updateProductRecord,
  updatePlanRecord,
  unbanHwid,
  verifyLicense,
  verifyAdminLogin,
  verifyMemberLogin,
  updateMemberAccount,
  updateOwnMemberProfile,
  verifyVoucher
} from './services';
import { createFileStore } from './store';
import { sendMail } from './mailer';
import { analyticsOverview, heartbeatPresence, recordAnalyticsEvent } from './analytics';
import { validateStaticQrisPayload } from './qris';
import {
  assertTelegramOrderOwner,
  createTelegramCheckout,
  listTelegramCatalog,
  listSubmittedPaymentProofs,
  listTelegramBuyerLicenses,
  reopenTelegramInvoice,
  reviewPaymentProof,
  submitPaymentProof,
  registerTelegramBuyer,
  attachTelegramDigitalFile,
  createTelegramProduct,
  deactivateTelegramProduct,
  updateTelegramPlan,
  updateTelegramProduct
} from './telegram-commerce';
import { consumeDownloadGrant, issueDownloadGrant, listBuyerDownloadGrants, reissueDownloadGrant } from './digital-downloads';
import { createMemoryStore } from './store';
import { fulfillPaidOrder } from './order-fulfillment';
import { publishedContent, updateContentPage } from './site-content';
import { subscribeProductUpdates, subscribersCsv } from './subscribers';
import { productMediaRoot, removeProductMedia, saveProductMedia } from './product-media-storage';

export const app = express();
const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
export const store = isTest ? createMemoryStore() : createFileStore();
const port = Number(process.env.API_PORT ?? 4000);
const isProduction = process.env.NODE_ENV === 'production';
const publicDir = path.resolve(process.cwd(), 'dist');
const hasBuiltFrontend = fs.existsSync(path.join(publicDir, 'index.html'));
const shouldServeFrontend = isProduction || hasBuiltFrontend;
const cpanelNodeBin = path.join(process.env.HOME ?? '', 'nodevenv/repositories/asistenq/20/bin');

if (!isProduction) {
  app.use(cors({ origin: ['http://127.0.0.1:3000', 'http://localhost:3000'] }));
}

app.use(express.json());

const landingImportDir = path.resolve('data/landing-imports');
const productAssetDir = path.resolve('data/product-assets');
const digitalProductDir = path.resolve('data/digital-products');
const paymentProofDir = path.resolve('data/payment-proofs');
const bundledLandingDir = path.resolve('landings');
const bundledToolDir = path.resolve('tools-dist');
const retiredLandingPaths = new Set(['/jadwalinaja']);
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

const telegramBuyerSchema = z.object({
  telegramId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  whatsapp: z.string().min(8)
});

const telegramCheckoutSchema = z.object({
  productId: z.string().min(1),
  planId: z.string().min(1)
});

const paymentProofSchema = z.object({ invoiceNumber: z.string().min(1), fileId: z.string().min(1) });
const paymentReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(1).optional()
}).superRefine((value, context) => {
  if (value.decision === 'reject' && !value.reason) context.addIssue({ code: 'custom', message: 'alasan penolakan wajib diisi' });
});
const desktopOrderSchema = z.object({
  productSlug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  planCode: z.string().trim().min(1).max(40),
  email: z.string().email(),
  hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, 'HWID harus tepat 16 karakter huruf/angka.').optional(),
  idempotencyKey: z.string().trim().min(8).max(128),
  voucherCode: z.string().trim().max(40).optional()
});
const hwidOnlySchema = z.object({ hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, 'HWID harus tepat 16 karakter huruf/angka.') });

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
  category: z.string().max(80).optional(),
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
  courseMaterials: z.array(z.object({
    id: z.string().min(1),
    type: z.enum(['youtube', 'ebook', 'link']),
    title: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional()
  })).optional(),
  ctaLabel: z.string().optional(),
  accessRequirement: z.string().optional(),
  destinationType: z.enum(['internal', 'hosted', 'external']).optional(),
  externalUrl: z.string().url().optional(),
  openMode: z.enum(['same_tab', 'new_tab', 'wrapper']).optional(),
  trackLiveUsers: z.boolean().optional(),
  fulfillmentType: z.enum(['license', 'download', 'url', 'course']).optional(),
  downloadSourceUrl: z.string().url().refine((value) => value.startsWith('https://'), 'URL download harus HTTPS.').optional(),
  installerUrl: z.string().url().refine((value) => value.startsWith('https://'), 'URL installer harus HTTPS.').optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  accessUrl: z.string().optional(),
  marketplaceCoverUrl: z.string().optional(),
  marketplaceAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  cardDescription: z.string().max(240).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  badge: z.string().max(30).optional(),
  gallery: z.array(z.object({ id: z.string(), type: z.enum(['image', 'video']), url: z.string(), alt: z.string().optional(), sortOrder: z.number().int() })).optional(),
  benefits: z.array(z.object({ title: z.string(), description: z.string(), icon: z.string().optional() })).optional(),
  features: z.array(z.object({ title: z.string(), description: z.string(), icon: z.string().optional() })).optional(),
  specifications: z.record(z.string(), z.string()).optional(),
  changelog: z.string().optional(),
  productFaqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  targetUsers: z.array(z.string().trim().min(1)).max(20).optional(),
  developer: z.string().optional(),
  version: z.string().optional(),
  fileSize: z.string().optional(),
  compatibility: z.string().optional(),
  language: z.string().optional(),
  latestUpdate: z.string().optional(),
  sku: z.string().optional(),
  demoUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  plans: z.array(z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    price: z.number().int().nonnegative(),
    billingPeriod: z.enum(['trial', 'monthly', 'annual', 'lifetime', 'one_time']),
    durationDays: z.number().int().positive().nullable(),
    isFree: z.boolean().optional(),
    isActive: z.boolean().optional(),
    badge: z.string().max(40).optional(),
    highlighted: z.boolean().optional(),
    sortOrder: z.number().int().optional()
  })).optional(),
  landingConfig: z.object({
    heroImageUrl: z.string().optional(),
    heroVideoUrl: z.string().optional(),
    themeColor: z.string().optional(),
    benefits: z.array(z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().optional()
    })).optional(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string()
    })).optional(),
    testimonials: z.array(z.object({
      name: z.string(),
      role: z.string(),
      content: z.string(),
      avatarUrl: z.string().optional()
    })).optional()
  }).optional()
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

const analyticsHeartbeatSchema = z.object({
  visitorId: z.string().min(8).max(120),
  instanceId: z.string().min(8).max(120),
  productSlug: z.string().min(1).optional()
});

const analyticsEventSchema = z.object({
  visitorId: z.string().min(8).max(120),
  productSlug: z.string().min(1),
  eventType: z.enum(['detail_view', 'tool_open', 'checkout_click'])
});

const deploymentSettingsSchema = z.object({
  githubToken: z.string().optional(),
  githubRepo: z.string().min(3).default('effands/asistenq'),
  githubBranch: z.string().min(1).default('master'),
  telegramBotToken: z.string().optional(),
  telegramOwnerId: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  mailFrom: z.string().optional(),
  qrisStaticPayload: z.string().optional()
});

function publicProduct(product: typeof store.data.products[number]) {
  const metrics = analyticsOverview(store).products.find((item) => item.productId === product.id);
  const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;
  const { downloadSourceUrl: _privateDownloadSource, installerUrl: _installerUrl, ...safeProduct } = product;
  return {
    ...safeProduct,
    downloadSourceConfigured: Boolean(_privateDownloadSource),
    installerConfigured: Boolean(_installerUrl),
    destinationType: product.destinationType ?? 'internal',
    openMode: product.openMode ?? (product.destinationType === 'external' ? 'new_tab' : 'same_tab'),
    trackLiveUsers: product.trackLiveUsers ?? product.destinationType !== 'external',
    formattedPrice: formatCurrency(product.price),
    discountPercent,
    analytics: metrics
  };
}

function publicOrder(order: typeof store.data.orders[number]) {
  const product = store.data.products.find((item) => item.id === order.productId);
  const member = store.data.members.find((m) => m.id === order.memberId);
  return {
    ...order,
    product: product ? publicProduct(product) : undefined,
    formattedAmount: formatCurrency(order.amount),
    formattedTotalAmount: formatCurrency(order.totalAmount ?? order.amount),
    expiresAt: order.expiresAt,
    reminderSentAt: order.reminderSentAt,
    memberName: member?.name,
    memberEmail: member?.email
  };
}

function publicTelegramOrder(order: typeof store.data.orders[number]) {
  const {
    memberId: _memberId,
    paymentProofFileId: _paymentProofFileId,
    paymentProofReviewerTelegramId: _paymentProofReviewerTelegramId,
    ...safeOrder
  } = order;
  const product = listTelegramCatalog(store).find((item) => item.id === order.productId);
  return {
    ...safeOrder,
    product,
    formattedAmount: formatCurrency(order.amount),
    formattedTotalAmount: formatCurrency(order.totalAmount ?? order.amount)
  };
}

function publicTelegramBuyer(member: typeof store.data.members[number]) {
  const { passwordHash: _passwordHash, ...safeMember } = member;
  return safeMember;
}

const publicTelegramErrors = new Set([
  'email sudah terhubung ke akun Telegram lain',
  'email sudah terdaftar; hubungkan Telegram melalui dashboard',
  'profil pembeli belum lengkap',
  'produk atau paket tidak tersedia',
  'semua kode unik pembayaran sedang digunakan; coba lagi nanti'
]);

function publicTelegramError(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(', ');
  }
  if (error instanceof Error && publicTelegramErrors.has(error.message)) {
    return error.message;
  }
  console.error(fallback, error);
  return fallback;
}

async function runGitHubDeployUpdate(githubToken: string): Promise<{ stdout: string; stderr: string }> {
  const settings = store.data.deploymentSettings ?? {};
  const { githubRepo, githubBranch } = parseDeploymentSettings(settings);
  const remote = buildGitHubRemote(githubRepo, githubToken);
  const hasLockfile = fs.existsSync(path.resolve('package-lock.json'));
  const commandOptions = {
    cwd: process.cwd(),
    timeout: 180000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      PATH: fs.existsSync(cpanelNodeBin) ? `${cpanelNodeBin}${path.delimiter}${process.env.PATH ?? ''}` : process.env.PATH
    }
  };
  const results = [
    await runCommand('git', deploymentPullArgs(remote, githubBranch), commandOptions),
    await runCommand('npm', deploymentInstallArgs(hasLockfile), commandOptions),
    await runCommand('npm', deploymentAuditArgs(), commandOptions),
    await runCommand('npm', ['run', 'build:hosting'], commandOptions)
  ];

  fs.mkdirSync(path.resolve('tmp'), { recursive: true });
  fs.writeFileSync(path.resolve('tmp/restart.txt'), new Date().toISOString());

  return {
    stdout: hideSecret(results.map((result) => result.stdout).join('\n'), githubToken),
    stderr: hideSecret(results.map((result) => result.stderr).join('\n'), githubToken)
  };
}

function scheduleNodeRestartAfterResponse(res: express.Response): void {
  if (process.env.NODE_ENV === 'production' || process.env.PASSENGER_APP_ENV) {
    res.on('finish', () => {
      schedulePassengerRestart(process.cwd());
      setTimeout(() => process.exit(0), 800);
    });
  }
}

async function emailInvoice(orderId: string) {
  try {
    const order = store.data.orders.find((item) => item.id === orderId);
    const member = store.data.members.find((item) => item.id === order?.memberId);
    if (!order || !member) return;
    await sendMail({
      to: member.email,
      subject: `Invoice AsistenQ ${order.invoiceNumber ?? order.id}`,
      html: formatInvoiceHtml(store, order.id, member.id)
    });
  } catch (error) {
    console.warn('Invoice email skipped:', error instanceof Error ? error.message : error);
  }
}

async function sendPendingOrderReminders() {
  const now = new Date();
  let changed = false;
  for (const order of store.data.orders) {
    if (order.status !== 'pending' || order.reminderSentAt) continue;
    const createdAt = new Date(order.createdAt);
    const shouldRemindAt = new Date(createdAt.getTime() + invoiceReminderHours * 60 * 60 * 1000);
    const expiresAt = order.expiresAt ? new Date(order.expiresAt) : undefined;
    if (shouldRemindAt > now || (expiresAt && expiresAt <= now)) continue;

    const member = store.data.members.find((item) => item.id === order.memberId);
    if (!member) continue;
    await sendMail({
      to: member.email,
      subject: `Reminder pembayaran ${order.invoiceNumber ?? order.id}`,
      html: `<h1>Reminder Invoice AsistenQ</h1>
        <p>Invoice <b>${order.invoiceNumber ?? order.id}</b> masih menunggu pembayaran.</p>
        <p>Total bayar: <b>${formatCurrency(order.totalAmount ?? order.amount)}</b></p>
        <p>Batas bayar: <b>${order.expiresAt ? new Date(order.expiresAt).toLocaleString('id-ID') : '24 jam setelah order'}</b></p>
        <p>Silakan login ke akun member AsistenQ untuk melihat QRIS dan download invoice.</p>`
    });
    order.reminderSentAt = now.toISOString();
    changed = true;
  }
  if (changed) store.save();
}

async function emailLicense(license: ReturnType<typeof generateToolLicense>, invoiceNumber?: string) {
  try {
    const product = store.data.products.find((item) => item.id === license.productId);
    await sendMail({
      to: license.email,
      subject: `Lisensi AsistenQ ${product?.name ?? ''}`.trim(),
      html: `<h1>Lisensi AsistenQ</h1>
        <p>Invoice: ${invoiceNumber ?? '-'}</p>
        <p>Produk: ${product?.name ?? license.productId}</p>
        <p>HWID: <b>${license.hwid}</b></p>
        <p>Token lisensi:</p>
        <pre style="padding:16px;border-radius:12px;background:#062c28;color:#fff">${license.key}</pre>
        <p>Token juga tersedia di akun member AsistenQ.</p>`
    });
  } catch (error) {
    console.warn('License email skipped:', error instanceof Error ? error.message : error);
  }
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
  const user = readSession(req);

  if (mode === 'public' && product.price > 0) return true;
  if (mode === 'public' && product.price === 0) {
    return user?.type === 'member' || user?.type === 'admin';
  }

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
      :root {
        --bg-grad: linear-gradient(135deg, #eaf7f1, #f5fbf7);
        --card-bg: rgba(255, 255, 255, 0.7);
        --card-border: rgba(0, 140, 134, 0.15);
        --text-main: #062c28;
        --text-sub: #3d5a55;
        --btn-bg: #062c28;
        --btn-hover: #008c86;
        --shadow: 0 32px 80px rgba(6, 44, 40, 0.12);
        --icon-bg: #dcf7ed;
        --icon-color: #0e3f35;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg-grad: linear-gradient(135deg, #0a1411, #12201c);
          --card-bg: rgba(18, 32, 28, 0.6);
          --card-border: rgba(255, 255, 255, 0.05);
          --text-main: #ffffff;
          --text-sub: #9caea9;
          --btn-bg: #008c86;
          --btn-hover: #5de0cb;
          --shadow: 0 32px 80px rgba(0, 0, 0, 0.4);
          --icon-bg: rgba(0, 140, 134, 0.2);
          --icon-color: #5de0cb;
        }
      }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: var(--bg-grad); font-family: 'Inter', system-ui, sans-serif; color: var(--text-main);
      }
      main {
        max-width: 440px; margin: 24px; padding: 48px 40px; text-align: center;
        border: 1px solid var(--card-border); border-radius: 32px;
        background: var(--card-bg); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
        box-shadow: var(--shadow);
        animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .icon {
        width: 64px; height: 64px; margin: 0 auto 24px; display: grid; place-items: center;
        background: var(--icon-bg); color: var(--icon-color); border-radius: 20px;
      }
      .icon svg { width: 32px; height: 32px; stroke-width: 2.2; }
      h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.2; font-weight: 800; letter-spacing: -0.02em; }
      p { color: var(--text-sub); line-height: 1.6; font-size: 15px; margin: 0 0 32px; }
      a {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        width: 100%; padding: 16px 24px; border-radius: 999px;
        background: var(--btn-bg); color: #fff; text-decoration: none; font-weight: 700; font-size: 15px;
        transition: all 0.2s; box-shadow: 0 8px 24px rgba(0,0,0,0.1); box-sizing: border-box;
      }
      a:hover { background: var(--btn-hover); transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
  </head>
  <body>
    <main>
      <div class="icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h1>Akses tools belum terbuka.</h1>
      <p>${product.accessRequirement ?? 'Silakan login member dan ambil akses produk dulu.'}</p>
      ${action}
    </main>
  </body>
</html>`);
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

app.get('/api/license/products/:slug/config', (req, res) => {
  try {
    res.json(productLicenseConfig(store, String(req.params.slug)));
  } catch (error) {
    res.status(404).json({ message: error instanceof Error ? error.message : 'product not found' });
  }
});

function desktopOrderDto(order: typeof store.data.orders[number]) {
  const product = store.data.products.find((item) => item.id === order.productId);
  const plan = store.data.plans.find((item) => item.id === order.planId);
  const license = store.data.licenses.find((item) => item.id === order.licenseId || item.orderId === order.id);
  return {
    invoiceNumber: order.invoiceNumber,
    product: product ? { slug: product.slug, name: product.name } : undefined,
    plan: plan ? { code: plan.code, name: plan.name, durationDays: plan.durationDays } : undefined,
    amount: order.amount,
    discountAmount: order.discountAmount ?? 0,
    uniqueCode: order.uniqueCode ?? 0,
    totalAmount: order.totalAmount ?? order.amount,
    paymentQrUrl: order.paymentQrUrl,
    expiresAt: order.expiresAt,
    status: order.status,
    paymentProofStatus: order.paymentProofStatus ?? 'none',
    paymentProofRejectionReason: order.paymentProofRejectionReason,
    license: license && order.status === 'paid'
      ? { key: license.key, status: license.status, expiresAt: license.expiresAt, hwid: license.hwid }
      : undefined
  };
}

function accessibleDesktopOrder(req: express.Request) {
  const invoice = String(req.params.invoice);
  const order = store.data.orders.find((item) => item.invoiceNumber === invoice || item.id === invoice);
  const accessToken = req.get('x-order-token') ?? '';
  return order && canAccessLicenseOrder(order, accessToken) ? order : undefined;
}

const desktopPaymentProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});
const productMediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 1 } });
const profileAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

app.post('/api/license/orders', async (req, res) => {
  try {
    const result = await createLicenseCheckout(store, desktopOrderSchema.parse(req.body));
    res.status(201).json({ ...desktopOrderDto(result.order), accessToken: result.accessToken });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'Order tidak dapat dibuat.';
    res.status(400).json({ message });
  }
});

app.get('/api/license/orders/:invoice/status', (req, res) => {
  expirePendingOrders(store);
  const order = accessibleDesktopOrder(req);
  if (!order) {
    res.status(404).json({ message: 'Order tidak ditemukan.' });
    return;
  }
  res.json(desktopOrderDto(order));
});

app.post('/api/license/orders/:invoice/payment-proof', desktopPaymentProofUpload.single('file'), (req, res) => {
  const order = accessibleDesktopOrder(req);
  if (!order) {
    res.status(404).json({ message: 'Order tidak ditemukan.' });
    return;
  }
  if (order.status !== 'pending' || !req.file) {
    res.status(400).json({ message: req.file ? 'Invoice tidak dapat menerima bukti.' : 'Bukti gambar wajib diunggah.' });
    return;
  }
  fs.mkdirSync(paymentProofDir, { recursive: true });
  const previousFile = order.paymentProofFileId;
  const extension = req.file.mimetype === 'image/png' ? '.png' : req.file.mimetype === 'image/webp' ? '.webp' : '.jpg';
  const fileName = `${order.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}${extension}`;
  fs.writeFileSync(path.join(paymentProofDir, fileName), req.file.buffer);
  order.paymentProofFileId = fileName;
  order.paymentProofStatus = 'submitted';
  order.paymentProofSubmittedAt = new Date().toISOString();
  store.save();
  if (previousFile && previousFile !== fileName) removePaymentProof(paymentProofDir, previousFile);
  void notifyOwnerOfPaymentProof(store, order, path.join(paymentProofDir, fileName), 'MIXIN9/Desktop');
  res.json(desktopOrderDto(order));
});

app.get('/api/telegram/confirm/:invoice', async (req, res) => {
  const invoice = String(req.params.invoice);
  if (!/^[A-Za-z0-9_-]+$/.test(invoice)) {
    res.status(400).send('Invoice tidak valid.');
    return;
  }
  const token = store.data.deploymentSettings?.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!token) {
    res.status(503).send('Bot Telegram belum dikonfigurasi.');
    return;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const result = await response.json() as { ok?: boolean; result?: { username?: string } };
    const username = result.result?.username;
    if (!response.ok || !result.ok || !username) throw new Error('username bot tidak tersedia');
    res.redirect(`https://t.me/${username}?start=invoice_${invoice}`);
  } catch {
    res.status(503).send('Bot Telegram sedang tidak tersedia. Silakan coba lagi.');
  }
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
    res.json({ token, user: { id: member.id, name: member.name, email: member.email, whatsapp: member.whatsapp, telegramId: member.telegramId, avatarUrl: member.avatarUrl } });
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
  res.json(store.data.products.filter((product) => product.active && product.visibility === 'public').map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })));
});

app.get('/api/catalog', (_req, res) => {
  const catalog = publicCatalog(store);
  res.json({
    all: [...catalog.featured, ...catalog.paid, ...catalog.free]
      .filter((product, index, products) => products.findIndex((item) => item.id === product.id) === index)
      .map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    featured: catalog.featured.map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    paid: catalog.paid.map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    free: catalog.free.map((product) => ({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) })),
    onlineUsers: analyticsOverview(store).onlineUsers
  });
});

app.get('/api/content/:slug', (req, res) => {
  try { res.json(publishedContent(store, String(req.params.slug))); }
  catch { res.status(404).json({ message: 'Halaman tidak ditemukan.' }); }
});

app.get('/api/admin/content', requireSession, requireAdminScope('content'), (_req, res) => res.json(store.data.contentPages));
app.put('/api/admin/content/:id', requireSession, requireAdminScope('content'), (req, res) => {
  try {
    const body = z.object({ title: z.string().min(2).optional(), summary: z.string().optional(), body: z.string().min(1), published: z.boolean() }).parse(req.body);
    res.json(updateContentPage(store, String(req.params.id), body));
  } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Konten gagal disimpan.' }); }
});

app.post('/api/subscribers', (req, res) => {
  try {
    const body = z.object({ email: z.string().email(), source: z.string().max(40).optional() }).parse(req.body);
    subscribeProductUpdates(store, body.email, body.source);
    res.status(201).json({ ok: true, message: 'Terima kasih. Update produk akan dikirim ke email Anda.' });
  } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Email gagal disimpan.' }); }
});

app.get('/api/admin/subscribers', requireSession, requireAdminScope('content'), (_req, res) => res.json(store.data.subscribers));
app.get('/api/admin/subscribers/export.csv', requireSession, requireAdminScope('content'), (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="asistenq-subscribers.csv"');
  res.send(subscribersCsv(store));
});

app.get('/api/product-media/:productId/:fileName', (req, res) => {
  const productId = String(req.params.productId);
  const fileName = String(req.params.fileName);
  if (!/^[A-Za-z0-9_-]+$/.test(productId) || !/^[A-Za-z0-9._-]+$/.test(fileName)) {
    res.status(404).end();
    return;
  }
  const url = `/api/product-media/${productId}/${fileName}`;
  const product = store.data.products.find((row) => row.id === productId && row.active && row.visibility === 'public');
  const referenced = product && (product.marketplaceCoverUrl === url || product.gallery?.some((item) => item.url === url));
  if (!referenced) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.join(productMediaRoot, productId, fileName), (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
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
  const product = store.data.products.find((item) => item.slug === body.productSlug);
  if (product && ['detail_view', 'tool_open', 'checkout_click'].includes(body.eventType)) {
    recordAnalyticsEvent(store, {
      productId: product.id,
      visitorId: body.email ?? body.hwid ?? 'anonymous-tool',
      eventType: body.eventType as 'detail_view' | 'tool_open' | 'checkout_click'
    });
  }
  store.save();

  res.status(201).json({ ok: true, message: 'Tool event received' });
});

app.post('/api/analytics/heartbeat', (req, res) => {
  const body = analyticsHeartbeatSchema.parse(req.body);
  const product = body.productSlug
    ? store.data.products.find((item) => item.slug === body.productSlug && item.active)
    : undefined;
  const trackProduct = product && product.destinationType !== 'external' && product.trackLiveUsers !== false
    ? product.id
    : undefined;

  heartbeatPresence({
    visitorId: body.visitorId,
    instanceId: body.instanceId,
    productId: trackProduct
  });

  const overview = analyticsOverview(store);
  res.json({
    ok: true,
    onlineUsers: overview.onlineUsers,
    toolOnlineUsers: trackProduct
      ? overview.products.find((item) => item.productId === trackProduct)?.onlineUsers ?? 0
      : 0
  });
});

app.post('/api/analytics/event', (req, res) => {
  const body = analyticsEventSchema.parse(req.body);
  const product = store.data.products.find((item) => item.slug === body.productSlug && item.active);
  if (!product) {
    res.status(404).json({ message: 'product not found' });
    return;
  }

  recordAnalyticsEvent(store, {
    productId: product.id,
    visitorId: body.visitorId,
    eventType: body.eventType
  });
  res.status(201).json({ ok: true });
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
  const analytics = analyticsOverview(store);
  res.json({
    products: store.data.products.length,
    members: store.data.members.length,
    orders: store.data.orders.length,
    licenses: store.data.licenses.length,
    activeSubscriptions: store.data.subscriptions.filter((item) => item.status === 'active').length,
    onlineUsers: analytics.onlineUsers,
    toolOpens: analytics.totalToolOpens,
    detailViews: analytics.totalDetailViews,
    toolAnalytics: analytics.products
  });
});

app.get('/api/admin/analytics', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json(analyticsOverview(store));
});

app.post('/api/admin/reset-operational-data', requireSession, requireAdminScope('products'), (_req, res) => {
  store.data.orders = [];
  store.data.subscriptions = [];
  store.data.licenses = [];
  store.data.bannedHwids = [];
  store.data.vouchers = [];
  store.data.passwordResets = [];
  store.data.auditLogs = [];
  store.data.toolAnalyticsEvents = [];
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

app.post('/api/admin/products/:id/media/cover', requireSession, requireAdminScope('products'), productMediaUpload.single('file'), (req, res) => {
  try {
    const product = store.data.products.find((row) => row.id === String(req.params.id));
    if (!product || !req.file) throw new Error('produk atau file tidak ditemukan');
    const saved = saveProductMedia({ productId: product.id, originalName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer });
    const previous = product.marketplaceCoverUrl;
    product.marketplaceCoverUrl = `/api/product-media/${saved.relativePath}`;
    product.updatedAt = new Date().toISOString();
    store.save();
    if (previous?.startsWith('/api/product-media/')) removeProductMedia(previous.slice('/api/product-media/'.length));
    res.status(201).json({ url: product.marketplaceCoverUrl });
  } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Upload cover gagal.' }); }
});

app.post('/api/admin/products/:id/media/gallery', requireSession, requireAdminScope('products'), productMediaUpload.single('file'), (req, res) => {
  try {
    const product = store.data.products.find((row) => row.id === String(req.params.id));
    if (!product || !req.file) throw new Error('produk atau file tidak ditemukan');
    const saved = saveProductMedia({ productId: product.id, originalName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer });
    const item = { id: createId('media'), type: req.file.mimetype.startsWith('video/') ? 'video' as const : 'image' as const, url: `/api/product-media/${saved.relativePath}`, sortOrder: product.gallery?.length ?? 0 };
    product.gallery = [...(product.gallery ?? []), item];
    product.updatedAt = new Date().toISOString();
    store.save();
    res.status(201).json(item);
  } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Upload galeri gagal.' }); }
});

app.delete('/api/admin/products/:id/media/:mediaId', requireSession, requireAdminScope('products'), (req, res) => {
  const product = store.data.products.find((row) => row.id === String(req.params.id));
  const item = product?.gallery?.find((row) => row.id === String(req.params.mediaId));
  if (!product || !item) { res.status(404).json({ message: 'Media tidak ditemukan.' }); return; }
  product.gallery = product.gallery?.filter((row) => row.id !== item.id).map((row, index) => ({ ...row, sortOrder: index }));
  store.save();
  if (item.url.startsWith('/api/product-media/')) removeProductMedia(item.url.slice('/api/product-media/'.length));
  res.json({ ok: true });
});


app.put('/api/admin/members/:id', requireSession, requireAdminScope('members'), async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    active: z.boolean().optional(),
    password: z.string().min(6).optional()
  });
  const body = schema.parse(req.body);
  const member = await updateMemberAccount(store, req.params.id as string, body);
  res.json({ success: true, member });
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
  try {
    const body = productSchema.parse(req.body);
    const product = createProductRecord(store, body);
    res.status(201).json(publicProduct(product));
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'Produk gagal ditambahkan.';
    res.status(400).json({ message });
  }
});

app.get('/api/member/profile', requireSession, (req, res) => {
  const member = req.user?.type === 'member' ? store.data.members.find((item) => item.id === req.user?.id) : undefined;
  if (!member) { res.status(403).json({ message: 'member access required' }); return; }
  const { passwordHash: _passwordHash, ...profile } = member;
  res.json(profile);
});

app.put('/api/member/profile', requireSession, async (req, res) => {
  if (req.user?.type !== 'member') { res.status(403).json({ message: 'member access required' }); return; }
  try {
    const body = z.object({
      name: z.string().trim().min(2).max(80).optional(),
      whatsapp: z.string().trim().max(30).optional(),
      telegramId: z.string().trim().max(80).optional(),
      currentPassword: z.string().min(6).optional(),
      newPassword: z.string().min(8).max(128).optional()
    }).refine((value) => !value.newPassword || Boolean(value.currentPassword), { message: 'Password saat ini wajib diisi.', path: ['currentPassword'] }).parse(req.body);
    const member = await updateOwnMemberProfile(store, req.user.id, body);
    const { passwordHash: _passwordHash, ...profile } = member;
    res.json(profile);
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(', ') : error instanceof Error ? error.message : 'Profil gagal diperbarui.';
    res.status(400).json({ message });
  }
});

app.post('/api/member/profile/avatar', requireSession, profileAvatarUpload.single('file'), (req, res) => {
  if (req.user?.type !== 'member') { res.status(403).json({ message: 'member access required' }); return; }
  try {
    if (!req.file) throw new Error('Pilih foto JPG, PNG, atau WebP maksimal 5 MB.');
    const member = store.data.members.find((item) => item.id === req.user?.id);
    if (!member) throw new Error('Member tidak ditemukan.');
    const folderId = `member_${member.id}`;
    const saved = saveProductMedia({ productId: folderId, originalName: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer });
    if (member.avatarUrl?.startsWith(`/api/profile-avatar/${folderId}/`)) {
      removeProductMedia(member.avatarUrl.slice('/api/profile-avatar/'.length));
    }
    member.avatarUrl = `/api/profile-avatar/${saved.relativePath}`;
    store.save();
    res.status(201).json({ avatarUrl: member.avatarUrl });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Foto profil gagal diupload.' });
  }
});

app.get('/api/profile-avatar/:memberFolder/:fileName', (req, res) => {
  const memberFolder = String(req.params.memberFolder);
  const fileName = String(req.params.fileName);
  const url = `/api/profile-avatar/${memberFolder}/${fileName}`;
  if (!/^member_[A-Za-z0-9_-]+$/.test(memberFolder) || !/^[A-Za-z0-9._-]+$/.test(fileName) || !store.data.members.some((item) => item.avatarUrl === url)) {
    res.status(404).end(); return;
  }
  res.sendFile(path.join(productMediaRoot, memberFolder, fileName), (error) => { if (error && !res.headersSent) res.status(404).end(); });
});

app.get('/api/downloads/:slug', (req, res) => {
  const product = store.data.products.find((item) => item.slug === req.params.slug && item.active && item.visibility === 'public');
  if (!product?.installerUrl) {
    res.status(404).send('link download belum diatur oleh admin');
    return;
  }
  res.redirect(product.installerUrl);
});

app.put('/api/admin/products/:id', requireSession, requireAdminScope('products'), (req, res) => {
  try {
    const body = productSchema.partial().parse(req.body);
    const product = updateProductRecord(store, String(req.params.id), body);
    res.json({ ...publicProduct(product), plans: store.data.plans.filter((plan) => plan.productId === product.id && plan.isActive) });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'Produk gagal diperbarui.';
    res.status(message === 'product not found' ? 404 : 400).json({ message });
  }
});

app.delete('/api/admin/products/:id', requireSession, requireAdminScope('products'), (req, res) => {
  try {
    const product = deleteProductRecord(store, String(req.params.id));
    const mediaUrls = [product.marketplaceCoverUrl, ...(product.gallery ?? []).map((item) => item.url)];
    for (const mediaUrl of mediaUrls) {
      if (mediaUrl?.startsWith('/api/product-media/')) removeProductMedia(mediaUrl.slice('/api/product-media/'.length));
    }
    res.json({ ok: true, id: product.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Produk gagal dihapus.';
    res.status(message === 'product not found' ? 404 : 400).json({ message });
  }
});

app.patch('/api/admin/plans/:id', requireSession, requireAdminScope('products'), (req, res) => {
  try {
    res.json(updatePlanRecord(store, String(req.params.id), planPatchSchema.parse(req.body)));
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'Data paket tidak valid.';
    res.status(400).json({ message });
  }
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
    product.destinationType = 'hosted';
    product.openMode = 'same_tab';
    product.trackLiveUsers = true;
    product.landingPath = product.landingPath ?? `/${safeSlug}`;
    product.accessUrl = product.landingPath;
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

app.post(
  '/api/admin/products/:id/landing-html',
  requireSession,
  requireAdminScope('products'),
  express.raw({ type: ['text/html', 'application/octet-stream'], limit: '5mb' }),
  (req, res) => {
    const product = store.data.products.find((item) => item.id === String(req.params.id));
    if (!product) {
      res.status(404).json({ message: 'product not found' });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ message: 'File HTML kosong atau tidak terbaca.' });
      return;
    }

    const html = req.body.toString('utf8');
    if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
      res.status(400).json({ message: 'File harus berupa dokumen HTML lengkap.' });
      return;
    }

    const safeSlug = product.slug.replace(/[^a-z0-9-]/g, '');
    const targetDir = path.join(landingImportDir, safeSlug);
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'index.html'), html);

    product.landingTemplate = 'single-html';
    product.destinationType = 'hosted';
    product.openMode = 'same_tab';
    product.trackLiveUsers = true;
    product.landingPath = product.landingPath ?? `/${safeSlug}`;
    product.accessUrl = product.landingPath;
    product.updatedAt = new Date().toISOString();
    store.save();

    res.json({ ok: true, message: `HTML tersimpan untuk ${product.name}.`, url: product.accessUrl });
  }
);

app.post(
  '/api/admin/products/:id/logo',
  requireSession,
  requireAdminScope('products'),
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'], limit: '3mb' }),
  (req, res) => {
    const product = store.data.products.find((item) => item.id === String(req.params.id));
    if (!product) {
      res.status(404).json({ message: 'product not found' });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ message: 'File gambar kosong atau tidak terbaca.' });
      return;
    }

    const contentType = String(req.headers['content-type'] ?? '').split(';')[0];
    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png';
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'].includes(contentType)) {
      res.status(400).json({ message: 'Format gambar harus PNG, JPG, atau WEBP.' });
      return;
    }

    fs.mkdirSync(productAssetDir, { recursive: true });
    const safeSlug = product.slug.replace(/[^a-z0-9-]/g, '') || product.id;
    const filename = `${safeSlug}-${Date.now()}.${extension}`;
    fs.writeFileSync(path.join(productAssetDir, filename), req.body);

    product.logoUrl = `/product-assets/${filename}`;
    product.updatedAt = new Date().toISOString();
    store.save();

    res.json({ ok: true, logoUrl: product.logoUrl, message: `Gambar ${product.name} tersimpan.` });
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

function requireBotSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const configuredSecret = store.data.deploymentSettings?.botApiSecret ?? process.env.ASISTENQ_BOT_SECRET ?? '';
  if (!configuredSecret || req.header('x-asistenq-bot-secret') !== configuredSecret) {
    res.status(403).json({ message: 'bot secret tidak valid' });
    return;
  }
  next();
}

function telegramUserId(req: express.Request): string {
  return String(req.header('x-telegram-user-id') ?? '').trim();
}

function requireTelegramIdentity(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!telegramUserId(req)) {
    res.status(400).json({ message: 'Telegram ID wajib diisi' });
    return;
  }
  next();
}

function requireBotOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ownerId = store.data.deploymentSettings?.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? '';
  if (!ownerId || telegramUserId(req) !== ownerId) {
    res.status(403).json({ message: 'owner access required' });
    return;
  }
  next();
}

app.get('/api/admin/deploy/settings', requireSession, requireAdminScope('products'), (_req, res) => {
  const settings = store.data.deploymentSettings ?? {};
  const token = settings.githubToken ?? process.env.GITHUB_TOKEN ?? '';
  const telegramToken = settings.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const smtpPass = settings.smtpPass ?? process.env.SMTP_PASS ?? '';
  const botStatus = getTelegramBotStatus(store);
  res.json({
    githubRepo: settings.githubRepo ?? 'effands/asistenq',
    githubBranch: settings.githubBranch ?? 'master',
    hasGithubToken: Boolean(token),
    maskedGithubToken: maskedSecret(token),
    hasTelegramBotToken: Boolean(telegramToken),
    maskedTelegramBotToken: maskedSecret(telegramToken),
    telegramOwnerId: settings.telegramOwnerId ?? process.env.TELEGRAM_OWNER_ID ?? '',
    smtpHost: settings.smtpHost ?? process.env.SMTP_HOST ?? 'mail.asistenq.com',
    smtpPort: settings.smtpPort ?? process.env.SMTP_PORT ?? '465',
    smtpUser: settings.smtpUser ?? process.env.SMTP_USER ?? 'cs@asistenq.com',
    hasSmtpPass: Boolean(smtpPass),
    maskedSmtpPass: maskedSecret(smtpPass),
    mailFrom: settings.mailFrom ?? process.env.MAIL_FROM ?? 'AsistenQ <cs@asistenq.com>',
    qrisStaticPayload: settings.qrisStaticPayload ?? '',
    botStatus,
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
  const nextTelegramToken = body.telegramBotToken?.trim() || current.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '';
  const nextTelegramOwnerId = body.telegramOwnerId?.trim() || current.telegramOwnerId || process.env.TELEGRAM_OWNER_ID || '';
  const nextSmtpPass = body.smtpPass?.trim() || current.smtpPass || process.env.SMTP_PASS || '';
  const nextSmtpHost = body.smtpHost?.trim() || current.smtpHost || process.env.SMTP_HOST || 'mail.asistenq.com';
  const nextSmtpPort = body.smtpPort?.trim() || current.smtpPort || process.env.SMTP_PORT || '465';
  const nextSmtpUser = body.smtpUser?.trim() || current.smtpUser || process.env.SMTP_USER || 'cs@asistenq.com';
  const nextMailFrom = body.mailFrom?.trim() || current.mailFrom || process.env.MAIL_FROM || 'AsistenQ <cs@asistenq.com>';
  const isSmtpSave = Boolean(body.smtpHost || body.smtpPort || body.smtpUser || body.mailFrom || body.smtpPass !== undefined);

  if (isSmtpSave && !nextSmtpPass) {
    res.status(400).json({ message: 'Password SMTP belum tersimpan. Isi kolom SMTP Password lalu klik Simpan SMTP lagi.' });
    return;
  }

  try {
    const nextQrisStaticPayload = body.qrisStaticPayload === undefined
      ? current.qrisStaticPayload ?? ''
      : validateStaticQrisPayload(body.qrisStaticPayload);
    const deploySettings = parseDeploymentSettings(body);
    store.data.deploymentSettings = {
      githubRepo: deploySettings.githubRepo,
      githubBranch: deploySettings.githubBranch,
      githubToken: nextToken,
      telegramBotToken: nextTelegramToken,
      telegramOwnerId: nextTelegramOwnerId,
      botApiSecret: current.botApiSecret,
      smtpHost: nextSmtpHost,
      smtpPort: nextSmtpPort,
      smtpUser: nextSmtpUser,
      smtpPass: nextSmtpPass,
      mailFrom: nextMailFrom,
      qrisStaticPayload: nextQrisStaticPayload,
      updatedAt: new Date().toISOString()
    };
    store.save();
    const botStatus = getTelegramBotStatus(store);

    res.json({
      ok: true,
      message: 'Token GitHub tersimpan.',
      githubRepo: store.data.deploymentSettings.githubRepo,
      githubBranch: store.data.deploymentSettings.githubBranch,
      hasGithubToken: Boolean(nextToken),
      maskedGithubToken: maskedSecret(nextToken),
      hasTelegramBotToken: Boolean(nextTelegramToken),
      maskedTelegramBotToken: maskedSecret(nextTelegramToken),
      telegramOwnerId: nextTelegramOwnerId,
      smtpHost: nextSmtpHost,
      smtpPort: nextSmtpPort,
      smtpUser: nextSmtpUser,
      hasSmtpPass: Boolean(nextSmtpPass),
      maskedSmtpPass: maskedSecret(nextSmtpPass),
      mailFrom: nextMailFrom,
      qrisStaticPayload: nextQrisStaticPayload,
      botStatus,
      updatedAt: store.data.deploymentSettings.updatedAt
    });
  } catch (error) {
    if (error instanceof Error && /QRIS|CRC|struktur/i.test(error.message)) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({
      message: 'Token gagal disimpan ke data server.',
      detail: error instanceof Error ? error.message : 'unknown save error'
    });
  }
});

app.get('/api/admin/bot/status', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json(getTelegramBotStatus(store));
});

app.post('/api/admin/bot/start', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json(startTelegramBot(store));
});

app.post('/api/admin/bot/stop', requireSession, requireAdminScope('products'), (_req, res) => {
  res.json(stopTelegramBot());
});

const planPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  price: z.number().int().nonnegative().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  badge: z.string().max(40).optional(),
  highlighted: z.boolean().optional(),
  sortOrder: z.number().int().optional()
});

app.post('/api/bot/buyer/register', requireBotSecret, requireTelegramIdentity, async (req, res) => {
  try {
    const body = telegramBuyerSchema.parse({ ...req.body, telegramId: telegramUserId(req) });
    res.json(publicTelegramBuyer(await registerTelegramBuyer(store, body)));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Registrasi pembeli gagal.') });
  }
});

app.get('/api/bot/buyer/products', requireBotSecret, requireTelegramIdentity, (_req, res) => {
  res.json({ products: listTelegramCatalog(store) });
});

app.post('/api/bot/buyer/checkout', requireBotSecret, requireTelegramIdentity, async (req, res) => {
  try {
    const body = telegramCheckoutSchema.parse(req.body);
    const order = await createTelegramCheckout(store, {
      ...body,
      telegramId: telegramUserId(req)
    });
    res.status(201).json(publicTelegramOrder(order));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Checkout gagal dibuat.') });
  }
});

app.get('/api/bot/buyer/orders', requireBotSecret, requireTelegramIdentity, (req, res) => {
  const member = store.data.members.find((item) => item.telegramId === telegramUserId(req));
  const orders = member
    ? store.data.orders.filter((item) => item.memberId === member.id).map(publicTelegramOrder)
    : [];
  res.json({ orders });
});

app.post('/api/bot/buyer/payment-proof', requireBotSecret, requireTelegramIdentity, (req, res) => {
  try {
    const body = paymentProofSchema.parse(req.body);
    res.json(publicTelegramOrder(submitPaymentProof(store, { ...body, telegramId: telegramUserId(req) })));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Bukti pembayaran gagal dikirim.') });
  }
});

app.post('/api/bot/buyer/orders/:invoice/hwid', requireBotSecret, requireTelegramIdentity, (req, res) => {
  try {
    const body = hwidOnlySchema.parse(req.body);
    assertTelegramOrderOwner(store, telegramUserId(req), String(req.params.invoice));
    const license = generateLicenseForPaidOrder(store, { invoiceNumber: String(req.params.invoice), hwid: body.hwid });
    void emailLicense(license, String(req.params.invoice));
    res.status(201).json(license);
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Lisensi gagal dibuat.') });
  }
});

app.get('/api/bot/buyer/licenses', requireBotSecret, requireTelegramIdentity, (req, res) => {
  res.json({ licenses: listTelegramBuyerLicenses(store, telegramUserId(req)) });
});

app.post('/api/bot/buyer/orders/:invoice/download', requireBotSecret, requireTelegramIdentity, (req, res) => {
  try {
    const order = assertTelegramOrderOwner(store, telegramUserId(req), String(req.params.invoice));
    const active = store.data.downloadGrants.some((grant) => grant.orderId === order.id && new Date(grant.expiresAt) > new Date() && grant.downloadCount < grant.maxDownloads);
    const issued = active ? reissueDownloadGrant(store, order.id) : issueDownloadGrant(store, order.id);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({
      grant: { id: issued.grant.id, orderId: issued.grant.orderId, productId: issued.grant.productId, expiresAt: issued.grant.expiresAt, remainingDownloads: issued.grant.maxDownloads },
      downloadUrl: `${baseUrl}/api/download/${encodeURIComponent(issued.token)}`
    });
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Link download gagal dibuat.') });
  }
});

app.get('/api/bot/buyer/downloads', requireBotSecret, requireTelegramIdentity, (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({ grants: listBuyerDownloadGrants(store, telegramUserId(req), baseUrl) });
});

app.get('/api/download/:token', (req, res) => {
  try {
    const { source } = consumeDownloadGrant(store, String(req.params.token));
    if (source.kind === 'local') {
      res.download(source.value);
      return;
    }
    res.redirect(302, source.value);
  } catch (error) {
    res.status(404).json({ message: publicTelegramError(error, 'Link download tidak tersedia.') });
  }
});

// Establish the authorization boundary now so every current and future owner route
// rejects non-owner identities before route-specific handlers run.
app.use('/api/bot/owner', requireBotSecret, requireTelegramIdentity, requireBotOwner);

const telegramProductSchema = z.object({
  name: z.string().trim().min(2), slug: z.string().regex(/^[a-z0-9-]+$/),
  fulfillmentType: z.enum(['license', 'download', 'url', 'course']), description: z.string().trim(),
  status: z.enum(['public', 'private', 'draft']),
  downloadSourceUrl: z.string().url().refine((value) => value.startsWith('https://'), 'URL download harus HTTPS.').optional(),
  plan: z.object({
    code: z.string().trim().min(1), name: z.string().trim().min(1),
    price: z.number().int().nonnegative(), durationDays: z.number().int().positive().nullable()
  })
});
const telegramProductPatchSchema = telegramProductSchema.omit({ plan: true }).partial();
const telegramPlanPatchSchema = z.object({
  name: z.string().trim().min(1).optional(), price: z.number().int().nonnegative().optional(),
  durationDays: z.number().int().positive().nullable().optional(), isActive: z.boolean().optional()
});
const digitalProductUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdirSync(digitalProductDir, { recursive: true });
      callback(null, digitalProductDir);
    },
    filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.zip`)
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const zipMime = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']);
    callback(null, path.extname(path.basename(file.originalname)).toLowerCase() === '.zip' && zipMime.has(file.mimetype));
  }
});

app.post('/api/bot/owner/products', (req, res) => {
  try {
    const result = createTelegramProduct(store, telegramProductSchema.parse(req.body), telegramUserId(req));
    res.status(201).json({ product: publicProduct(result.product), plan: result.plan });
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Produk gagal dibuat.') });
  }
});

app.patch('/api/bot/owner/products/:id', (req, res) => {
  try { res.json(publicProduct(updateTelegramProduct(store, String(req.params.id), telegramProductPatchSchema.parse(req.body), telegramUserId(req)))); }
  catch (error) { res.status(400).json({ message: publicTelegramError(error, 'Produk gagal diperbarui.') }); }
});

app.post('/api/bot/owner/products/:id/deactivate', (req, res) => {
  try { res.json(publicProduct(deactivateTelegramProduct(store, String(req.params.id), telegramUserId(req)))); }
  catch (error) { res.status(400).json({ message: publicTelegramError(error, 'Produk gagal dinonaktifkan.') }); }
});

app.patch('/api/bot/owner/plans/:id', (req, res) => {
  try { res.json(updateTelegramPlan(store, String(req.params.id), telegramPlanPatchSchema.parse(req.body), telegramUserId(req))); }
  catch (error) { res.status(400).json({ message: publicTelegramError(error, 'Paket gagal diperbarui.') }); }
});

app.post('/api/bot/owner/products/:id/digital-file', (req, res, next) => {
  digitalProductUpload.single('file')(req, res, (error) => {
    if (error) { res.status(400).json({ message: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 'File ZIP maksimal 50 MB.' : 'Upload ZIP tidak valid.' }); return; }
    next();
  });
}, (req, res) => {
  if (!req.file) { res.status(400).json({ message: 'File ZIP wajib diunggah.' }); return; }
  try {
    res.json(publicProduct(attachTelegramDigitalFile(store, String(req.params.id), req.file.path, telegramUserId(req))));
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    res.status(400).json({ message: publicTelegramError(error, 'File digital gagal disimpan.') });
  }
});

app.get('/api/bot/owner/payment-proofs', (_req, res) => {
  res.json({ orders: listSubmittedPaymentProofs(store).map((order) => ({
    ...publicTelegramOrder(order),
    paymentProofFileId: order.paymentProofFileId,
    paymentProofSource: order.customerHwid ? 'desktop' : 'telegram'
  })) });
});

app.get('/api/bot/owner/payment-proofs/:invoice/file', (req, res) => {
  const order = store.data.orders.find((item) => item.invoiceNumber === String(req.params.invoice) || item.id === String(req.params.invoice));
  const fileName = order?.paymentProofFileId ? path.basename(order.paymentProofFileId) : '';
  const filePath = fileName ? path.join(paymentProofDir, fileName) : '';
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ message: 'Bukti pembayaran tidak ditemukan.' });
    return;
  }
  res.sendFile(filePath);
});

app.post('/api/bot/owner/payment-proofs/:invoice/review', (req, res) => {
  try {
    const body = paymentReviewSchema.parse(req.body);
    const currentOrder = store.data.orders.find((item) => item.invoiceNumber === String(req.params.invoice) || item.id === String(req.params.invoice));
    const wasAlreadyApproved = currentOrder?.paymentProofStatus === 'approved' && currentOrder.status === 'paid';
    const result = reviewPaymentProof(store, { ...body, invoiceNumber: String(req.params.invoice), ownerTelegramId: telegramUserId(req) });
    const order = result.order;
    const product = store.data.products.find((item) => item.id === order.productId);
    const member = store.data.members.find((item) => item.id === order.memberId);
    let download;
    if (body.decision === 'approve' && !wasAlreadyApproved && product?.fulfillmentType === 'download') {
      const issued = issueDownloadGrant(store, order.id);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      download = { expiresAt: issued.grant.expiresAt, remainingDownloads: issued.grant.maxDownloads, downloadUrl: `${baseUrl}/api/download/${encodeURIComponent(issued.token)}` };
    }
    res.json({
      order: publicTelegramOrder(order),
      fulfillmentType: product?.fulfillmentType ?? 'license',
      buyerTelegramId: member?.telegramId,
      license: result.license,
      download
    });
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Bukti pembayaran gagal ditinjau.') });
  }
});

app.post('/api/bot/owner/orders/:invoice/reopen', (req, res) => {
  try {
    res.json(publicTelegramOrder(reopenTelegramInvoice(store, { invoiceNumber: String(req.params.invoice), ownerTelegramId: telegramUserId(req) })));
  } catch (error) {
    res.status(400).json({ message: publicTelegramError(error, 'Invoice gagal dibuka kembali.') });
  }
});

const ownerBotMiddleware = [requireBotSecret, requireTelegramIdentity, requireBotOwner] as const;

app.get('/api/bot/admin-summary', ...ownerBotMiddleware, (_req, res) => {
  res.json({
    products: store.data.products.length,
    members: store.data.members.length,
    orders: store.data.orders.length,
    licenses: store.data.licenses.length,
    activeSubscriptions: store.data.subscriptions.filter((item) => item.status === 'active').length
  });
});

app.get('/api/bot/orders', ...ownerBotMiddleware, (_req, res) => {
  void sendPendingOrderReminders();
  res.json({ orders: listPendingOrders(store, 10) });
});

app.post('/api/bot/orders/paid', ...ownerBotMiddleware, (req, res) => {
  try {
    const body = z.object({ invoiceNumber: z.string().min(1) }).parse(req.body);
    const result = markOrderPaidByInvoice(store, body.invoiceNumber);
    res.json({ ok: true, order: publicOrder(result.order), subscription: result.subscription });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Order gagal ditandai paid.' });
  }
});

app.get('/api/bot/owner/license-products', ...ownerBotMiddleware, (_req, res) => {
  const products = store.data.products
    .filter((product) => product.active)
    .map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      plans: store.data.plans
        .filter((plan) => plan.productId === product.id && plan.isActive)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
        .map((plan) => ({
          id: plan.id,
          code: plan.code,
          name: plan.name,
          durationDays: plan.durationDays
        }))
    }))
    .filter((product) => product.plans.length > 0);
  res.json({ products });
});

app.post('/api/bot/license-generate', ...ownerBotMiddleware, (req, res) => {
  try {
    const body = generateLicenseSchema.parse(req.body);
    const result = generateDirectToolLicense(store, body);
    res.status(result.reused ? 200 : 201).json(result);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'Data lisensi tidak valid.';
    res.status(400).json({ message });
  }
});

app.get('/api/bot/owner/licenses/:id/delivery', ...ownerBotMiddleware, async (req, res) => {
  const license = store.data.licenses.find((item) => item.id === String(req.params.id));
  if (!license) {
    res.status(404).json({ message: 'Lisensi tidak ditemukan.' });
    return;
  }
  const email = license.email.trim().toLowerCase();
  const member = store.data.members.find((item) => item.active && item.email === email);
  const order = store.data.orders.find((item) => item.id === license.orderId);
  await emailLicense(license, order?.invoiceNumber);
  res.json({ license, buyerTelegramId: member?.telegramId, emailed: true });
});

app.post('/api/bot/license-send', ...ownerBotMiddleware, (req, res) => {
  try {
    const body = z.object({
      invoiceNumber: z.string().min(1),
      hwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/, 'HWID harus tepat 16 karakter huruf/angka.'),
      planCode: z.string().optional()
    }).parse(req.body);
    markOrderPaidByInvoice(store, body.invoiceNumber);
    const license = generateLicenseForPaidOrder(store, body);
    void emailLicense(license, body.invoiceNumber);
    res.status(201).json(license);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'Lisensi gagal dibuat.';
    res.status(400).json({ message });
  }
});

app.get('/api/bot/banned', ...ownerBotMiddleware, (_req, res) => {
  const rows = store.data.bannedHwids.map((item) => {
    const product = store.data.products.find((candidate) => candidate.id === item.productId);
    return {
      ...item,
      productSlug: product?.slug ?? item.productId,
      productName: product?.name ?? item.productId
    };
  });
  res.json({ bannedHwids: rows });
});

app.post('/api/bot/ban-hwid', ...ownerBotMiddleware, (req, res) => {
  try {
    const body = hwidActionSchema.parse(req.body);
    res.status(201).json(banHwid(store, body));
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'HWID gagal dibanned.';
    res.status(400).json({ message });
  }
});

app.post('/api/bot/unban-hwid', ...ownerBotMiddleware, (req, res) => {
  try {
    const body = z.object({ productSlug: z.string().min(1), hwid: z.string().min(1) }).parse(req.body);
    res.json(unbanHwid(store, body));
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'HWID gagal di-unban.';
    res.status(400).json({ message });
  }
});

app.post('/api/bot/deploy-update', ...ownerBotMiddleware, async (_req, res) => {
  const settings = store.data.deploymentSettings ?? {};
  const githubToken = settings.githubToken ?? process.env.GITHUB_TOKEN ?? '';

  try {
    const result = await runGitHubDeployUpdate(githubToken);
    scheduleNodeRestartAfterResponse(res);
    res.json({
      ok: true,
      message: 'Update selesai. NodeJS akan restart otomatis. Bot Telegram akan menyalakan ulang prosesnya.',
      stdout: result.stdout,
      stderr: result.stderr
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

app.post('/api/admin/deploy/update', requireSession, requireAdminScope('products'), async (_req, res) => {
  const settings = store.data.deploymentSettings ?? {};
  const githubToken = settings.githubToken ?? process.env.GITHUB_TOKEN ?? '';

  try {
    const result = await runGitHubDeployUpdate(githubToken);
    scheduleNodeRestartAfterResponse(res);

    res.json({
      ok: true,
      message: 'Update selesai. NodeJS akan restart otomatis.',
      stdout: result.stdout,
      stderr: result.stderr
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
  expirePendingOrders(store);
  void sendPendingOrderReminders();
  res.json(store.data.orders.map(publicOrder));
});

app.get('/api/admin/orders/:id/payment-proof', requireSession, requireAdminScope('orders'), (req, res) => {
  const order = store.data.orders.find((item) => item.id === String(req.params.id));
  const fileName = order?.paymentProofFileId ? path.basename(order.paymentProofFileId) : '';
  const filePath = fileName ? path.join(paymentProofDir, fileName) : '';
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ message: 'Bukti pembayaran tidak ditemukan.' });
    return;
  }
  res.sendFile(filePath);
});

app.delete('/api/admin/orders/:id/payment-proof', requireSession, requireAdminScope('orders'), (req, res) => {
  const order = store.data.orders.find((item) => item.id === String(req.params.id));
  if (!order) {
    res.status(404).json({ message: 'Order tidak ditemukan.' });
    return;
  }
  const result = removePaymentProof(paymentProofDir, order.paymentProofFileId);
  order.paymentProofFileId = undefined;
  order.paymentProofSubmittedAt = undefined;
  if (order.paymentProofStatus === 'submitted') order.paymentProofStatus = 'none';
  store.save();
  res.json({ ok: true, ...result, message: `${result.files} bukti pembayaran dihapus.` });
});

app.delete('/api/admin/payment-proofs', requireSession, requireAdminScope('orders'), (_req, res) => {
  const result = clearPaymentProofDirectory(paymentProofDir);
  for (const order of store.data.orders) {
    order.paymentProofFileId = undefined;
    order.paymentProofSubmittedAt = undefined;
    if (order.paymentProofStatus === 'submitted') order.paymentProofStatus = 'none';
  }
  store.save();
  res.json({ ok: true, ...result, message: `${result.files} bukti pembayaran dibersihkan.` });
});

app.post('/api/admin/orders/:id/paid', requireSession, requireAdminScope('orders'), (req, res) => {
  try {
    const result = markOrderPaid(store, String(req.params.id));
    const fulfillment = result.order.orderItems ? fulfillPaidOrder(store, result.order.id) : undefined;
    const license = !result.order.orderItems && result.order.customerHwid
      ? generateLicenseForPaidOrder(store, { invoiceNumber: result.order.invoiceNumber ?? result.order.id, hwid: result.order.customerHwid })
      : undefined;
    if (license) {
      result.order.licenseId = license.id;
      store.save();
      void emailLicense(license, result.order.invoiceNumber ?? result.order.id);
    }
    res.json({ ok: true, order: publicOrder(result.order), subscription: result.subscription, license, fulfillment });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Order gagal diverifikasi.' });
  }
});

app.delete('/api/admin/orders/expired', requireSession, requireAdminScope('orders'), (_req, res) => {
  expirePendingOrders(store);
  const before = store.data.orders.length;
  store.data.orders = store.data.orders.filter((order) => order.status !== 'expired');
  const deleted = before - store.data.orders.length;
  if (deleted > 0) store.save();
  res.json({ ok: true, deleted, message: `${deleted} order expired dihapus.` });
});

app.get('/api/admin/orders/export.csv', requireSession, requireAdminScope('orders'), (_req, res) => {
  expirePendingOrders(store);
  const headers = ['Invoice', 'Member', 'Email', 'Produk', 'Total', 'Status', 'Tanggal'];
  const rows = store.data.orders.map((order) => {
    const row = publicOrder(order);
    return [
      row.invoiceNumber ?? row.id,
      row.memberName ?? '',
      row.memberEmail ?? '',
      row.product?.name ?? row.productName ?? row.productId,
      row.formattedTotalAmount,
      row.status,
      row.createdAt
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="asistenq-orders.csv"');
  res.send(`\ufeff${csv}`);
});

app.get('/api/admin/orders/export.xls', requireSession, requireAdminScope('orders'), (_req, res) => {
  expirePendingOrders(store);
  const headers = ['Invoice', 'Member', 'Email', 'Produk', 'Total', 'Status', 'Tanggal'];
  const rows = store.data.orders.map((order) => {
    const row = publicOrder(order);
    return [
      row.invoiceNumber ?? row.id,
      row.memberName ?? '',
      row.memberEmail ?? '',
      row.product?.name ?? row.productName ?? row.productId,
      row.formattedTotalAmount,
      row.status,
      row.createdAt
    ];
  });
  const escapeCell = (value: unknown) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const tableRows = [headers, ...rows]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`)
    .join('');
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="asistenq-orders.xls"');
  res.send(`<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`);
});

app.post('/api/checkout', requireSession, async (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  try {
    const body = z.union([
      z.object({ productId: z.string().min(1) }),
      z.object({
        items: z.array(z.object({ productId: z.string().min(1), planId: z.string().min(1) })).min(1).max(25),
        voucherCode: z.string().trim().max(40).optional(),
        customerHwid: z.string().trim().regex(/^[A-Za-z0-9]{16}$/).optional()
      })
    ]).parse(req.body);
    const order = 'items' in body
      ? await createCartCheckout(store, req.user.id, body)
      : await createCheckout(store, req.user.id, body.productId);
    void emailInvoice(order.id);
    res.status(201).json(publicOrder(order));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Checkout gagal dibuat.' });
  }
});

app.get('/api/member/orders', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  expirePendingOrders(store);
  void sendPendingOrderReminders();
  res.json(store.data.orders
    .filter((order) => order.memberId === req.user?.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(publicOrder));
});

app.post('/api/member/orders/:id/hwid', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  try {
    const { hwid } = hwidOnlySchema.parse(req.body);
    const order = store.data.orders.find((item) => item.id === String(req.params.id) && item.memberId === req.user?.id);
    if (!order) throw new Error('Order tidak ditemukan.');
    if (order.status !== 'paid') throw new Error('HWID dapat dimasukkan setelah pembayaran disetujui.');
    if (!order.orderItems?.some((item) => item.fulfillmentType === 'license' && item.fulfillmentStatus !== 'fulfilled')) {
      throw new Error('Pesanan ini tidak menunggu HWID lisensi.');
    }
    order.customerHwid = hwid.toUpperCase();
    fulfillPaidOrder(store, order.id);
    res.status(201).json(publicOrder(order));
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(', ')
      : error instanceof Error ? error.message : 'HWID gagal disimpan.';
    res.status(400).json({ message });
  }
});

app.get('/api/member/products/:id/download', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).send('member access required');
    return;
  }
  const product = store.data.products.find((item) => item.id === String(req.params.id));
  const hasPaidOrder = store.data.orders.some((order) => (
    order.memberId === req.user?.id &&
    order.status === 'paid' &&
    (order.productId === product?.id || order.orderItems?.some((item) => item.productId === product?.id))
  ));
  if (!product?.downloadSourceUrl || !hasPaidOrder) {
    res.status(404).send('download tidak tersedia');
    return;
  }
  res.redirect(product.downloadSourceUrl);
});

app.get('/api/member/orders/:id/invoice.html', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).send('member access required');
    return;
  }

  try {
    const html = formatInvoiceHtml(store, String(req.params.id), req.user.id);
    const order = store.data.orders.find((item) => item.id === String(req.params.id) || item.invoiceNumber === String(req.params.id));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${order?.invoiceNumber ?? req.params.id}.html"`);
    res.send(html);
  } catch {
    res.status(404).send('invoice not found');
  }
});

app.get('/api/member/licenses', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  res.json(memberLicenseDashboard(store, req.user.id));
});

app.post('/api/member/licenses/:id/reset-device', requireSession, (req, res) => {
  if (req.user?.type !== 'member') {
    res.status(403).json({ message: 'member access required' });
    return;
  }

  const body = z.object({ newHwid: z.string().min(8).max(32) }).parse(req.body);
  const member = store.data.members.find((item) => item.id === req.user?.id);
  const license = store.data.licenses.find((item) => item.id === String(req.params.id));
  if (!member || !license || license.email !== member.email) {
    res.status(404).json({ message: 'Lisensi tidak ditemukan di akun member ini.' });
    return;
  }

  res.json(resetLicenseDevice(store, { licenseId: license.id, newHwid: body.newHwid }));
});

app.use('/api', (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => issue.message).join(', ')
    : error instanceof Error ? error.message : 'Permintaan gagal diproses.';
  res.status(error instanceof z.ZodError ? 400 : 500).json({ message });
});

app.get('/tool-presence.js', (_req, res) => {
  res.type('application/javascript').send(`(() => {
    const script = document.currentScript;
    const productSlug = script?.dataset?.productSlug || '';
    const visitorKey = 'asistenq-visitor-id';
    const instanceKey = 'asistenq-tool-instance-id';
    const makeId = () => (globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));
    const visitorId = localStorage.getItem(visitorKey) || makeId();
    const instanceId = sessionStorage.getItem(instanceKey) || makeId();
    localStorage.setItem(visitorKey, visitorId);
    sessionStorage.setItem(instanceKey, instanceId);
    const post = (url, body) => fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true
    }).catch(() => undefined);
    const heartbeat = () => post('/api/analytics/heartbeat', { visitorId, instanceId, productSlug });
    heartbeat();
    post('/api/analytics/event', { visitorId, productSlug, eventType: 'tool_open' });
    setInterval(heartbeat, 20000);
  })();`);
});

function sendTrackedHtml(res: express.Response, indexPath: string, productSlug: string): void {
  const source = fs.readFileSync(indexPath, 'utf8');
  const tracker = `<script src="/tool-presence.js" data-product-slug="${productSlug}"></script>`;
  const html = source.includes('</body>') ? source.replace('</body>', `${tracker}</body>`) : `${source}${tracker}`;
  res.type('html').send(html);
}

if (shouldServeFrontend) {
  app.use('/product-assets', express.static(productAssetDir));
  app.use('/landing-imports', express.static(landingImportDir));
  app.use('/landing-imports', express.static(bundledLandingDir));
  app.use((req, res, next) => {
    if (retiredLandingPaths.has(req.path)) {
      res.status(404).type('text/plain').send('Not Found');
      return;
    }
    for (const retiredPath of retiredLandingPaths) {
      if (req.path.startsWith(`${retiredPath}/`) || req.path === `/tools${retiredPath}` || req.path.startsWith(`/tools${retiredPath}/`)) {
        res.status(404).type('text/plain').send('Not Found');
        return;
      }
    }
    next();
  });
  app.get('/tools/:slug', (req, res, next) => {
    const product = store.data.products.find((item) => item.slug === req.params.slug);
    if (product && !canOpenProduct(req, product)) {
      sendProductAccessDenied(req, res, product);
      return;
    }
    const toolIndexPath = path.join(bundledToolDir, req.params.slug, 'index.html');
    if (product && fs.existsSync(toolIndexPath)) {
      sendTrackedHtml(res, toolIndexPath, product.slug);
      return;
    }
    next();
  });
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
        sendTrackedHtml(res, toolIndexPath, product.slug);
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

    sendTrackedHtml(res, indexPath, product.slug);
  });
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

if (!isTest) {
  seedInitialData(store).then(() => {
    app.listen(port, () => {
      console.log(`AsistenQ running on port ${port}`);
    });
  });
}
