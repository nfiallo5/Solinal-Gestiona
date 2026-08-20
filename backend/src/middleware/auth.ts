/**
 * Authentication + role gating.
 *
 * ── For route agents ───────────────────────────────────────────────────────
 *   router.get('/documents', requireAuth, handler);
 *   router.post('/users', requireAuth, requireRole('Administrador'), handler);
 *
 * Inside a handler, read the caller with `getAuthUser(req)` — it is typed and
 * throws a 401 rather than returning `undefined`, so you never need `req.user!`.
 * `req.user` itself is also populated (typed, optional) via the Express
 * request-type augmentation at the bottom of this file.
 *
 * `requireAuth` re-reads the user row on every request, so a role change or a
 * deleted account takes effect immediately without waiting for token expiry.
 * ───────────────────────────────────────────────────────────────────────────
 */
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { RoleName } from '@prisma/client';
import { prisma } from '../prisma.js';
import { isLockActive } from '../lib/lockout.js';
import { HttpError } from './error.js';
import { bearerFromHeader, verifyToken } from '../lib/jwt.js';

/** The authenticated caller, as attached to `req.user`. */
export interface AuthUser {
  id: string;
  name: string;
  short: string;
  email: string;
  role: RoleName;
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header, loads the live user row,
 * and attaches it to `req.user`.
 *
 * 401 when the header is missing/malformed, the token is invalid or expired,
 * or the user no longer exists. 423 when the account is locked out.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = bearerFromHeader(req.headers.authorization);
  if (!token) {
    next(HttpError.unauthorized('Falta el encabezado Authorization: Bearer.'));
    return;
  }

  let claims;
  try {
    claims = verifyToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(HttpError.unauthorized('La sesión expiró. Vuelve a iniciar sesión.'));
      return;
    }
    next(HttpError.unauthorized('Token inválido.'));
    return;
  }

  prisma.user
    .findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, short: true, email: true, role: true, lockedAt: true },
    })
    .then((user) => {
      if (!user) {
        next(HttpError.unauthorized('La cuenta ya no existe.'));
        return;
      }
      // Must use the same expiry window as POST /auth/login. A bare
      // `if (user.lockedAt)` check would keep 423-ing a token holder whose
      // lock has already elapsed, until they logged in again. See NOTES.md § 17.
      if (isLockActive(user.lockedAt)) {
        next(HttpError.locked('Cuenta bloqueada por intentos fallidos.'));
        return;
      }
      req.user = {
        id: user.id,
        name: user.name,
        short: user.short,
        email: user.email,
        role: user.role,
      };
      next();
    })
    .catch(next);
};

/**
 * Restricts a route to the given roles. Mount AFTER `requireAuth`.
 *
 * `requireRole()` with no arguments allows any authenticated user (useful as a
 * placeholder). Note that `Administrador` is NOT implicitly allowed — pass it
 * explicitly when it should be, mirroring the frontend's explicit checks.
 *
 * @example requireRole('Aprobador', 'Administrador')
 */
export function requireRole(...roles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(HttpError.unauthorized('No autenticado.'));
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      next(
        HttpError.forbidden(
          `Tu rol (${user.role}) no tiene permiso para esta acción. Requiere: ${roles.join(' o ')}.`,
        ),
      );
      return;
    }
    next();
  };
}

/** Non-optional accessor for `req.user`. Throws 401 if `requireAuth` did not run. */
export function getAuthUser(req: { user?: AuthUser }): AuthUser {
  if (!req.user) {
    throw HttpError.unauthorized('No autenticado.');
  }
  return req.user;
}

// ---------------------------------------------------------------------------
// Express request-type augmentation
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. Undefined on unauthenticated routes. */
      user?: AuthUser;
    }
  }
}
