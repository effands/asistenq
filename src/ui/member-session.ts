import type { LoginResult } from './api';

const MEMBER_SESSION_KEY = 'asistenq-member-session';

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isLoginResult(value: unknown): value is LoginResult {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<LoginResult>;
  return typeof session.token === 'string'
    && session.token.length > 0
    && !!session.user
    && typeof session.user.id === 'string'
    && typeof session.user.name === 'string'
    && typeof session.user.email === 'string';
}

export function readMemberSession(storage: SessionStorage): LoginResult | null {
  try {
    const raw = storage.getItem(MEMBER_SESSION_KEY);
    if (!raw) return null;
    const session: unknown = JSON.parse(raw);
    if (isLoginResult(session)) return session;
  } catch {
    // Invalid browser data is treated as a signed-out session.
  }
  storage.removeItem(MEMBER_SESSION_KEY);
  return null;
}

export function writeMemberSession(storage: SessionStorage, session: LoginResult): void {
  storage.setItem(MEMBER_SESSION_KEY, JSON.stringify(session));
}

export function clearMemberSession(storage: SessionStorage): void {
  storage.removeItem(MEMBER_SESSION_KEY);
}
