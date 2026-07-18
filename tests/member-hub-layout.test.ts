import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const app = fs.readFileSync(path.resolve('src/ui/App.tsx'), 'utf8');
const css = fs.readFileSync(path.resolve('src/ui/styles.css'), 'utf8');

describe('member product and help hubs', () => {
  it('renders compact product shortcuts and an adaptive product library', () => {
    expect(app).toContain('member-quick-access');
    expect(app).toContain('member-product-library');
    expect(app).toContain('member-product-meta');
    expect(css).toContain('.member-quick-grid');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });

  it('renders a searchable help flow, faq, and actionable contacts', () => {
    expect(app).toContain('help-center-search');
    expect(app).toContain('help-stepper');
    expect(app).toContain('help-faq-list');
    expect(app).toContain('help-contact-card');
    expect(app).toContain('copySupportEmail');
    expect(app).toContain('aria-expanded');
    expect(css).toContain('.help-contact-grid');
    expect(css).toContain('.help-faq-item');
  });
});
