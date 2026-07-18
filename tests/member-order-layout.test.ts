import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'src/ui/App.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'src/ui/styles.css'), 'utf8');

describe('member order responsive layout', () => {
  it('renders four semantic order columns', () => {
    expect(appSource).toContain('className="order-history-invoice"');
    expect(appSource).toContain('className="order-history-detail"');
    expect(appSource).toContain('className="order-history-total"');
    expect(appSource).toContain('className="order-history-actions"');
  });

  it('uses four desktop columns with tablet and mobile fallbacks', () => {
    expect(cssSource).toContain('grid-template-columns: minmax(180px, 1.05fr) minmax(220px, 1.35fr) minmax(150px, .8fr) auto;');
    expect(cssSource).toContain('.order-history-card > .member-reset-box { grid-column: 1 / -1; }');
    expect(cssSource).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.order-history-card \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
    expect(cssSource).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.order-history-card \{[\s\S]*?grid-template-columns: 1fr;/);
  });
});
