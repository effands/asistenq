import { describe, expect, it } from 'vitest';
import { clearMemberSession, readMemberSession, writeMemberSession } from '../src/ui/member-session';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

describe('member session persistence', () => {
  it('restores a valid member session after the app reloads', () => {
    const storage = memoryStorage();
    const session = { token: 'valid.jwt.token', user: { id: 'member-1', name: 'Kios Adv', email: 'kiosadv@gmail.com' } };

    writeMemberSession(storage, session);

    expect(readMemberSession(storage)).toEqual(session);
  });

  it('removes the stored session on logout', () => {
    const storage = memoryStorage();
    writeMemberSession(storage, { token: 'token', user: { id: 'member-1', name: 'Member', email: 'member@example.com' } });

    clearMemberSession(storage);

    expect(readMemberSession(storage)).toBeNull();
  });
});
