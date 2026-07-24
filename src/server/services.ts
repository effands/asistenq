import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  createId,
  createProduct,
  createSubscription,
  generateLicenseKey,
  formatCurrency,
  normalizeHwid,
  resolveLicenseExpiry
} from '../shared/domain';
import type {
  AdminAccount,
  AdminScope,
  BannedHwid,
  BillingPeriod,
  CourseMaterial,
  LandingFaq,
  LandingFeature,
  LicenseStatus,
  MemberAccount,
  Order,
  OrderItem,
  Product,
  ProductAccessMode,
  ProductDestinationType,
  ProductFulfillmentType,
  ProductOpenMode,
  ProductGalleryItem,
  ProductPlan,
  ProductType,
  ProductVisibility,
  Subscription,
  ToolLicense,
  Voucher
} from '../shared/types';
import type { Store } from './store';
import { generateDynamicQris } from './qris';
import { createSakuRupiahInvoice } from './sakurupiah';
import { validateCart, type CartInput } from './cart-checkout';

type Actor = {
  role: 'super_admin' | 'admin';
  scopes: AdminScope[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createResetToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function assertSuperAdmin(actor: Actor): void {
  if (actor.role !== 'super_admin') {
    throw new Error('super admin access required');
  }
}

function findProductBySlug(store: Store, productSlug: string): Product {
  const product = store.data.products.find((item) => item.slug === productSlug);

  if (!product) {
    throw new Error('product not found');
  }

  return product;
}

function findPlanByCode(store: Store, productId: string, planCode: string): ProductPlan {
  const normalizedCode = planCode.trim().toUpperCase();
  const plan = store.data.plans.find((item) => (
    item.productId === productId &&
    item.code === normalizedCode &&
    item.isActive
  ));

  if (!plan) {
    throw new Error('plan not found');
  }

  return plan;
}

function formatExpiryDate(expiryCode: string): string | null {
  if (expiryCode === 'LIFETIME') {
    return null;
  }

  return `${expiryCode.slice(0, 4)}-${expiryCode.slice(4, 6)}-${expiryCode.slice(6, 8)}`;
}

function expiryCodeFromLicense(license: ToolLicense): string {
  if (!license.expiresAt) {
    return 'LIFETIME';
  }

  return license.expiresAt.replaceAll('-', '');
}

function productPlanRow(store: Store, plan: ProductPlan) {
  const product = store.data.products.find((item) => item.id === plan.productId);

  return {
    ...plan,
    productSlug: product?.slug ?? '',
    productName: product?.name ?? plan.productId,
    formattedPrice: formatCurrency(plan.price)
  };
}

function licenseResetQuota(store: Store, licenseId: string, now = new Date()) {
  const resetWindowMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - resetWindowMs;
  const events = store.data.licenseDeviceResetEvents
    .filter((event) => event.licenseId === licenseId && event.actorType === 'member' && new Date(event.createdAt).getTime() > cutoff)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return {
    limit: 2,
    remaining: Math.max(0, 2 - events.length),
    nextAvailableAt: events.length >= 2
      ? new Date(new Date(events[0].createdAt).getTime() + resetWindowMs).toISOString()
      : null
  };
}

function licenseDashboardRow(store: Store, license: ToolLicense) {
  const product = store.data.products.find((item) => item.id === license.productId);
  const plan = store.data.plans.find((item) => item.id === license.planId);
  const isBanned = store.data.bannedHwids.some((item) => (
    item.productId === license.productId &&
    item.hwid === license.hwid
  ));

  return {
    ...license,
    status: isBanned ? 'banned' as const : license.status,
    product: product
      ? {
          id: product.id,
          name: product.name,
          slug: product.slug,
          type: product.type,
          category: product.category,
          accessUrl: product.accessUrl
        }
      : undefined,
    plan: plan
      ? {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          price: plan.price,
          billingPeriod: plan.billingPeriod,
          durationDays: plan.durationDays,
          formattedPrice: formatCurrency(plan.price)
        }
      : undefined,
    activationUrl: '/api/license/activate',
    verifyUrl: '/api/license/verify',
    resetQuota: licenseResetQuota(store, license.id)
  };
}

export async function createAdmin(store: Store, input: {
  actor: Actor;
  name: string;
  email: string;
  password: string;
  role: 'super_admin' | 'admin';
  scopes: AdminScope[];
}): Promise<AdminAccount> {
  assertSuperAdmin(input.actor);
  const email = normalizeEmail(input.email);

  if (store.data.admins.some((admin) => admin.email === email)) {
    throw new Error('email already exists');
  }

  const admin: AdminAccount = {
    id: createId('admin'),
    name: input.name,
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: input.role,
    scopes: input.scopes,
    active: true,
    createdAt: new Date().toISOString()
  };

  store.data.admins.push(admin);
  store.save();
  return admin;
}

export async function createMember(store: Store, input: {
  name: string;
  email: string;
  password: string;
  whatsapp?: string;
  telegramId?: string;
}): Promise<MemberAccount> {
  const email = normalizeEmail(input.email);

  if (store.data.members.some((member) => member.email === email)) {
    throw new Error('email already exists');
  }

  const member: MemberAccount = {
    id: createId('member'),
    name: input.name,
    email,
    whatsapp: input.whatsapp?.trim() ?? '',
    telegramId: input.telegramId?.trim() ?? '',
    passwordHash: await bcrypt.hash(input.password, 12),
    active: true,
    createdAt: new Date().toISOString()
  };

  store.data.members.push(member);
  store.save();
  return member;
}

export async function verifyAdminLogin(store: Store, emailInput: string, password: string): Promise<AdminAccount> {
  const email = normalizeEmail(emailInput);
  const admin = store.data.admins.find((item) => item.email === email && item.active);

  if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
    throw new Error('invalid credentials');
  }

  return admin;
}

export async function verifyMemberLogin(store: Store, emailInput: string, password: string): Promise<MemberAccount> {
  const email = normalizeEmail(emailInput);
  const member = store.data.members.find((item) => item.email === email && item.active);

  if (!member || !await bcrypt.compare(password, member.passwordHash)) {
    throw new Error('invalid credentials');
  }

  return member;
}

export async function requestPasswordReset(store: Store, input: {
  email: string;
  accountType: 'admin' | 'member';
  now?: Date;
}): Promise<{ ok: true; resetUrl?: string; expiresAt?: string }> {
  const email = normalizeEmail(input.email);
  const account = input.accountType === 'admin'
    ? store.data.admins.find((item) => item.email === email && item.active)
    : store.data.members.find((item) => item.email === email && item.active);

  if (!account) {
    return { ok: true };
  }

  const now = input.now ?? new Date();
  const token = createResetToken();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  store.data.passwordResets
    .filter((item) => item.accountType === input.accountType && item.accountId === account.id && !item.usedAt)
    .forEach((item) => {
      item.usedAt = now.toISOString();
    });

  store.data.passwordResets.push({
    id: createId('reset'),
    accountType: input.accountType,
    accountId: account.id,
    email,
    tokenHash: hashResetToken(token),
    expiresAt,
    createdAt: now.toISOString()
  });
  store.save();

  const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:4000';
  const path = input.accountType === 'admin' ? '/adminasistenq' : '/member';
  return {
    ok: true,
    expiresAt,
    resetUrl: `${baseUrl}${path}?reset=${token}&type=${input.accountType}`
  };
}

export async function resetPassword(store: Store, input: {
  token: string;
  accountType: 'admin' | 'member';
  password: string;
  now?: Date;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();
  const tokenHash = hashResetToken(input.token);
  const reset = store.data.passwordResets.find((item) => (
    item.accountType === input.accountType &&
    item.tokenHash === tokenHash &&
    !item.usedAt
  ));

  if (!reset || new Date(reset.expiresAt) < now) {
    throw new Error('reset link tidak valid atau sudah kedaluwarsa');
  }

  const account = input.accountType === 'admin'
    ? store.data.admins.find((item) => item.id === reset.accountId && item.active)
    : store.data.members.find((item) => item.id === reset.accountId && item.active);

  if (!account) {
    throw new Error('akun tidak ditemukan');
  }

  account.passwordHash = await bcrypt.hash(input.password, 12);
  reset.usedAt = now.toISOString();
  store.save();

  return { ok: true };
}

export function createProductRecord(store: Store, input: {
  name: string;
  slug: string;
  type: ProductType;
  category?: string;
  visibility?: ProductVisibility;
  accessMode?: ProductAccessMode;
  billingPeriod: BillingPeriod;
  price: number;
  compareAtPrice?: number;
  discountLabel?: string;
  promoText?: string;
  logoUrl?: string;
  landingPath?: string;
  landingTemplate?: string;
  ctaLabel?: string;
  accessRequirement?: string;
  courseMaterials?: CourseMaterial[];
  destinationType?: ProductDestinationType;
  externalUrl?: string;
  openMode?: ProductOpenMode;
  trackLiveUsers?: boolean;
  fulfillmentType?: ProductFulfillmentType;
  downloadSourceUrl?: string;
  installerUrl?: string;
  active?: boolean;
  featured?: boolean;
  headline?: string;
  description?: string;
  coverUrl?: string;
  accessUrl?: string;
  marketplaceCoverUrl?: string;
  marketplaceAccent?: string;
  cardDescription?: string;
  tags?: string[];
  badge?: string;
  gallery?: ProductGalleryItem[];
  benefits?: LandingFeature[];
  features?: LandingFeature[];
  specifications?: Record<string, string>;
  changelog?: string;
  productFaqs?: LandingFaq[];
  targetUsers?: string[];
  developer?: string;
  version?: string;
  fileSize?: string;
  compatibility?: string;
  language?: string;
  latestUpdate?: string;
  sku?: string;
  demoUrl?: string;
  documentationUrl?: string;
  plans?: Array<{
    code: string;
    name: string;
    price: number;
    billingPeriod: BillingPeriod;
    durationDays: number | null;
    isFree?: boolean;
    isActive?: boolean;
    badge?: string;
    highlighted?: boolean;
    sortOrder?: number;
  }>;
}): Product {
  if (store.data.products.some((product) => product.slug === input.slug)) {
    throw new Error('product slug already exists');
  }

  const product = createProduct(input);
  store.data.products.push(product);
  for (const plan of input.plans ?? []) {
    if (plan.isActive === false) continue;
    store.data.plans.push({
      id: createId('plan'),
      productId: product.id,
      code: plan.code.trim().toUpperCase(),
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      isFree: plan.isFree ?? plan.price === 0,
      isActive: true,
      badge: plan.badge,
      highlighted: plan.highlighted,
      sortOrder: plan.sortOrder
    });
  }
  store.save();
  return product;
}

export function updateProductRecord(store: Store, productId: string, input: Partial<{
  name: string;
  slug: string;
  type: ProductType;
  category: string;
  visibility: ProductVisibility;
  accessMode: ProductAccessMode;
  billingPeriod: BillingPeriod;
  price: number;
  compareAtPrice: number;
  discountLabel: string;
  promoText: string;
  logoUrl: string;
  landingPath: string;
  landingTemplate: string;
  ctaLabel: string;
  accessRequirement: string;
  courseMaterials: CourseMaterial[];
  destinationType: ProductDestinationType;
  externalUrl: string;
  openMode: ProductOpenMode;
  trackLiveUsers: boolean;
  fulfillmentType: ProductFulfillmentType;
  downloadSourceUrl: string;
  installerUrl: string;
  active: boolean;
  featured: boolean;
  headline: string;
  description: string;
  coverUrl: string;
  accessUrl: string;
  marketplaceCoverUrl: string;
  marketplaceAccent: string;
  cardDescription: string;
  tags: string[];
  badge: string;
  gallery: ProductGalleryItem[];
  benefits: LandingFeature[];
  features: LandingFeature[];
  specifications: Record<string, string>;
  changelog: string;
  productFaqs: LandingFaq[];
  targetUsers: string[];
  developer: string;
  version: string;
  fileSize: string;
  compatibility: string;
  language: string;
  latestUpdate: string;
  sku: string;
  demoUrl: string;
  documentationUrl: string;
}>): Product {
  const product = store.data.products.find((item) => item.id === productId);

  if (!product) {
    throw new Error('product not found');
  }

  if (input.slug && input.slug !== product.slug && store.data.products.some((item) => item.slug === input.slug)) {
    throw new Error('product slug already exists');
  }

  Object.assign(product, {
    ...input,
    updatedAt: new Date().toISOString()
  });
  store.save();
  return product;
}

export function deleteProductRecord(store: Store, productId: string): Product {
  const product = store.data.products.find((item) => item.id === productId);
  if (!product) throw new Error('product not found');

  const hasCustomerData = store.data.orders.some((order) => order.productId === productId || order.orderItems?.some((item) => item.productId === productId))
    || store.data.licenses.some((license) => license.productId === productId)
    || store.data.subscriptions.some((subscription) => subscription.productId === productId)
    || store.data.accessGrants.some((grant) => grant.productId === productId)
    || store.data.downloadGrants.some((grant) => grant.productId === productId);
  if (hasCustomerData) throw new Error('Produk sudah memiliki transaksi atau akses member. Ubah visibilitas menjadi Draft jika ingin menyembunyikannya.');

  store.data.products = store.data.products.filter((item) => item.id !== productId);
  store.data.plans = store.data.plans.filter((item) => item.productId !== productId);
  store.data.vouchers = store.data.vouchers.filter((item) => item.productId !== productId);
  store.data.announcements = store.data.announcements.filter((item) => item.productId !== productId);
  store.data.bannedHwids = store.data.bannedHwids.filter((item) => item.productId !== productId);
  store.data.toolAnalyticsEvents = store.data.toolAnalyticsEvents.filter((item) => item.productId !== productId);
  store.save();
  return product;
}

export function createPlanRecord(store: Store, input: {
  productId: string;
  code: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  durationDays: number | null;
  isFree?: boolean;
  isActive?: boolean;
  badge?: string;
  highlighted?: boolean;
  sortOrder?: number;
}): ProductPlan {
  if (!store.data.products.some((product) => product.id === input.productId)) {
    throw new Error('product not found');
  }

  const code = input.code.trim().toUpperCase();
  const existingPlan = store.data.plans.find((plan) => (
    plan.productId === input.productId && plan.code === code
  ));

  if (existingPlan) {
    return existingPlan;
  }

  const plan: ProductPlan = {
    id: createId('plan'),
    productId: input.productId,
    code,
    name: input.name,
    price: input.price,
    billingPeriod: input.billingPeriod,
    durationDays: input.durationDays,
    isFree: input.isFree ?? input.price === 0,
    isActive: input.isActive ?? true,
    badge: input.badge,
    highlighted: input.highlighted ?? false,
    sortOrder: input.sortOrder
  };

  store.data.plans.push(plan);
  store.save();
  return plan;
}

export function updatePlanRecord(store: Store, planId: string, input: Partial<Pick<ProductPlan, 'name' | 'price' | 'durationDays' | 'isActive' | 'badge' | 'highlighted' | 'sortOrder'>>): ProductPlan {
  const plan = store.data.plans.find((item) => item.id === planId);
  if (!plan) throw new Error('plan not found');
  if (input.price !== undefined && (!Number.isInteger(input.price) || input.price < 0)) throw new Error('harga tidak valid');
  if (input.durationDays !== undefined && input.durationDays !== null && (!Number.isInteger(input.durationDays) || input.durationDays <= 0)) throw new Error('durasi tidak valid');
  if (input.sortOrder !== undefined && !Number.isInteger(input.sortOrder)) throw new Error('urutan tidak valid');
  if (input.highlighted) {
    store.data.plans
      .filter((item) => item.productId === plan.productId && item.id !== plan.id)
      .forEach((item) => { item.highlighted = false; });
  }
  Object.assign(plan, input);
  if (plan.badge !== undefined) plan.badge = plan.badge.trim() || undefined;
  store.save();
  return plan;
}

export const invoiceLifetimeHours = 24;
export const invoiceReminderHours = 3;

type CheckoutOptions = {
  planId?: string;
  price?: number;
  telegramId?: string;
  lifetimeMinutes?: number;
  reusePending?: boolean;
};

const checkoutQueues = new WeakMap<Store, Promise<void>>();

async function serializeCheckout<T>(store: Store, operation: () => Promise<T>): Promise<T> {
  const previous = checkoutQueues.get(store) ?? Promise.resolve();
  const result = previous.then(operation);
  const tail = result.then(() => undefined, () => undefined);
  checkoutQueues.set(store, tail);

  try {
    return await result;
  } finally {
    if (checkoutQueues.get(store) === tail) checkoutQueues.delete(store);
  }
}

function allocateUniquePaymentCode(store: Store, now: Date): number {
  const usedCodes = new Set(store.data.orders
    .filter((order) => {
      if (order.status !== 'pending' || order.uniqueCode === undefined) return false;
      const expiresAt = order.expiresAt
        ? new Date(order.expiresAt)
        : new Date(new Date(order.createdAt).getTime() + invoiceLifetimeHours * 60 * 60 * 1000);
      return expiresAt > now;
    })
    .map((order) => order.uniqueCode));
  const firstCode = Math.floor(Math.random() * 99) + 1;

  for (let offset = 0; offset < 99; offset += 1) {
    const candidate = 1 + ((firstCode - 1 + offset) % 99);
    if (!usedCodes.has(candidate)) return candidate;
  }

  throw new Error('kode unik pembayaran tidak tersedia');
}

export function canAccessLicenseOrder(order: Order | undefined, accessToken: string): boolean {
  if (!order || !order.accessTokenHash) return false;
  const candidate = crypto.createHash('sha256').update(accessToken).digest('hex');
  const left = Buffer.from(candidate, 'hex');
  const right = Buffer.from(order.accessTokenHash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function orderAccessToken(orderId: string, idempotencyKey: string): string {
  return crypto.createHmac('sha256', process.env.JWT_SECRET ?? 'vjstudio_jwt_secret_2026')
    .update(`${orderId}:${idempotencyKey}`)
    .digest('hex');
}

export async function createCartCheckout(
  store: Store,
  memberId: string,
  input: {
    items: Array<{ productId: string; planId?: string; quantity?: number }>;
    customerHwid?: string;
    voucherCode?: string;
  },
  now = new Date()
): Promise<Order> {
  return serializeCheckout(store, async () => {
    const member = store.data.members.find((item) => item.id === memberId);
    const { items, amount } = validateCart(store, {
      items: input.items.map((item) => ({ productId: item.productId, planId: item.planId ?? '' })),
      voucherCode: input.voucherCode,
      customerHwid: input.customerHwid
    }, now);
    const uniqueCode = amount > 0 ? allocateUniquePaymentCode(store, now) : 0;
    const totalAmount = amount + uniqueCode;
    const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(store.data.orders.length + 1).padStart(4, '0')}`;
    const expiresAt = new Date(now.getTime() + invoiceLifetimeHours * 60 * 60 * 1000).toISOString();
    const generatedQris = amount > 0
      ? await generateDynamicQris(store.data.deploymentSettings?.qrisStaticPayload ?? '', totalAmount)
      : undefined;

    const orderItems: OrderItem[] = items.map((item) => ({
      id: createId('orderitem'),
      productId: item.productId,
      planId: item.planId,
      productName: item.productName,
      planName: item.planName,
      unitAmount: item.unitAmount,
      fulfillmentType: item.fulfillmentType,
      fulfillmentStatus: 'pending'
    }));

    const order: Order = {
      id: createId('order'),
      memberId,
      productId: orderItems[0].productId,
      planId: orderItems[0].planId,
      productName: orderItems.length === 1 ? orderItems[0].productName : `${orderItems[0].productName} + ${orderItems.length - 1} produk lainnya`,
      invoiceNumber,
      orderItems,
      customerHwid: input.customerHwid ? normalizeHwid(input.customerHwid) : undefined,
      uniqueCode,
      amount,
      totalAmount,
      status: 'pending',
      qrisPayload: generatedQris?.payload ?? '',
      paymentQrUrl: generatedQris?.dataUrl,
      paymentProofStatus: 'none',
      createdAt: now.toISOString(),
      expiresAt
    };

    store.data.orders.push(order);
    await tryAttachSakuRupiahInvoice(store, order, orderItems);
    store.save();
    return order;
  });
}

async function createCheckoutLocked(
  store: Store,
  memberId: string,
  productId: string,
  now: Date,
  options: CheckoutOptions
): Promise<Order> {
  const member = store.data.members.find((item) => item.id === memberId);
  const product = store.data.products.find((item) => item.id === productId && item.active);

  if (!member) {
    throw new Error('member not found');
  }

  if (!product) {
    throw new Error('product not found');
  }

  if (options.reusePending) {
    expirePendingOrders(store, now);
    const reusable = store.data.orders.find((order) => (
      order.memberId === memberId &&
      order.productId === productId &&
      order.planId === options.planId &&
      order.status === 'pending' &&
      Boolean(order.expiresAt && new Date(order.expiresAt) > now)
    ));
    if (reusable) return reusable;
  }

  const amount = options.price ?? product.price;
  const uniqueCode = amount > 0 ? allocateUniquePaymentCode(store, now) : 0;
  const totalAmount = amount + uniqueCode;
  const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(store.data.orders.length + 1).padStart(4, '0')}`;
  const lifetimeMs = options.lifetimeMinutes === undefined
    ? invoiceLifetimeHours * 60 * 60 * 1000
    : options.lifetimeMinutes * 60 * 1000;
  const expiresAt = new Date(now.getTime() + lifetimeMs).toISOString();
  const generatedQris = amount > 0
    ? await generateDynamicQris(store.data.deploymentSettings?.qrisStaticPayload ?? '', totalAmount)
    : undefined;

  const order: Order = {
    id: createId('order'),
    memberId,
    productId,
    invoiceNumber,
    productName: product.name,
    planId: options.planId,
    telegramId: options.telegramId,
    uniqueCode,
    amount,
    totalAmount,
    status: 'pending',
    qrisPayload: generatedQris?.payload ?? '',
    paymentQrUrl: generatedQris?.dataUrl,
    paymentProofStatus: 'none',
    createdAt: now.toISOString(),
    expiresAt
  };

  store.data.orders.push(order);
  await tryAttachSakuRupiahInvoice(store, order);
  store.save();
  return order;
}

export function expirePendingOrders(store: Store, now = new Date()): number {
  let count = 0;
  for (const order of store.data.orders) {
    const expiresAt = order.expiresAt
      ? new Date(order.expiresAt)
      : new Date(new Date(order.createdAt).getTime() + invoiceLifetimeHours * 60 * 60 * 1000);
    if (order.status === 'pending' && expiresAt < now) {
      order.status = 'expired';
      order.expiresAt = expiresAt.toISOString();
      count += 1;
    }
  }
  if (count > 0) store.save();
  return count;
}

export async function createCheckout(
  store: Store,
  memberId: string,
  productId: string,
  now = new Date(),
  options: CheckoutOptions = {}
): Promise<Order> {
  return serializeCheckout(store, () => createCheckoutLocked(store, memberId, productId, now, options));
}

async function tryAttachSakuRupiahInvoice(store: Store, order: Order, items: OrderItem[] = []): Promise<void> {
  const settings = store.data.deploymentSettings;
  if (!settings?.sakuRupiahApiId?.trim() || !settings?.sakuRupiahApiKey?.trim()) return;
  try {
    const baseUrl = process.env.APP_URL ?? 'https://asistenq.com';
    const callbackUrl = `${baseUrl}/api/payments/sakurupiah/callback`;
    const returnUrl = `${baseUrl}/orders/${order.id}`;
    const res = await createSakuRupiahInvoice(settings, order, items, callbackUrl, returnUrl);
    if (res.success) {
      if (res.trxId) order.sakuRupiahTrxId = res.trxId;
      if (res.checkoutUrl) order.sakuRupiahCheckoutUrl = res.checkoutUrl;
      if (res.qrPayload) order.qrisPayload = res.qrPayload;
      if (res.qrDataUrl || res.checkoutUrl) order.paymentQrUrl = res.qrDataUrl || res.checkoutUrl;
    }
  } catch (error) {
    console.error('SakuRupiah invoice creation fallback:', error);
  }
}

export async function createLicenseCheckout(store: Store, input: {
  productSlug: string;
  planCode: string;
  email: string;
  hwid?: string;
  idempotencyKey: string;
  voucherCode?: string;
}, now = new Date()): Promise<{ order: Order; accessToken: string }> {
  expirePendingOrders(store, now);
  const product = findProductBySlug(store, input.productSlug);
  const plan = findPlanByCode(store, product.id, input.planCode);
  if (!plan.isActive) throw new Error('paket tidak aktif');
  const email = normalizeEmail(input.email);
  const hwid = input.hwid ? normalizeHwid(input.hwid) : undefined;
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error('idempotency key wajib diisi');

  const reusable = store.data.orders.find((item) => (
    item.productId === product.id &&
    item.planId === plan.id &&
    item.customerEmail === email &&
    item.customerHwid === hwid &&
    item.status === 'pending' &&
    Boolean(item.expiresAt && new Date(item.expiresAt) > now)
  ));
  if (reusable?.idempotencyKey) {
    return { order: reusable, accessToken: orderAccessToken(reusable.id, reusable.idempotencyKey) };
  }

  const validLicense = hwid && store.data.licenses.some((license) => (
    license.productId === product.id &&
    license.email === email &&
    license.hwid === hwid &&
    (license.status === 'generated' || license.status === 'active') &&
    (!license.expiresAt || new Date(`${license.expiresAt}T23:59:59.999Z`) >= now)
  ));
  if (validLicense) throw new Error('Lisensi untuk perangkat ini masih aktif.');

  let member = store.data.members.find((item) => item.email === email);
  if (!member) {
    member = await createMember(store, {
      name: email.split('@')[0] || 'VJ Studio Buyer',
      email,
      password: crypto.randomBytes(24).toString('base64url')
    });
  }

  let price = plan.price;
  let voucherId: string | undefined;
  let discountAmount = 0;
  if (input.voucherCode?.trim()) {
    const result = verifyVoucher(store, { productSlug: product.slug, code: input.voucherCode });
    if (!result.valid || !result.voucher) throw new Error(result.message ?? 'Voucher tidak valid.');
    voucherId = result.voucher.id;
    discountAmount = result.voucher.discountType === 'percent'
      ? Math.floor(price * Math.min(result.voucher.discountValue, 100) / 100)
      : Math.min(price, result.voucher.discountValue);
    price -= discountAmount;
  }

  const order = await createCheckout(store, member.id, product.id, now, {
    planId: plan.id,
    price,
    lifetimeMinutes: 30
  });
  const accessToken = orderAccessToken(order.id, idempotencyKey);
  Object.assign(order, {
    customerEmail: email,
    customerHwid: hwid,
    idempotencyKey,
    accessTokenHash: crypto.createHash('sha256').update(accessToken).digest('hex'),
    voucherId,
    discountAmount
  });
  store.save();
  return { order, accessToken };
}

export function generateToolLicense(store: Store, input: {
  productSlug: string;
  planCode: string;
  email: string;
  hwid: string;
  now?: Date;
  salt?: string;
}): ToolLicense {
  const product = findProductBySlug(store, input.productSlug);
  const plan = findPlanByCode(store, product.id, input.planCode);
  const now = input.now ?? new Date();
  const expiresAt = resolveLicenseExpiry(now, plan.durationDays);
  const key = generateLicenseKey({
    hwid: input.hwid,
    expiresAt,
    salt: input.salt ?? process.env.LICENSE_SECRET_SALT ?? 'vjstudio_secret_salt_2026_xyz'
  });

  const license: ToolLicense = {
    id: createId('license'),
    productId: product.id,
    planId: plan.id,
    email: normalizeEmail(input.email),
    hwid: normalizeHwid(input.hwid),
    key,
    status: 'generated',
    generatedAt: now.toISOString(),
    expiresAt: formatExpiryDate(expiresAt)
  };

  store.data.licenses.push(license);
  store.save();
  return license;
}

export function isHwidBanned(store: Store, productId: string, hwid: string): boolean {
  const normalized = normalizeHwid(hwid);
  return store.data.bannedHwids.some((item) => item.productId === productId && item.hwid === normalized);
}

export function activateLicense(store: Store, input: {
  productSlug: string;
  token: string;
  hwid: string;
  now?: Date;
}): { status: 'success'; message: string } {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);

  if (isHwidBanned(store, product.id, normalizedHwid)) {
    throw new Error('HWID is banned');
  }

  const license = store.data.licenses.find((item) => (
    item.productId === product.id &&
    item.key === input.token.trim() &&
    item.hwid === normalizedHwid
  ));

  if (!license) {
    throw new Error('Invalid license');
  }

  license.status = 'active';
  license.activatedAt = (input.now ?? new Date()).toISOString();
  store.save();

  return { status: 'success', message: 'Activated' };
}

export function verifyLicense(store: Store, input: {
  productSlug: string;
  token: string;
  hwid: string;
}): { valid: boolean; status?: LicenseStatus; message?: string } {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);

  if (isHwidBanned(store, product.id, normalizedHwid)) {
    return { valid: false, message: 'HWID is banned' };
  }

  const license = store.data.licenses.find((item) => (
    item.productId === product.id &&
    item.key === input.token.trim() &&
    item.hwid === normalizedHwid
  ));

  if (!license) {
    return { valid: false, message: 'Invalid license' };
  }

  return {
    valid: license.status === 'active' || license.status === 'generated',
    status: license.status
  };
}

export function banHwid(store: Store, input: {
  productSlug: string;
  hwid: string;
  reason: string;
}): BannedHwid {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  const existing = store.data.bannedHwids.find((item) => (
    item.productId === product.id && item.hwid === normalizedHwid
  ));

  if (existing) {
    return existing;
  }

  const banned: BannedHwid = {
    id: createId('ban'),
    productId: product.id,
    hwid: normalizedHwid,
    reason: input.reason,
    createdAt: new Date().toISOString()
  };

  store.data.bannedHwids.push(banned);
  store.data.licenses
    .filter((license) => license.productId === product.id && license.hwid === normalizedHwid)
    .forEach((license) => {
      license.status = 'banned';
    });
  store.save();
  return banned;
}

export function unbanHwid(store: Store, input: {
  productSlug: string;
  hwid: string;
}): { removed: boolean } {
  const product = findProductBySlug(store, input.productSlug);
  const normalizedHwid = normalizeHwid(input.hwid);
  const previousLength = store.data.bannedHwids.length;

  store.data.bannedHwids = store.data.bannedHwids.filter((item) => (
    item.productId !== product.id || item.hwid !== normalizedHwid
  ));
  store.save();

  return { removed: store.data.bannedHwids.length < previousLength };
}

export function resetLicenseDevice(store: Store, input: {
  licenseId: string;
  newHwid: string;
  actorType?: 'member' | 'admin';
  actorId?: string;
  now?: Date;
  salt?: string;
}): ToolLicense & { resetQuota: { limit: number; remaining: number; nextAvailableAt: string | null } } {
  const license = store.data.licenses.find((item) => item.id === input.licenseId);

  if (!license) {
    throw new Error('license not found');
  }

  const oldHwid = license.hwid;
  if (oldHwid === normalizeHwid(input.newHwid)) {
    throw new Error('HWID baru harus berbeda.');
  }

  const now = input.now ?? new Date();
  const actorType = input.actorType ?? 'admin';
  const actorId = input.actorId ?? 'system-admin';
  const resetWindowMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - resetWindowMs;
  const recentMemberResets = store.data.licenseDeviceResetEvents
    .filter((event) => event.licenseId === license.id && event.actorType === 'member' && new Date(event.createdAt).getTime() > cutoff)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (actorType === 'member' && recentMemberResets.length >= 2) {
    throw new Error('Batas reset perangkat 2 kali dalam 7 hari telah habis.');
  }

  const existingBan = store.data.bannedHwids.find((item) => (
    item.productId === license.productId && item.hwid === oldHwid
  ));
  if (!existingBan) {
    store.data.bannedHwids.push({
      id: createId('ban'),
      productId: license.productId,
      hwid: oldHwid,
      reason: 'device reset',
      createdAt: new Date().toISOString()
    });
  }

  license.hwid = normalizeHwid(input.newHwid);
  license.key = generateLicenseKey({
    hwid: license.hwid,
    expiresAt: expiryCodeFromLicense(license),
    salt: input.salt ?? process.env.LICENSE_SECRET_SALT ?? 'vjstudio_secret_salt_2026_xyz'
  });
  license.status = 'generated';
  delete license.activatedAt;
  store.data.licenseDeviceResetEvents.push({
    id: createId('reset'),
    licenseId: license.id,
    oldHwid,
    newHwid: license.hwid,
    actorType,
    actorId,
    createdAt: now.toISOString()
  });
  store.save();
  const memberEventsAfterReset = actorType === 'member'
    ? [...recentMemberResets, store.data.licenseDeviceResetEvents.at(-1)!]
    : recentMemberResets;
  return {
    ...license,
    resetQuota: {
      limit: 2,
      remaining: Math.max(0, 2 - memberEventsAfterReset.length),
      nextAvailableAt: memberEventsAfterReset.length >= 2
        ? new Date(new Date(memberEventsAfterReset[0].createdAt).getTime() + resetWindowMs).toISOString()
        : null
    }
  };
}

export function adminLicenseDashboard(store: Store) {
  return {
    licenses: store.data.licenses
      .map((license) => licenseDashboardRow(store, license))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    plans: store.data.plans.map((plan) => productPlanRow(store, plan)),
    bannedHwids: store.data.bannedHwids
  };
}

export function memberLicenseDashboard(store: Store, memberId: string) {
  const member = store.data.members.find((item) => item.id === memberId);

  if (!member) {
    throw new Error('member not found');
  }

  const email = normalizeEmail(member.email);
  return {
    member: {
      id: member.id,
      name: member.name,
      email: member.email
    },
    licenses: store.data.licenses
      .filter((license) => license.email === email)
      .map((license) => licenseDashboardRow(store, license))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    subscriptions: store.data.subscriptions
      .filter((subscription) => subscription.memberId === member.id)
      .map((subscription) => ({
        ...subscription,
        product: store.data.products.find((product) => product.id === subscription.productId)
      }))
  };
}

export function verifyVoucher(store: Store, input: {
  productSlug: string;
  code: string;
}): { valid: boolean; message?: string; voucher?: Voucher } {
  const product = findProductBySlug(store, input.productSlug);
  const code = input.code.trim().toUpperCase();
  const now = new Date();
  const voucher = store.data.vouchers.find((item) => (
    item.code === code &&
    item.active &&
    (item.productId === null || item.productId === product.id)
  ));

  if (!voucher) {
    return { valid: false, message: 'Voucher tidak valid / kedaluwarsa.' };
  }

  if (voucher.expiresAt && new Date(voucher.expiresAt) < now) {
    return { valid: false, message: 'Voucher tidak valid / kedaluwarsa.' };
  }

  if (voucher.maxUse !== null && voucher.usedCount >= voucher.maxUse) {
    return { valid: false, message: 'Voucher tidak valid / kedaluwarsa.' };
  }

  return { valid: true, voucher };
}

export function publicPlansForProduct(store: Store, productSlug: string) {
  const product = findProductBySlug(store, productSlug);

  return store.data.plans
    .filter((plan) => plan.productId === product.id && plan.isActive)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.price - b.price)
    .map((plan) => ({
      productSlug: product.slug,
      id: plan.code,
      code: plan.code,
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      isFree: plan.isFree,
      badge: plan.badge,
      highlighted: plan.highlighted ?? false,
      sortOrder: plan.sortOrder
    }));
}

export function productLicenseConfig(store: Store, productSlug: string) {
  const product = findProductBySlug(store, productSlug);
  const announcement = store.data.announcements.find((item) => item.productId === product.id && item.enabled);

  return {
    version: 1,
    product: product.slug,
    updatedAt: product.updatedAt,
    plans: publicPlansForProduct(store, productSlug),
    announcement: announcement ?? null,
    supportUrl: process.env.TELEGRAM_SUPPORT_URL ?? ''
  };
}

export function publicCatalog(store: Store) {
  const publicProducts = store.data.products.filter((product) => (
    product.visibility === 'public' &&
    product.active
  ));

  return {
    featured: publicProducts.filter((product) => product.featured),
    paid: publicProducts.filter((product) => product.price > 0),
    free: publicProducts.filter((product) => product.price === 0 || product.type === 'free')
  };
}

export function markOrderPaid(store: Store, orderId: string, paidAt = new Date()): {
  order: Order;
  subscription: Subscription;
} {
  const order = store.data.orders.find((item) => item.id === orderId);

  if (!order) {
    throw new Error('order not found');
  }

  const product = store.data.products.find((item) => item.id === order.productId);

  if (!product) {
    throw new Error('product not found');
  }

  if (order.status === 'paid') {
    const subscription = store.data.subscriptions.find((item) => (
      item.memberId === order.memberId && item.productId === order.productId
    ));
    if (!subscription) throw new Error('paid order subscription not found');
    return { order, subscription };
  }

  if (order.status !== 'pending') {
    throw new Error(`order ${order.status} cannot be marked paid`);
  }

  order.status = 'paid';
  order.paidAt = paidAt.toISOString();

  const subscription = createSubscription({
    memberId: order.memberId,
    productId: order.productId,
    billingPeriod: product.billingPeriod,
    paidAt
  });

  store.data.subscriptions.push(subscription);
  store.save();
  return { order, subscription };
}

export function listPendingOrders(store: Store, limit = 10) {
  expirePendingOrders(store);
  return store.data.orders
    .filter((order) => order.status === 'pending')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((order) => {
      const product = store.data.products.find((item) => item.id === order.productId);
      const member = store.data.members.find((item) => item.id === order.memberId);
      return {
        id: order.id,
        invoiceNumber: order.invoiceNumber ?? order.id,
        productName: product?.name ?? order.productName ?? order.productId,
        productSlug: product?.slug ?? '',
        memberName: member?.name ?? '',
        memberEmail: member?.email ?? order.memberId,
        totalAmount: order.totalAmount ?? order.amount,
        formattedTotalAmount: formatCurrency(order.totalAmount ?? order.amount),
        createdAt: order.createdAt
      };
    });
}

export function markOrderPaidByInvoice(store: Store, invoiceNumber: string, paidAt = new Date()) {
  const order = store.data.orders.find((item) => (
    item.invoiceNumber === invoiceNumber || item.id === invoiceNumber
  ));

  if (!order) {
    throw new Error('order not found');
  }

  if (order.status === 'paid') {
    const subscription = store.data.subscriptions.find((item) => (
      item.memberId === order.memberId && item.productId === order.productId
    ));
    if (subscription) return { order, subscription };
  }

  return markOrderPaid(store, order.id, paidAt);
}

export function generateLicenseForPaidOrder(store: Store, input: {
  invoiceNumber: string;
  hwid: string;
  planCode?: string;
  now?: Date;
  salt?: string;
}): ToolLicense {
  const order = store.data.orders.find((item) => (
    item.invoiceNumber === input.invoiceNumber || item.id === input.invoiceNumber
  ));

  if (!order) {
    throw new Error('order not found');
  }

  if (order.status !== 'paid') {
    throw new Error('order belum paid');
  }

  const existing = store.data.licenses.find((item) => item.orderId === order.id);
  if (existing) return existing;

  const product = store.data.products.find((item) => item.id === order.productId);
  const member = store.data.members.find((item) => item.id === order.memberId);

  if (!product) {
    throw new Error('product not found');
  }

  if (!member) {
    throw new Error('member not found');
  }

  const requestedPlanCode = input.planCode?.trim().toUpperCase();
  const activePlans = store.data.plans
    .filter((plan) => plan.productId === product.id && plan.isActive)
    .sort((left, right) => left.price - right.price);
  const matchingPlan = order.planId
    ? store.data.plans.find((plan) => plan.id === order.planId && plan.productId === product.id)
    : requestedPlanCode
      ? activePlans.find((plan) => plan.code === requestedPlanCode)
      : activePlans.find((plan) => plan.price === order.amount) ?? activePlans[0];

  if (!matchingPlan) {
    throw new Error('plan not found');
  }

  const license = generateToolLicense(store, {
    productSlug: product.slug,
    planCode: matchingPlan.code,
    email: member.email,
    hwid: input.hwid,
    now: input.now,
    salt: input.salt
  });
  license.orderId = order.id;
  store.data.auditLogs.push({
    id: crypto.randomUUID(),
    actorId: order.telegramId ?? order.memberId,
    action: 'telegram.license.fulfilled',
    targetType: 'license',
    targetId: license.id,
    createdAt: (input.now ?? new Date()).toISOString()
  });
  store.save();
  return license;
}

export function generateDirectToolLicense(store: Store, input: {
  productSlug: string;
  planCode: string;
  email: string;
  hwid: string;
  now?: Date;
  salt?: string;
}): { license: ToolLicense; reused: boolean; buyerTelegramId?: string } {
  const product = findProductBySlug(store, input.productSlug);
  findPlanByCode(store, product.id, input.planCode);
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  const hwid = normalizeHwid(input.hwid);
  const linkedMember = store.data.members.find((member) => member.active && member.email === email && member.telegramId);
  const existing = store.data.licenses.find((license) => (
    license.productId === product.id &&
    license.email === email &&
    license.hwid === hwid &&
    ['generated', 'active'].includes(license.status) &&
    (!license.expiresAt || new Date(`${license.expiresAt}T23:59:59.999Z`) >= now)
  ));

  if (existing) return { license: existing, reused: true, buyerTelegramId: linkedMember?.telegramId };

  const license = generateToolLicense(store, { ...input, email, hwid, now });
  return { license, reused: false, buyerTelegramId: linkedMember?.telegramId };
}

export function formatInvoiceHtml(store: Store, orderIdOrInvoice: string, memberId?: string): string {
  const order = store.data.orders.find((item) => (
    item.id === orderIdOrInvoice || item.invoiceNumber === orderIdOrInvoice
  ));

  if (!order || (memberId && order.memberId !== memberId)) {
    throw new Error('order not found');
  }

  const product = store.data.products.find((item) => item.id === order.productId);
  const member = store.data.members.find((item) => item.id === order.memberId);
  const invoiceNumber = order.invoiceNumber ?? order.id;
  const total = formatCurrency(order.totalAmount ?? order.amount);

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${escapeHtml(invoiceNumber)}</title>
    <style>
      :root { --ink:#062c28; --muted:#60746f; --line:#d8e8e2; --soft:#f4fbf8; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--soft); color: var(--ink); font-family: Arial, sans-serif; }
      main { max-width: 760px; margin: 24px auto; background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 24px; box-shadow: 0 18px 50px rgba(6,44,40,.08); }
      header { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 18px; align-items: start; border-bottom: 1px solid var(--line); padding-bottom: 16px; }
      h1 { margin: 4px 0 6px; font-size: 28px; line-height: 1; letter-spacing: -.04em; }
      h2 { margin: 0; font-size: 18px; }
      p { margin: 0; }
      .muted { color: var(--muted); }
      .brand { text-align: right; }
      .pill { display: inline-flex; border-radius: 999px; background: #e8f7f1; color: #007d74; font-size: 11px; font-weight: 800; letter-spacing: .1em; padding: 7px 10px; text-transform: uppercase; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--muted); font-size: 12px; }
      .summary { display: grid; grid-template-columns: 1.15fr .85fr; gap: 16px; margin-top: 18px; align-items: start; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .box { border: 1px solid var(--line); border-radius: 14px; padding: 11px 12px; min-height: 74px; }
      .box span, .total span { display: block; color: var(--muted); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
      .box b { display: block; margin-top: 5px; font-size: 16px; line-height: 1.15; }
      .box p { margin-top: 6px; color: var(--muted); font-size: 13px; }
      .payment { display: grid; gap: 10px; }
      .total { background: var(--ink); color: #fff; border-radius: 16px; padding: 14px; }
      .total span { color: #b8ddd2; }
      .total b { display: block; margin-top: 4px; font-size: 25px; letter-spacing: -.03em; }
      .qris { border: 1px solid var(--line); border-radius: 18px; padding: 10px; background: #fff; }
      img { width: 100%; max-width: 230px; display: block; margin: 0 auto; border-radius: 14px; }
      .note { margin-top: 16px; border: 1px dashed #b7d8cf; border-radius: 14px; padding: 12px; color: var(--muted); font-size: 13px; line-height: 1.45; background: #fbfffd; }
      button { border: 0; border-radius: 999px; background: var(--ink); color: #fff; padding: 10px 16px; font-weight: 800; cursor: pointer; }
      .no-print { margin-top: 14px; }
      @media print { body { background: #fff; } main { margin: 0; border: 0; box-shadow: none; } .no-print { display: none; } }
      @media (max-width: 640px) { main { margin: 10px; padding: 16px; } header, .summary, .grid { grid-template-columns: 1fr; } .brand { text-align: left; } h1 { font-size: 24px; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <span class="pill">Invoice QRIS</span>
          <h1>${escapeHtml(invoiceNumber)}</h1>
          <div class="meta">
            <span>${escapeHtml(new Date(order.createdAt).toLocaleString('id-ID'))}</span>
            <span>Status: ${escapeHtml(order.status)}</span>
            <span>Batas: ${escapeHtml(order.expiresAt ? new Date(order.expiresAt).toLocaleString('id-ID') : '24 jam')}</span>
          </div>
        </div>
        <div class="brand">
          <h2>AsistenQ</h2>
          <p class="muted">Tools Bantu nge-YouTube</p>
        </div>
      </header>
      <section class="summary">
        <div class="grid">
          <div class="box"><span>Member</span><b>${escapeHtml(member?.name ?? '-')}</b><p>${escapeHtml(member?.email ?? order.memberId)}</p></div>
          <div class="box"><span>Produk</span><b>${escapeHtml(product?.name ?? order.productName ?? order.productId)}</b><p>${escapeHtml(product?.slug ?? '')}</p></div>
          <div class="box"><span>Harga</span><b>${escapeHtml(formatCurrency(order.amount))}</b></div>
          <div class="box"><span>Kode Unik</span><b>${escapeHtml(order.uniqueCode ?? 0)}</b></div>
        </div>
        <aside class="payment">
          <div class="total"><span>Total Bayar</span><b>${escapeHtml(total)}</b></div>
          ${order.paymentQrUrl ? `<div class="qris"><img src="${escapeHtml(order.paymentQrUrl)}" alt="QRIS pembayaran" /></div>` : ''}
        </aside>
      </section>
      <p class="note">Bayar sesuai total termasuk kode unik. Setelah transfer, kirim bukti pembayaran via Telegram. Lisensi akan muncul di akun member setelah admin memproses pembayaran.</p>
      <p class="no-print"><button onclick="window.print()">Print / Save PDF</button></p>
    </main>
  </body>
</html>`;
}

export async function updateMemberAccount(store: Store, memberId: string, input: {
  name?: string;
  active?: boolean;
  password?: string;
  whatsapp?: string;
  telegramId?: string;
  avatarUrl?: string;
}): Promise<MemberAccount> {
  const member = store.data.members.find((m) => m.id === memberId);
  if (!member) throw new Error('Member tidak ditemukan.');

  if (input.name !== undefined) member.name = input.name;
  if (input.whatsapp !== undefined) member.whatsapp = input.whatsapp.trim();
  if (input.telegramId !== undefined) member.telegramId = input.telegramId.trim();
  if (input.avatarUrl !== undefined) member.avatarUrl = input.avatarUrl;
  if (input.active !== undefined) member.active = input.active;
  if (input.password) {
    const bcrypt = require('bcryptjs');
    member.passwordHash = await bcrypt.hash(input.password, 12);
  }

  store.save();
  return member;
}

export async function updateOwnMemberProfile(store: Store, memberId: string, input: {
  name?: string;
  whatsapp?: string;
  telegramId?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<MemberAccount> {
  const member = store.data.members.find((item) => item.id === memberId);
  if (!member) throw new Error('Member tidak ditemukan.');

  if (input.newPassword) {
    if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, member.passwordHash))) {
      throw new Error('Password saat ini salah.');
    }
    member.passwordHash = await bcrypt.hash(input.newPassword, 12);
  }
  if (input.name !== undefined) member.name = input.name.trim();
  if (input.whatsapp !== undefined) member.whatsapp = input.whatsapp.trim();
  if (input.telegramId !== undefined) member.telegramId = input.telegramId.trim();
  store.save();
  return member;
}
