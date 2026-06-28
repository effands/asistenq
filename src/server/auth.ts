import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { canAdminAccess } from '../shared/domain';
import type { AdminScope } from '../shared/types';

const sessionSecret = process.env.SESSION_SECRET ?? 'local-asistenq-dev-secret';

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

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: 'login required' });
    return;
  }

  try {
    req.user = jwt.verify(token, sessionSecret) as SessionUser;
    next();
  } catch {
    res.status(401).json({ message: 'invalid session' });
  }
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
