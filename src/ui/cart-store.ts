export type MarketplaceCartItem = {
  productId: string;
  planId: string;
  productName: string;
  planName: string;
  price: number;
  coverUrl?: string;
  fulfillmentType?: 'license' | 'download' | 'url' | 'course';
};

export function addCartItem(items: MarketplaceCartItem[], item: MarketplaceCartItem): MarketplaceCartItem[] {
  return [...items.filter((row) => row.productId !== item.productId), item];
}

export function removeCartItem(items: MarketplaceCartItem[], productId: string): MarketplaceCartItem[] {
  return items.filter((row) => row.productId !== productId);
}

export function cartSubtotal(items: MarketplaceCartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export function readCart(storage: Pick<Storage, 'getItem'>): MarketplaceCartItem[] {
  try {
    const value = JSON.parse(storage.getItem('asistenq-marketplace-cart') ?? '[]');
    return Array.isArray(value) ? value.filter((item) => item && typeof item.productId === 'string' && typeof item.planId === 'string') : [];
  } catch { return []; }
}

export function writeCart(storage: Pick<Storage, 'setItem'>, items: MarketplaceCartItem[]): void {
  storage.setItem('asistenq-marketplace-cart', JSON.stringify(items));
}
