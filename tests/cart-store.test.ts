import { describe, expect, it } from 'vitest';
import { addCartItem, cartSubtotal, removeCartItem, type MarketplaceCartItem } from '../src/ui/cart-store';

const base: MarketplaceCartItem = { productId: 'p1', planId: 'a', productName: 'Produk', planName: 'Bulanan', price: 49900 };

describe('marketplace cart', () => {
  it('keeps one selected plan per product', () => {
    const next = addCartItem([base], { ...base, planId: 'b', planName: 'Tahunan', price: 399000 });
    expect(next).toHaveLength(1);
    expect(next[0].planId).toBe('b');
  });

  it('calculates subtotal and removes a row', () => {
    const items = [base, { ...base, productId: 'p2', planId: 'c', price: 25000 }];
    expect(cartSubtotal(items)).toBe(74900);
    expect(removeCartItem(items, 'p1')).toEqual([items[1]]);
  });
});
