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
  LicenseStatus,
  MemberAccount,
  Order,
  Product,
  ProductAccessMode,
  ProductDestinationType,
  ProductOpenMode,
  ProductPlan,
  ProductType,
  ProductVisibility,
  Subscription,
  ToolLicense,
  Voucher
} from '../shared/types';
import type { Store } from './store';
import { generateDynamicQris } from './qris';

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
    verifyUrl: '/api/license/verify'
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
  active?: boolean;
  featured?: boolean;
  headline?: string;
  description?: string;
  coverUrl?: string;
  accessUrl?: string;
  plans?: Array<{
    code: string;
    name: string;
    price: number;
    billingPeriod: BillingPeriod;
    durationDays: number | null;
    isFree?: boolean;
    isActive?: boolean;
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
      isActive: true
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
  active: boolean;
  featured: boolean;
  headline: string;
  description: string;
  coverUrl: string;
  accessUrl: string;
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

export function createPlanRecord(store: Store, input: {
  productId: string;
  code: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  durationDays: number | null;
  isFree?: boolean;
  isActive?: boolean;
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
    isActive: input.isActive ?? true
  };

  store.data.plans.push(plan);
  store.save();
  return plan;
}

export const invoiceLifetimeHours = 24;
export const invoiceReminderHours = 3;

export async function createCheckout(store: Store, memberId: string, productId: string, now = new Date()): Promise<Order> {
  const member = store.data.members.find((item) => item.id === memberId);
  const product = store.data.products.find((item) => item.id === productId && item.active);

  if (!member) {
    throw new Error('member not found');
  }

  if (!product) {
    throw new Error('product not found');
  }

  const uniqueCode = product.price > 0 ? Math.floor(Math.random() * 900) + 100 : 0;
  const totalAmount = product.price + uniqueCode;
  const invoiceNumber = `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(store.data.orders.length + 1).padStart(4, '0')}`;
  const expiresAt = new Date(now.getTime() + invoiceLifetimeHours * 60 * 60 * 1000).toISOString();
  const generatedQris = product.price > 0
    ? await generateDynamicQris(store.data.deploymentSettings?.qrisStaticPayload ?? '', totalAmount)
    : undefined;

  const order: Order = {
    id: createId('order'),
    memberId,
    productId,
    invoiceNumber,
    productName: product.name,
    uniqueCode,
    amount: product.price,
    totalAmount,
    status: 'pending',
    qrisPayload: generatedQris?.payload ?? '',
    paymentQrUrl: generatedQris?.dataUrl,
    createdAt: now.toISOString(),
    expiresAt
  };

  store.data.orders.push(order);
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
  salt?: string;
}): ToolLicense {
  const license = store.data.licenses.find((item) => item.id === input.licenseId);

  if (!license) {
    throw new Error('license not found');
  }

  const oldHwid = license.hwid;
  if (oldHwid === normalizeHwid(input.newHwid)) {
    throw new Error('new HWID must be different');
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
  store.save();
  return license;
}

export function adminLicenseDashboard(store: Store) {
  return {
    licenses: store.data.licenses
      .map((license) => licenseDashboardRow(store, license))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    plans: store.data.plans
      .filter((plan) => plan.isActive)
      .map((plan) => productPlanRow(store, plan)),
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
    .map((plan) => ({
      productSlug: product.slug,
      id: plan.code,
      code: plan.code,
      name: plan.name,
      price: plan.price,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      isFree: plan.isFree
    }));
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
  const matchingPlan = requestedPlanCode
    ? activePlans.find((plan) => plan.code === requestedPlanCode)
    : activePlans.find((plan) => plan.price === order.amount) ?? activePlans[0];

  if (!matchingPlan) {
    throw new Error('plan not found');
  }

  return generateToolLicense(store, {
    productSlug: product.slug,
    planCode: matchingPlan.code,
    email: member.email,
    hwid: input.hwid,
    now: input.now,
    salt: input.salt
  });
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
}): Promise<MemberAccount> {
  const member = store.data.members.find((m) => m.id === memberId);
  if (!member) throw new Error('Member tidak ditemukan.');

  if (input.name !== undefined) member.name = input.name;
  if (input.active !== undefined) member.active = input.active;
  if (input.password) {
    const bcrypt = require('bcryptjs');
    member.passwordHash = await bcrypt.hash(input.password, 12);
  }

  store.save();
  return member;
}
