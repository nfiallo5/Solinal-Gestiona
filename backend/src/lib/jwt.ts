/**
 * JWT issuing/verification.
 *
 * Per the project decision: a single access token, no refresh rotation, no
 * httpOnly cookies. The frontend stores it in `localStorage` and sends it as
 * `Authorization: Bearer <token>`.
 *
 * The `/auth/login` route agent calls `signToken()`; `requireAuth` calls
 * `verifyToken()`. Keep the claim shape in one place so they cannot drift.
 */
import jwt from 'jsonwebtoken';
import type { RoleName } from '@prisma/client';
import { env } from '../env.js';

/** Claims embedded in the access token. */
export interface TokenClaims {
  /** User id (uuid). */
  sub: string;
  email: string;
  /** Display name — denormalized so simple reads need no DB hit. */
  name: string;
  /** Role AT ISSUE TIME. `requireAuth` re-reads the live role from the DB, so
   *  a role change takes effect immediately without re-login. */
  role: RoleName;
}

export function signToken(claims: TokenClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Throws `jsonwebtoken` errors (`TokenExpiredError`, `JsonWebTokenError`). */
export function verifyToken(token: string): TokenClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new jwt.JsonWebTokenError('Token payload inválido.');
  }
  return decoded as unknown as TokenClaims;
}

/** Pulls the raw token out of an `Authorization: Bearer <token>` header. */
export function bearerFromHeader(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}
