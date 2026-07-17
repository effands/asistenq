import crypto from 'node:crypto';
import type { ProductSubscriber } from '../shared/types';
import type { Store } from './store';

export function subscribeProductUpdates(store: Store, rawEmail: string, source = 'footer', now = new Date()): ProductSubscriber {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('email tidak valid');
  const existing = store.data.subscribers.find((row) => row.email === email);
  if (existing) {
    existing.status = 'active';
    store.save();
    return existing;
  }
  const subscriber: ProductSubscriber = { id: crypto.randomUUID(), email, consentedAt: now.toISOString(), status: 'active', source };
  store.data.subscribers.push(subscriber);
  store.save();
  return subscriber;
}

export function subscribersCsv(store: Store): string {
  const safe = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return ['email,status,source,consentedAt', ...store.data.subscribers.map((row) => [row.email, row.status, row.source, row.consentedAt].map(safe).join(','))].join('\n');
}
