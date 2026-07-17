import { describe, expect, it } from 'vitest';
import { seedSiteContent, publishedContent, updateContentPage } from '../src/server/site-content';
import { createMemoryStore } from '../src/server/store';

describe('managed website content', () => {
  it('seeds approved pages once and exposes only published pages', () => {
    const store = createMemoryStore();
    seedSiteContent(store);
    expect(store.data.contentPages).toHaveLength(8);
    const terms = store.data.contentPages.find((page) => page.slug === 'syarat-ketentuan')!;
    updateContentPage(store, terms.id, { body: 'Isi khusus', published: false });
    seedSiteContent(store);
    expect(store.data.contentPages).toHaveLength(8);
    expect(() => publishedContent(store, 'syarat-ketentuan')).toThrow('tidak ditemukan');
    expect(store.data.contentPages.find((page) => page.id === terms.id)?.body).toBe('Isi khusus');
  });
});
