import type { OrderItem } from '../shared/types';
import type { Store } from './store';

export interface CartInput {
  items: Array<{ productId: string; planId: string }>;
  voucherCode?: string;
  customerHwid?: string;
}

export interface ValidatedCart {
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  amount: number;
  voucherId?: string;
}

export function validateCart(store: Store, input: CartInput, now = new Date()): ValidatedCart {
  if (input.items.length < 1 || input.items.length > 25) throw new Error('keranjang harus berisi 1 sampai 25 produk');
  const seen = new Set<string>();
  const items = input.items.map(({ productId, planId }, index): OrderItem => {
    const key = `${productId}:${planId}`;
    if (seen.has(key)) throw new Error('item keranjang duplikat');
    seen.add(key);
    const product = store.data.products.find((row) => row.id === productId && row.active && row.visibility === 'public');
    const plan = store.data.plans.find((row) => row.id === planId && row.productId === productId && row.isActive);
    if (!product || !plan) throw new Error('produk atau paket tidak tersedia');
    return {
      id: `item_${index + 1}`,
      productId,
      planId,
      productName: product.name,
      planName: plan.name,
      unitAmount: plan.price,
      fulfillmentType: product.fulfillmentType ?? 'license',
      fulfillmentStatus: 'pending'
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.unitAmount, 0);
  let discountAmount = 0;
  let voucherId: string | undefined;
  if (input.voucherCode?.trim()) {
    const code = input.voucherCode.trim().toUpperCase();
    const voucher = store.data.vouchers.find((row) => row.code === code && row.active && (!row.expiresAt || new Date(row.expiresAt) >= now) && (row.maxUse === null || row.usedCount < row.maxUse));
    if (!voucher) throw new Error('voucher tidak valid');
    const eligible = voucher.productId ? items.filter((item) => item.productId === voucher.productId).reduce((sum, item) => sum + item.unitAmount, 0) : subtotal;
    if (eligible <= 0) throw new Error('voucher tidak berlaku untuk keranjang ini');
    discountAmount = voucher.discountType === 'percent'
      ? Math.floor(eligible * Math.min(voucher.discountValue, 100) / 100)
      : Math.min(eligible, voucher.discountValue);
    voucherId = voucher.id;
  }
  return { items, subtotal, discountAmount, amount: subtotal - discountAmount, voucherId };
}
