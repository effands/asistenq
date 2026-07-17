import { describe, expect, it } from 'vitest';
import { consumeDownloadGrant, issueDownloadGrant, validateDownloadSource } from '../src/server/digital-downloads';
import { createMemoryStore } from '../src/server/store';

function fixture(source = 'https://files.example.com/tool.zip') {
  return createMemoryStore({
    products: [{ id: 'p', name: 'File', slug: 'file', type: 'tool', fulfillmentType: 'download', downloadSourceUrl: source, billingPeriod: 'one_time', price: 1, active: true, headline: '', description: '', coverUrl: '', accessUrl: '', createdAt: '', updatedAt: '' }],
    orders: [{ id: 'o', memberId: 'm', productId: 'p', amount: 1, status: 'paid', qrisPayload: 'q', createdAt: '' }]
  });
}

describe('digital download grants', () => {
  it('stores only a hash and permits exactly three uses for 24 hours', () => {
    const store = fixture();
    const issued = issueDownloadGrant(store, 'o', new Date('2026-07-17T08:00:00Z'), 'raw-token');
    expect(JSON.stringify(store.data.downloadGrants)).not.toContain('raw-token');
    consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:00:00Z'));
    consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:01:00Z'));
    consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:02:00Z'));
    expect(() => consumeDownloadGrant(store, issued.token, new Date('2026-07-17T09:03:00Z'))).toThrow('batas download habis');
    const expiredStore = fixture();
    const expired = issueDownloadGrant(expiredStore, 'o', new Date('2026-07-17T08:00:00Z'), 'expired-token');
    expect(() => consumeDownloadGrant(expiredStore, expired.token, new Date('2026-07-18T08:00:01Z'))).toThrow('link download kedaluwarsa');
  });

  it('rejects unsafe remote and private-network sources', () => {
    expect(() => validateDownloadSource('http://example.com/a.zip')).toThrow('HTTPS');
    expect(() => validateDownloadSource('https://127.0.0.1/a.zip')).toThrow('jaringan privat');
    expect(() => validateDownloadSource('file:///etc/passwd')).toThrow();
  });
});
