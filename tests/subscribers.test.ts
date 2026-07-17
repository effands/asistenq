import { describe, expect, it } from 'vitest';
import { subscribeProductUpdates } from '../src/server/subscribers';
import { createMemoryStore } from '../src/server/store';

describe('product update subscribers', () => {
  it('normalizes email and treats duplicate signup idempotently', () => {
    const store = createMemoryStore();
    const first = subscribeProductUpdates(store, ' Buyer@Example.COM ', 'footer', new Date('2026-07-17T00:00:00Z'));
    const second = subscribeProductUpdates(store, 'buyer@example.com', 'footer', new Date('2026-07-18T00:00:00Z'));
    expect(first.id).toBe(second.id);
    expect(store.data.subscribers).toHaveLength(1);
    expect(first.email).toBe('buyer@example.com');
  });
});
