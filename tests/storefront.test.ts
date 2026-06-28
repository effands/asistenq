import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';

describe('multi-product database shape', () => {
  it('starts with product-scoped collections', () => {
    const store = createMemoryStore();

    expect(store.data.products).toEqual([]);
    expect(store.data.plans).toEqual([]);
    expect(store.data.licenses).toEqual([]);
    expect(store.data.vouchers).toEqual([]);
    expect(store.data.announcements).toEqual([]);
    expect(store.data.bannedHwids).toEqual([]);
  });
});
