import { beforeEach, describe, expect, it } from 'vitest';
import { analyticsOverview, heartbeatPresence, resetPresence } from '../src/server/analytics';
import { createMemoryStore } from '../src/server/store';
import { createProductRecord } from '../src/server/services';

describe('tool analytics and live presence', () => {
  const store = createMemoryStore();

  beforeEach(() => {
    store.reset();
    resetPresence();
  });

  it('counts unique visitors across simultaneous owned tools', () => {
    const toolA = createProductRecord(store, {
      name: 'Tool A', slug: 'tool-a', type: 'tool', billingPeriod: 'monthly', price: 0,
      destinationType: 'internal'
    });
    const toolB = createProductRecord(store, {
      name: 'Tool B', slug: 'tool-b', type: 'tool', billingPeriod: 'monthly', price: 0,
      destinationType: 'hosted'
    });
    const now = new Date('2026-06-30T01:00:00.000Z');

    heartbeatPresence({ visitorId: 'visitor-1', instanceId: 'tab-a', productId: toolA.id, now });
    heartbeatPresence({ visitorId: 'visitor-1', instanceId: 'tab-b', productId: toolB.id, now });
    heartbeatPresence({ visitorId: 'visitor-2', instanceId: 'tab-c', productId: toolA.id, now });

    const overview = analyticsOverview(store, now);
    expect(overview.onlineUsers).toBe(2);
    expect(overview.products.find((item) => item.productId === toolA.id)?.onlineUsers).toBe(2);
    expect(overview.products.find((item) => item.productId === toolB.id)?.onlineUsers).toBe(1);
  });

  it('expires visitors after the sixty second live window', () => {
    const tool = createProductRecord(store, {
      name: 'Tool A', slug: 'tool-a', type: 'tool', billingPeriod: 'monthly', price: 0
    });

    heartbeatPresence({
      visitorId: 'visitor-1', instanceId: 'tab-a', productId: tool.id,
      now: new Date('2026-06-30T01:00:00.000Z')
    });

    expect(analyticsOverview(store, new Date('2026-06-30T01:01:01.000Z')).onlineUsers).toBe(0);
  });

  it('does not report external tools as live on AsistenQ', () => {
    const external = createProductRecord(store, {
      name: 'External Tool', slug: 'external-tool', type: 'tool', billingPeriod: 'monthly', price: 0,
      destinationType: 'external', externalUrl: 'https://example.com/tool', openMode: 'new_tab'
    });

    heartbeatPresence({
      visitorId: 'visitor-1', instanceId: 'tab-a', productId: external.id,
      now: new Date('2026-06-30T01:00:00.000Z')
    });

    expect(analyticsOverview(store, new Date('2026-06-30T01:00:10.000Z')).products
      .find((item) => item.productId === external.id)?.onlineUsers).toBe(0);
  });
});
