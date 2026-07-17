import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/server/store';

describe('Telegram commerce data model', () => {
  it('normalizes missing download grants for partial data', () => {
    const store = createMemoryStore({ products: [], orders: [] });

    expect(store.data.downloadGrants).toEqual([]);
  });
});
