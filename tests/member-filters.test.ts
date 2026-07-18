import { describe, expect, it } from 'vitest';
import { filterMemberOrders, groupLicenseStatus, groupOrderStatus } from '../src/ui/member-filters';

describe('member filters', () => {
  it('groups order states for member tabs', () => {
    expect(groupOrderStatus({ status: 'paid', paymentProofStatus: 'approved' })).toBe('success');
    expect(groupOrderStatus({ status: 'pending', paymentProofStatus: 'submitted' })).toBe('pending');
    expect(groupOrderStatus({ status: 'expired' })).toBe('cancelled');
    expect(groupOrderStatus({ status: 'cancelled' })).toBe('cancelled');
  });

  it('combines order status and invoice or product search', () => {
    const orders = [
      { id: '1', status: 'paid', invoiceNumber: 'INV-001', productName: 'MIXIN9' },
      { id: '2', status: 'pending', invoiceNumber: 'INV-002', productName: 'VJ Studio' }
    ] as any[];
    expect(filterMemberOrders(orders, 'success', 'mixin')).toEqual([orders[0]]);
    expect(filterMemberOrders(orders, 'pending', '002')).toEqual([orders[1]]);
  });

  it('normalizes license states including expiration time', () => {
    expect(groupLicenseStatus({ status: 'active', expiresAt: '2026-08-01' }, new Date('2026-07-18'))).toBe('active');
    expect(groupLicenseStatus({ status: 'generated', expiresAt: '2026-08-01' }, new Date('2026-07-18'))).toBe('generated');
    expect(groupLicenseStatus({ status: 'active', expiresAt: '2026-07-01' }, new Date('2026-07-18'))).toBe('expired');
  });
});
