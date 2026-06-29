import { describe, expect, it } from 'vitest';
import { resolveSessionSecret } from '../src/server/auth';

describe('auth security', () => {
  it('refuses the default session secret in production', () => {
    expect(() => resolveSessionSecret({
      NODE_ENV: 'production'
    })).toThrow('SESSION_SECRET wajib diisi');
  });

  it('keeps a local fallback for development', () => {
    expect(resolveSessionSecret({ NODE_ENV: 'development' })).toBe('local-asistenq-dev-secret');
  });
});
