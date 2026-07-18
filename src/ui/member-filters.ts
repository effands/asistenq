import type { LicenseStatus, OrderStatus, PaymentProofStatus } from '../shared/types';

export type MemberOrderFilter = 'all' | 'success' | 'pending' | 'cancelled';
export type MemberLicenseFilter = 'all' | 'active' | 'generated' | 'expired';

type FilterableOrder = {
  status: OrderStatus;
  paymentProofStatus?: PaymentProofStatus;
  invoiceNumber?: string;
  productName?: string;
  product?: { name?: string };
};

export function groupOrderStatus(order: Pick<FilterableOrder, 'status' | 'paymentProofStatus'>): Exclude<MemberOrderFilter, 'all'> {
  if (order.status === 'paid' || order.paymentProofStatus === 'approved') return 'success';
  if (order.status === 'expired' || order.status === 'cancelled') return 'cancelled';
  return 'pending';
}

export function filterMemberOrders<T extends FilterableOrder>(orders: T[], filter: MemberOrderFilter, search: string): T[] {
  const query = search.trim().toLowerCase();
  return orders.filter((order) => {
    if (filter !== 'all' && groupOrderStatus(order) !== filter) return false;
    return !query || `${order.invoiceNumber ?? ''} ${order.product?.name ?? order.productName ?? ''}`.toLowerCase().includes(query);
  });
}

export function groupLicenseStatus(license: { status: LicenseStatus; expiresAt: string | null }, now = new Date()): Exclude<MemberLicenseFilter, 'all'> {
  if (license.expiresAt && new Date(`${license.expiresAt}T23:59:59.999Z`) < now) return 'expired';
  if (license.status === 'active') return 'active';
  if (license.status === 'expired') return 'expired';
  return 'generated';
}
