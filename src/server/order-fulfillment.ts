import crypto from 'node:crypto';
import type { OrderItem } from '../shared/types';
import type { Store } from './store';
import { generateToolLicense } from './services';
import { validateDownloadSource } from './digital-downloads';

function legacyItem(store: Store, orderId: string): OrderItem[] {
  const order = store.data.orders.find((row) => row.id === orderId)!;
  const product = store.data.products.find((row) => row.id === order.productId);
  const plan = store.data.plans.find((row) => row.id === order.planId);
  if (!product || !plan) return [];
  return [{ id: `legacy-${order.id}`, productId: product.id, planId: plan.id, productName: product.name, planName: plan.name, unitAmount: order.amount, fulfillmentType: product.fulfillmentType ?? 'license', fulfillmentStatus: 'pending' }];
}

export function fulfillPaidOrder(store: Store, orderId: string, now = new Date()): OrderItem[] {
  const order = store.data.orders.find((row) => row.id === orderId);
  if (!order || order.status !== 'paid') throw new Error('order paid tidak ditemukan');
  const member = store.data.members.find((row) => row.id === order.memberId);
  if (!member) throw new Error('member tidak ditemukan');
  const items = order.orderItems ?? legacyItem(store, orderId);
  if (!order.orderItems) order.orderItems = items;
  for (const item of items) {
    if (item.fulfillmentStatus === 'fulfilled') continue;
    const product = store.data.products.find((row) => row.id === item.productId);
    const plan = store.data.plans.find((row) => row.id === item.planId);
    try {
      if (!product || !plan) throw new Error('produk atau paket fulfillment tidak ditemukan');
      if (item.fulfillmentType === 'license') {
        const existing = store.data.licenses.find((row) => row.orderId === order.id && row.productId === product.id && row.planId === plan.id);
        const license = existing ?? generateToolLicense(store, { productSlug: product.slug, planCode: plan.code, email: order.customerEmail ?? member.email, hwid: order.customerHwid ?? '', now });
        license.orderId = order.id;
        item.fulfillmentReference = license.id;
      } else if (item.fulfillmentType === 'download') {
        if (!product.downloadSourceUrl) throw new Error('file produk digital belum diatur');
        validateDownloadSource(product.downloadSourceUrl);
        let grant = store.data.downloadGrants.find((row) => row.orderId === order.id && row.orderItemId === item.id);
        if (!grant) {
          const token = crypto.randomBytes(32).toString('base64url');
          grant = { id: crypto.randomUUID(), orderId: order.id, orderItemId: item.id, memberId: member.id, productId: product.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(now.getTime() + 86_400_000).toISOString(), maxDownloads: 3, downloadCount: 0, createdAt: now.toISOString() };
          store.data.downloadGrants.push(grant);
          item.fulfillmentReference = token;
        }
      } else {
        const type = item.fulfillmentType;
        let grant = store.data.accessGrants.find((row) => row.orderId === order.id && row.orderItemId === item.id);
        if (!grant) {
          const resource = type === 'url' ? product.externalUrl : product.accessUrl;
          if (!resource) throw new Error('resource akses produk belum diatur');
          grant = { id: crypto.randomUUID(), orderId: order.id, orderItemId: item.id, memberId: member.id, productId: product.id, type, resource, createdAt: now.toISOString() };
          store.data.accessGrants.push(grant);
        }
        item.fulfillmentReference = grant.id;
      }
      item.fulfillmentStatus = 'fulfilled';
      delete item.fulfillmentError;
    } catch (error) {
      item.fulfillmentStatus = 'failed';
      item.fulfillmentError = error instanceof Error ? error.message : 'fulfillment gagal';
    }
  }
  store.save();
  return items;
}
