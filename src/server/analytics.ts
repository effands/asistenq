import { createId } from '../shared/domain';
import type { ToolAnalyticsEventType } from '../shared/types';
import type { Store } from './store';

const liveWindowMs = 60_000;

type Presence = {
  visitorId: string;
  instanceId: string;
  productId?: string;
  lastSeenAt: number;
};

const presence = new Map<string, Presence>();

function presenceKey(visitorId: string, instanceId: string): string {
  return `${visitorId}:${instanceId}`;
}

function prunePresence(now: Date): void {
  const oldestAllowed = now.getTime() - liveWindowMs;
  for (const [key, entry] of presence) {
    if (entry.lastSeenAt < oldestAllowed) presence.delete(key);
  }
}

export function heartbeatPresence(input: {
  visitorId: string;
  instanceId: string;
  productId?: string;
  now?: Date;
}): void {
  const now = input.now ?? new Date();
  presence.set(presenceKey(input.visitorId, input.instanceId), {
    visitorId: input.visitorId,
    instanceId: input.instanceId,
    productId: input.productId,
    lastSeenAt: now.getTime()
  });
  prunePresence(now);
}

export function recordAnalyticsEvent(store: Store, input: {
  productId: string;
  visitorId: string;
  eventType: ToolAnalyticsEventType;
  now?: Date;
}): void {
  store.data.toolAnalyticsEvents.push({
    id: createId('event'),
    productId: input.productId,
    visitorId: input.visitorId,
    eventType: input.eventType,
    createdAt: (input.now ?? new Date()).toISOString()
  });
  store.save();
}

export function analyticsOverview(store: Store, now = new Date()) {
  prunePresence(now);
  const onlineVisitors = new Set(Array.from(presence.values()).map((entry) => entry.visitorId));

  const products = store.data.products.map((product) => {
    const events = store.data.toolAnalyticsEvents.filter((event) => event.productId === product.id);
    const productOnline = product.trackLiveUsers !== false && product.destinationType !== 'external'
      ? new Set(Array.from(presence.values())
        .filter((entry) => entry.productId === product.id)
        .map((entry) => entry.visitorId)).size
      : 0;

    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      destinationType: product.destinationType ?? 'internal',
      onlineUsers: productOnline,
      detailViews: events.filter((event) => event.eventType === 'detail_view').length,
      toolOpens: events.filter((event) => event.eventType === 'tool_open').length,
      checkoutClicks: events.filter((event) => event.eventType === 'checkout_click').length
    };
  });

  return {
    onlineUsers: onlineVisitors.size,
    totalDetailViews: products.reduce((total, product) => total + product.detailViews, 0),
    totalToolOpens: products.reduce((total, product) => total + product.toolOpens, 0),
    products
  };
}

export function resetPresence(): void {
  presence.clear();
}
