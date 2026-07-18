import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const app = fs.readFileSync(path.resolve('src/ui/App.tsx'), 'utf8');
const css = fs.readFileSync(path.resolve('src/ui/styles.css'), 'utf8');

describe('member license layout', () => {
  it('uses aligned desktop columns and labeled responsive cells', () => {
    expect(app).toContain('license-list-header');
    expect(app).toContain('license-product-cell');
    expect(app).toContain('license-hwid-cell');
    expect(app).toContain('license-expiry-cell');
    expect(app).toContain('license-detail-action');
    expect(css).toContain('--license-columns:');
    expect(css).toContain('.license-list-header');
    expect(css).toContain('@media (max-width: 640px)');
  });
});
