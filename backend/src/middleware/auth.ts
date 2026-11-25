import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { PublicUser } from '../types.js';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

export function signSessionToken(user: PublicUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '8h' }
  );
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  });
}

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[config.sessionCookieName];
  if (!token || typeof token !== 'string') {
    next(
      new AppError(
        401,
        'UNAUTHENTICATED',
        'Authentication required. Please sign in to continue.'
      )
    );
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      (payload.role !== 'staff' && payload.role !== 'supervisor')
    ) {
      next(
        new AppError(
          401,
          'INVALID_SESSION',
          'Your session is invalid. Please sign in again.'
        )
      );
      return;
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    next();
  } catch {
    next(
      new AppError(
        401,
        'INVALID_SESSION',
        'Your session has expired or is invalid. Please sign in again.'
      )
    );
  }
}

