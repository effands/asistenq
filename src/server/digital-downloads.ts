import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DownloadGrant } from '../shared/types';
import type { Store } from './store';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every(Number.isInteger)) {
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) || (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
  }
  return host.includes('::ffff:127.') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb');
}

export function validateDownloadSource(source: string): { kind: 'local' | 'remote'; value: string } {
  if (path.isAbsolute(source)) {
    const root = path.resolve('data/digital-products');
    const resolved = path.resolve(source);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('path file lokal tidak diizinkan');
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error('file produk digital tidak tersedia');
    return { kind: 'local', value: resolved };
  }
  let url: URL;
  try { url = new URL(source); } catch { throw new Error('sumber download tidak valid'); }
  if (url.protocol !== 'https:') throw new Error('sumber download remote harus HTTPS');
  if (url.username || url.password || isPrivateHost(url.hostname)) throw new Error('host jaringan privat tidak diizinkan');
  const allowlist = (process.env.ASISTENQ_DOWNLOAD_HOSTS ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length && !allowlist.includes(url.hostname.toLowerCase())) throw new Error('host download tidak diizinkan');
  return { kind: 'remote', value: url.toString() };
}

function createDownloadGrant(store: Store, orderId: string, now: Date, fixedToken: string | undefined, action: 'issued' | 'reissued') {
  const order = store.data.orders.find((item) => item.id === orderId && item.status === 'paid');
  if (!order) throw new Error('order paid tidak ditemukan');
  const product = store.data.products.find((item) => item.id === order.productId);
  if (!product || product.fulfillmentType !== 'download' || !product.downloadSourceUrl) throw new Error('file produk digital belum diatur');
  validateDownloadSource(product.downloadSourceUrl);
  const existing = store.data.downloadGrants.find((item) => item.orderId === order.id && new Date(item.expiresAt) > now && item.downloadCount < item.maxDownloads);
  if (existing) throw new Error('gunakan penerbitan ulang untuk mengganti token aktif');
  const token = fixedToken ?? crypto.randomBytes(32).toString('base64url');
  const grant: DownloadGrant = { id: crypto.randomUUID(), orderId: order.id, memberId: order.memberId, productId: product.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + 86_400_000).toISOString(), maxDownloads: 3, downloadCount: 0, createdAt: now.toISOString() };
  store.data.downloadGrants.push(grant);
  store.data.auditLogs.push({ id: crypto.randomUUID(), actorId: order.telegramId ?? order.memberId, action: `telegram.download.${action}`, targetType: 'download_grant', targetId: grant.id, createdAt: now.toISOString() });
  store.save();
  return { grant, token };
}

export function issueDownloadGrant(store: Store, orderId: string, now = new Date(), fixedToken?: string) {
  return createDownloadGrant(store, orderId, now, fixedToken, 'issued');
}

export function reissueDownloadGrant(store: Store, orderId: string, now = new Date(), fixedToken?: string) {
  for (const grant of store.data.downloadGrants.filter((item) => item.orderId === orderId)) grant.expiresAt = now.toISOString();
  store.save();
  return createDownloadGrant(store, orderId, now, fixedToken, 'reissued');
}

export function consumeDownloadGrant(store: Store, token: string, now = new Date()) {
  const grant = store.data.downloadGrants.find((item) => item.tokenHash === hashToken(token));
  if (!grant) throw new Error('link download tidak valid');
  if (new Date(grant.expiresAt) <= now) throw new Error('link download kedaluwarsa');
  if (grant.downloadCount >= grant.maxDownloads) throw new Error('batas download habis');
  const order = store.data.orders.find((item) => item.id === grant.orderId && item.status === 'paid');
  const product = order && store.data.products.find((item) => item.id === grant.productId && (item.id === order.productId || order.orderItems?.some((orderItem) => orderItem.productId === item.id)));
  if (!product?.downloadSourceUrl || product.fulfillmentType !== 'download') throw new Error('file produk digital tidak tersedia');
  const source = validateDownloadSource(product.downloadSourceUrl);
  grant.downloadCount += 1;
  store.save();
  return { grant, source };
}

export function listBuyerDownloadGrants(store: Store, telegramId: string, _baseUrl: string, now = new Date()) {
  const member = store.data.members.find((item) => item.telegramId === telegramId);
  if (!member) return [];
  return store.data.downloadGrants.filter((grant) => grant.memberId === member.id && new Date(grant.expiresAt) > now && grant.downloadCount < grant.maxDownloads).map((grant) => ({
    id: grant.id, orderId: grant.orderId, productId: grant.productId, expiresAt: grant.expiresAt,
    remainingDownloads: grant.maxDownloads - grant.downloadCount
  }));
}
