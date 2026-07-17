import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('active payment integration source', () => {
  it('does not expose DANA API integration code', () => {
    const files = [
      'src/server/index.ts',
      'src/server/services.ts',
      'src/shared/types.ts',
      'src/ui/App.tsx',
      'src/ui/api.ts',
      '.env.example'
    ];

    for (const file of files) {
      const source = fs.readFileSync(path.resolve(file), 'utf8').toLowerCase();
      expect(source, file).not.toContain('/payments/dana');
      expect(source, file).not.toContain('danasandbox');
      expect(source, file).not.toContain('danaclient');
      expect(source, file).not.toContain('danamerchant');
    }
  });
});
