import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { formatCurrency } from '../shared/domain';
import type { MemberAccount, Order, ProductFulfillmentType, ProductVisibility } from '../shared/types';
import type { Store } from './store';
import { createCheckout, createMember, createPlanRecord, createProductRecord, expirePendingOrders, markOrderPaidByInvoice, updatePlanRecord, updateProductRecord } from './services';

export type TelegramProductInput = {
  name: string;
  slug: string;
  fulfillmentType: ProductFulfillmentType;
  description: string;
  status: ProductVisibility;
  downloadSourceUrl?: string;
  plan: { code: string; name: string; price: number; durationDays: number | null };
};

function validatedDownloadSource(type: ProductFulfillmentType, source?: string): string | undefined {
  if (type !== 'download' || !source?.trim()) return undefined;
  const value = source.trim();
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error('URL download harus HTTPS.');
  return value;
}

export function createTelegramProduct(store: Store, input: TelegramProductInput) {
  const downloadSourceUrl = validatedDownloadSource(input.fulfillmentType, input.downloadSourceUrl);
  const product = createProductRecord(store, {
    name: input.name.trim(), slug: input.slug.trim(), type: 'tool',
    visibility: input.status, accessMode: 'paid', billingPeriod: 'one_time',
    price: input.plan.price, active: input.status !== 'draft',
    description: input.description.trim(), fulfillmentType: input.fulfillmentType,
    downloadSourceUrl
  });
  const plan = createPlanRecord(store, {
    productId: product.id, code: input.plan.code, name: input.plan.name,
    price: input.plan.price,
    billingPeriod: input.plan.durationDays === null ? 'lifetime' : 'monthly',
    durationDays: input.plan.durationDays, isActive: true
  });
  return { product, plan };
}

export function updateTelegramProduct(store: Store, productId: string, input: Partial<Omit<TelegramProductInput, 'plan'>>) {
  const product = store.data.products.find((item) => item.id === productId);
  if (!product) throw new Error('product not found');
  const fulfillmentType = input.fulfillmentType ?? product.fulfillmentType ?? (product.downloadSourceUrl ? 'download' : 'license');
  const downloadSourceUrl = input.downloadSourceUrl === undefined
    ? product.downloadSourceUrl
    : validatedDownloadSource(fulfillmentType, input.downloadSourceUrl);
  const patch: Parameters<typeof updateProductRecord>[2] = { fulfillmentType };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.status !== undefined) {
    patch.visibility = input.status;
    patch.active = input.status !== 'draft';
  }
  if (fulfillmentType === 'download' && downloadSourceUrl !== undefined) patch.downloadSourceUrl = downloadSourceUrl;
  if (fulfillmentType === 'license') patch.downloadSourceUrl = '';
  return updateProductRecord(store, productId, patch);
}

export function updateTelegramPlan(store: Store, planId: string, input: Partial<{ name: string; price: number; durationDays: number | null; isActive: boolean }>) {
  return updatePlanRecord(store, planId, input);
}

export function deactivateTelegramProduct(store: Store, productId: string) {
  return updateProductRecord(store, productId, { active: false, visibility: 'draft' });
}

export function attachTelegramDigitalFile(store: Store, productId: string, filePath: string) {
  const product = store.data.products.find((item) => item.id === productId);
  if (!product || product.fulfillmentType !== 'download') throw new Error('produk bukan produk download');
  const privateRoot = path.resolve('data/digital-products');
  const absolutePath = path.resolve(filePath);
  if (path.dirname(absolutePath) !== privateRoot || path.extname(absolutePath).toLowerCase() !== '.zip') throw new Error('path file digital tidak valid');
  const signature = fs.readFileSync(absolutePath).subarray(0, 4);
  const zipSignature = signature.length === 4 && signature[0] === 0x50 && signature[1] === 0x4b && (
    (signature[2] === 0x03 && signature[3] === 0x04) ||
    (signature[2] === 0x05 && signature[3] === 0x06) ||
    (signature[2] === 0x07 && signature[3] === 0x08)
  );
  if (!zipSignature) throw new Error('file bukan ZIP yang valid');
  return updateProductRecord(store, productId, { downloadSourceUrl: absolutePath });
}

function audit(store: Store, actorId: string, action: string, targetType: string, targetId: string, now: Date) {
  store.data.auditLogs.push({ id: crypto.randomUUID(), actorId, action, targetType, targetId, createdAt: now.toISOString() });
}

function assertConfiguredOwner(store: Store, telegramId: string) {
  const configured = store.data.deploymentSettings?.telegramOwnerId;
  if (configured && configured !== telegramId) throw new Error('owner access required');
}

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

export function submitPaymentProof(store: Store, input: {
  telegramId: string; invoiceNumber: string; fileId: string;
}, now = new Date()): Order {
  const member = store.data.members.find((item) => item.telegramId === input.telegramId);
  const order = member && store.data.orders.find((item) => item.memberId === member.id && item.invoiceNumber === input.invoiceNumber);
  if (!order) throw new Error('order tidak ditemukan');
  if (order.status !== 'pending') throw new Error('invoice tidak dapat menerima bukti');
  if (order.expiresAt && new Date(order.expiresAt) <= now) throw new Error('invoice sudah kedaluwarsa');
  const fileId = input.fileId.trim();
  if (!fileId) throw new Error('foto bukti pembayaran wajib diisi');
  order.paymentProofFileId = fileId;
  order.paymentProofStatus = 'submitted';
  order.paymentProofSubmittedAt = now.toISOString();
  order.paymentProofReviewedAt = undefined;
  order.paymentProofRejectionReason = undefined;
  order.paymentProofReviewerTelegramId = undefined;
  audit(store, input.telegramId, 'telegram.payment_proof.submitted', 'order', order.id, now);
  store.save();
  return order;
}

export function listSubmittedPaymentProofs(store: Store): Order[] {
  return store.data.orders
    .filter((order) => order.paymentProofStatus === 'submitted')
    .sort((a, b) => (b.paymentProofSubmittedAt ?? '').localeCompare(a.paymentProofSubmittedAt ?? ''));
}

export function reviewPaymentProof(store: Store, input: {
  ownerTelegramId: string; invoiceNumber: string; decision: 'approve' | 'reject'; reason?: string;
}, now = new Date()) {
  assertConfiguredOwner(store, input.ownerTelegramId);
  const order = store.data.orders.find((item) => item.invoiceNumber === input.invoiceNumber || item.id === input.invoiceNumber);
  if (!order || !order.paymentProofFileId) throw new Error('bukti pembayaran tidak ditemukan');
  if (order.status === 'expired') throw new Error('invoice harus dibuka kembali');
  if (input.decision === 'approve' && order.paymentProofStatus === 'approved' && order.status === 'paid') {
    const subscription = store.data.subscriptions.find((item) => item.memberId === order.memberId && item.productId === order.productId);
    return { order, subscription };
  }
  const reason = input.reason?.trim();
  if (input.decision === 'reject' && !reason) throw new Error('alasan penolakan wajib diisi');
  if (input.decision === 'reject' && order.paymentProofStatus === 'rejected' && order.paymentProofRejectionReason === reason) return { order };
  if (order.status !== 'pending' || order.paymentProofStatus !== 'submitted') throw new Error('bukti pembayaran tidak dapat ditinjau');

  let subscription;
  if (input.decision === 'approve') {
    ({ subscription } = markOrderPaidByInvoice(store, input.invoiceNumber, now));
    order.paymentProofStatus = 'approved';
  } else {
    order.paymentProofStatus = 'rejected';
    order.paymentProofRejectionReason = reason;
  }
  order.paymentProofReviewedAt = now.toISOString();
  order.paymentProofReviewerTelegramId = input.ownerTelegramId;
  audit(store, input.ownerTelegramId, `telegram.payment_proof.${input.decision === 'approve' ? 'approved' : 'rejected'}`, 'order', order.id, now);
  store.save();
  return { order, subscription };
}

export function reopenTelegramInvoice(store: Store, input: {
  ownerTelegramId: string; invoiceNumber: string;
}, now = new Date()): Order {
  assertConfiguredOwner(store, input.ownerTelegramId);
  const order = store.data.orders.find((item) => item.invoiceNumber === input.invoiceNumber || item.id === input.invoiceNumber);
  if (!order || order.status !== 'expired' || order.paymentProofStatus !== 'submitted' || !order.paymentProofFileId) {
    throw new Error('invoice tidak dapat dibuka kembali');
  }
  order.status = 'pending';
  order.expiresAt = new Date(now.getTime() + telegramInvoiceLifetimeMinutes * 60_000).toISOString();
  audit(store, input.ownerTelegramId, 'telegram.invoice.reopened', 'order', order.id, now);
  store.save();
  return order;
}

export function assertTelegramOrderOwner(store: Store, telegramId: string, invoiceNumber: string): Order {
  const member = store.data.members.find((item) => item.telegramId === telegramId);
  const order = member && store.data.orders.find((item) => item.memberId === member.id && (item.invoiceNumber === invoiceNumber || item.id === invoiceNumber));
  if (!order) throw new Error('order tidak ditemukan');
  return order;
}

export function listTelegramBuyerLicenses(store: Store, telegramId: string) {
  const member = store.data.members.find((item) => item.telegramId === telegramId);
  if (!member) return [];
  const orderIds = new Set(store.data.orders.filter((order) => order.memberId === member.id).map((order) => order.id));
  return store.data.licenses.filter((license) => license.orderId && orderIds.has(license.orderId)).map((license) => ({ ...license }));
}
