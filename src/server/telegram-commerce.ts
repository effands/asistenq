import crypto from 'node:crypto';
import { formatCurrency } from '../shared/domain';
import type { MemberAccount, Order } from '../shared/types';
import type { Store } from './store';
import { createCheckout, createMember, expirePendingOrders } from './services';

export async function registerTelegramBuyer(store: Store, input: {
  telegramId: string;
  name: string;
  email: string;
  whatsapp: string;
}): Promise<MemberAccount> {
  const telegramId = input.telegramId.trim();
  const email = input.email.trim().toLowerCase();
  const byTelegram = store.data.members.find((item) => item.telegramId === telegramId);

  if (byTelegram) {
    return byTelegram;
  }

  const byEmail = store.data.members.find((item) => item.email === email);
  if (byEmail) {
    throw new Error(byEmail.telegramId
      ? 'email sudah terhubung ke akun Telegram lain'
      : 'email sudah terdaftar; hubungkan Telegram melalui dashboard');
  }

  return createMember(store, {
    ...input,
    telegramId,
    password: crypto.randomBytes(24).toString('base64url')
  });
}

export function listTelegramCatalog(store: Store) {
  return store.data.products
    .filter((product) => product.active && product.visibility !== 'draft')
    .map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      type: product.type,
      category: product.category,
      fulfillmentType: product.fulfillmentType,
      headline: product.headline,
      description: product.description,
      coverUrl: product.coverUrl,
      logoUrl: product.logoUrl,
      plans: store.data.plans
        .filter((plan) => plan.productId === product.id && plan.isActive)
        .map((plan) => ({
          id: plan.id,
          productId: plan.productId,
          code: plan.code,
          name: plan.name,
          price: plan.price,
          billingPeriod: plan.billingPeriod,
          durationDays: plan.durationDays,
          isFree: plan.isFree,
          formattedPrice: formatCurrency(plan.price)
        }))
    }))
    .filter((product) => product.plans.length > 0);
}

export const telegramInvoiceLifetimeMinutes = 30;

export async function createTelegramCheckout(store: Store, input: {
  telegramId: string;
  productId: string;
  planId: string;
}, now = new Date()): Promise<Order> {
  expirePendingOrders(store, now);

  const member = store.data.members.find((item) => item.telegramId === input.telegramId);
  if (!member) {
    throw new Error('profil pembeli belum lengkap');
  }

  const product = store.data.products.find((item) => item.id === input.productId && item.active);
  const plan = store.data.plans.find((item) => (
    item.id === input.planId &&
    item.productId === input.productId &&
    item.isActive
  ));
  if (!product || !plan) {
    throw new Error('produk atau paket tidak tersedia');
  }

  const reusable = store.data.orders.find((order) => (
    order.memberId === member.id &&
    order.productId === product.id &&
    order.planId === plan.id &&
    order.status === 'pending' &&
    Boolean(order.expiresAt && new Date(order.expiresAt) > now)
  ));
  if (reusable) {
    return reusable;
  }

  return createCheckout(store, member.id, product.id, now, {
    planId: plan.id,
    price: plan.price,
    telegramId: input.telegramId,
    lifetimeMinutes: telegramInvoiceLifetimeMinutes,
    reusePending: true
  });
}
