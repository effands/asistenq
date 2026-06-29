import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { canAdminAccess } from '../shared/domain';
import type { AdminScope } from '../shared/types';

export function resolveSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET?.trim();

  if (secret) return secret;

  if (env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET wajib diisi di production.');
  }

  return 'local-asistenq-dev-secret';
}

const sessionSecret = resolveSessionSecret();

export type SessionUser = {
  id: string;
  email: string;
  type: 'admin' | 'member';
  role?: 'super_admin' | 'admin';
  scopes?: AdminScope[];
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, sessionSecret, { expiresIn: '7d' });
}

function tokenFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(';').map((item) => item.trim());
  const sessionCookie = cookies.find((item) => item.startsWith('asistenq_session='));
  return sessionCookie ? decodeURIComponent(sessionCookie.split('=').slice(1).join('=')) : undefined;
}

export function sessionCookie(token: string, secure = false): string {
  return [
    `asistenq_session=${encodeURIComponent(token)}`,
    'Path=/',
    'Max-Age=604800',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : ''
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie(): string {
  return 'asistenq_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
}

export function readSession(req: Request): SessionUser | undefined {
  const header = req.header('authorization');
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = bearerToken ?? tokenFromCookie(req.header('cookie'));

  if (!token) return undefined;

  try {
    return jwt.verify(token, sessionSecret) as SessionUser;
  } catch {
    return undefined;
  }
}

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const user = readSession(req);

  if (!user) {
    res.status(401).json({ message: 'login required' });
    return;
  }

  req.user = user;
  next();
}

export function requireAdminScope(scope: AdminScope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user || user.type !== 'admin' || !user.role || !canAdminAccess({
      role: user.role,
      scopes: user.scopes ?? []
    }, scope)) {
      res.status(403).json({ message: 'access denied' });
      return;
    }

    next();
  };
}
