import bcrypt from 'bcryptjs';
import {
  createId,
  createProduct,
  createSubscription,
  generateLicenseKey,
  normalizeHwid,
  resolveLicenseExpiry
} from '../shared/domain';
import type {
  AdminAccount,
  AdminScope,
  BannedHwid,
  BillingPeriod,
  LicenseStatus,
  MemberAccount,
  Order,
  Product,
  ProductPlan,
  ProductType,
  ProductVisibility,
  Subscription,
  ToolLicense,
  Voucher
} from '../shared/types';
import type { Store } from './store';

type Actor = {
  role: 'super_admin' | 'admin';
  scopes: AdminScope[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
}): Promise<MemberAccount> {
  const email = normalizeEmail(input.email);

  if (store.data.members.some((member) => member.email === email)) {
    throw new Error('email already exists');
  }

  const member: MemberAccount = {
    id: createId('member'),
    name: input.name,
    email,
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

export function createProductRecord(store: Store, input: {
  name: string;
  slug: string;
  type: ProductType;
  category?: string;
  visibility?: ProductVisibility;
  billingPeriod: BillingPeriod;
  price: number;
  active?: boolean;
  featured?: boolean;
  headline?: string;
  description?: string;
  coverUrl?: string;
  accessUrl?: string;
}): Product {
  if (store.data.products.some((product) => product.slug === input.slug)) {
    throw new Error('product slug already exists');
  }

  const product = createProduct(input);
  store.data.products.push(product);
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

export function createCheckout(store: Store, memberId: string, productId: string): Order {
  const member = store.data.members.find((item) => item.id === memberId);
  const product = store.data.products.find((item) => item.id === productId && item.active);

  if (!member) {
    throw new Error('member not found');
  }

  if (!product) {
    throw new Error('product not found');
  }

  const order: Order = {
    id: createId('order'),
    memberId,
    productId,
    amount: product.price,
    status: 'pending',
    qrisPayload: `ASISTENQ|${product.slug}|${product.price}|${member.email}`,
    createdAt: new Date().toISOString()
  };

  store.data.orders.push(order);
  store.save();
  return order;
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

  license.hwid = normalizeHwid(input.newHwid);
  store.save();
  return license;
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
