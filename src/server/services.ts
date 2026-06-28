import bcrypt from 'bcryptjs';
import { createId, createProduct, createSubscription } from '../shared/domain';
import type {
  AdminAccount,
  AdminScope,
  BillingPeriod,
  MemberAccount,
  Order,
  Product,
  ProductPlan,
  ProductType,
  ProductVisibility,
  Subscription
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
