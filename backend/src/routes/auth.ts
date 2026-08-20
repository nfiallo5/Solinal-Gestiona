/**
 * `/auth` — login, logout, session rehydration, and the server-side lockout.
 * Owned by Agent 2 (auth & admin).
 *
 * Replaces `src/features/auth/credentials.ts#findCredential()` (a hardcoded
 * list of 5 plaintext demo logins) with a bcrypt check against `User`.
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   POST /auth/register public      { email, password } -> { token, user }
 *   POST /auth/login    public      { email, password } -> { token, user }
 *   POST /auth/logout   requireAuth audited no-op -> { ok: true }
 *   GET  /auth/me       requireAuth -> { user }
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ── Lockout (port of REGISTER_FAILED_ATTEMPT / LOCK_SYSTEM) ────────────────
 * The frontend counts failures in `state.session.failedAttempts` and flips
 * `session.isLocked` at 3 — reloading the page wipes both. Here the counter
 * lives on `User.failedAttempts` and the lock on `User.lockedAt`, so it
 * survives a reload and cannot be bypassed by the client.
 *
 * A locked account answers **423**. Two things unlock it (see NOTES.md § 17):
 *   1. time — the lock expires by itself after `LOCKOUT_MINUTES`;
 *   2. an administrator — `POST /users/:id/unlock`.
 * Both paths go through `clearLockout()` so the two stay consistent.
 *
 * Every attempt, successful or not, writes an `AuditLogEntry` AND a
 * `LoginAttempt` row (the latter also covers emails that match no user, which
 * the per-user counter structurally cannot).
 */
import { Router, type Request } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { RoleName, User } from '@prisma/client';

import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { signToken } from '../lib/jwt.js';
import { clientIp, writeAudit, type DbClient } from '../lib/audit.js';
import { isLockActive, lockRemainingMs } from '../lib/lockout.js';
import { serializeUser } from '../lib/serialize.js';
import { assertPasswordPolicy, BCRYPT_ROUNDS, initialsOf } from '../lib/userAccount.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { getAuthUser, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const authRouter: Router = Router();

// ---------------------------------------------------------------------------
// Lockout policy — shared with src/routes/users.ts
// ---------------------------------------------------------------------------

/** Consecutive failures that trigger a lock. Matches the frontend's 3. */
export const MAX_FAILED_ATTEMPTS = env.MAX_FAILED_LOGIN_ATTEMPTS;

/**
 * The lock-expiry policy itself lives in `src/lib/lockout.ts` so that
 * `requireAuth` can apply the identical rule without importing this route
 * module. Re-exported here because `src/routes/users.ts` and the tests already
 * import these from `./auth.js`.
 */
export { LOCKOUT_MINUTES, isLockActive, lockRemainingMs } from '../lib/lockout.js';

/** Clears both the counter and the lock. Used by login success and by admin unlock. */
export async function clearLockout(db: DbClient, userId: string): Promise<User> {
  return db.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedAt: null },
  });
}

// ---------------------------------------------------------------------------
// Helpers shared with src/routes/users.ts and src/routes/config.ts
// ---------------------------------------------------------------------------

/**
 * `requireRole(...)` with an audit trail.
 *
 * `Usuarios.tsx#handleRoleChange()` logs
 * `"Intento no autorizado de cambiar el rol de X por Y (Rol: Z)"` when a
 * non-admin tries to act, and the spec is explicit that rejected attempts must
 * keep being logged. Plain `requireRole` rejects before the handler can write
 * anything, so admin-only routes use this instead.
 *
 * @param describe builds the audit action text from the request
 */
export function requireRoleAudited(
  roles: RoleName[],
  describe: (req: Request) => string,
) {
  return asyncHandler(async (req, _res, next) => {
    const user = getAuthUser(req);
    if (roles.includes(user.role)) {
      next();
      return;
    }
    await writeAudit(req, describe(req));
    next(
      HttpError.forbidden(
        `Tu rol (${user.role}) no tiene permiso para esta acción. Requiere: ${roles.join(' o ')}.`,
      ),
    );
  });
}

/** Admin-only + audited rejection. */
export function requireAdmin(describe: (req: Request) => string) {
  return requireRoleAudited(['Administrador'], describe);
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

/**
 * Public self-service signup: just an email and a password. Everything else
 * `POST /users` collects (`name`, `role`, `status`, `notes`) is either
 * derived or defaulted here, since there is no admin in the loop:
 *   - `name` is derived from the email's local part (before the `@`), and
 *     `short` from that via `initialsOf()`, same as the admin-created path.
 *   - `role` is always `Lector` — the least-privileged role. An
 *     administrator can promote the account afterwards via
 *     `PATCH /users/:id/role`, same as any other user.
 * Responds exactly like `POST /auth/login` ( `{ token, user }` ) so the
 * frontend can sign the new account straight in.
 */
const zRegisterBody = z.object({
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.').max(200),
});

/**
 * `User.name` is `@unique` (the frontend identifies users by name). Derive a
 * readable display name from the email's local part, then disambiguate with
 * a numeric suffix on collision instead of failing the whole signup.
 */
async function uniqueNameFromEmail(email: string): Promise<string> {
  const local = email.split('@')[0] ?? email;
  const base =
    local
      .replace(/[._+-]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => (w[0] as string).toUpperCase() + w.slice(1))
      .join(' ') || 'Usuario';

  let candidate = base;
  let suffix = 2;
  while (
    await prisma.user.findFirst({ where: { name: { equals: candidate, mode: 'insensitive' } } })
  ) {
    candidate = `${base} ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

authRouter.post(
  '/register',
  validate({ body: zRegisterBody }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof zRegisterBody>;

    const [emailClash, config] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.orgConfig.findFirst(),
    ]);
    if (emailClash) throw HttpError.conflict('Ya existe una cuenta registrada con ese correo.');

    const policy = config?.passwordPolicy ?? 'strong';
    assertPasswordPolicy(password, policy);

    const name = await uniqueNameFromEmail(email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.user.create({
        data: {
          name,
          short: initialsOf(name),
          email,
          role: 'Lector',
          passwordHash,
        },
      });
      await writeAudit(req, `Se registró un nuevo usuario: ${row.name} (${row.role})`, {
        actor: { user: row.name, role: row.role },
        tx,
      });
      return row;
    });

    const token = signToken({
      sub: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
    });

    res.status(201).json({ token, user: serializeUser(created) });
  }),
);

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

const zLoginBody = z.object({
  email: z.string().trim().min(1, 'El correo es obligatorio.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
  /**
   * Free-text label kept only for the audit string, mirroring
   * `Login.tsx#finalizeLogin(credential, method)`: "credenciales" for the form,
   * "acceso rápido" for the demo quick-login buttons.
   */
  method: z.string().trim().min(1).max(40).optional(),
});

authRouter.post(
  '/login',
  validate({ body: zLoginBody }),
  asyncHandler(async (req, res) => {
    const { email, password, method = 'credenciales' } = req.body as z.infer<typeof zLoginBody>;
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(req);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // --- Unknown email -----------------------------------------------------
    // Logged as a LoginAttempt (userId NULL) but NOT as an audit entry: an
    // audit row needs an actor name+role, and there is no user to name here.
    if (!user) {
      await prisma.loginAttempt.create({
        data: { email: normalizedEmail, userId: null, success: false, ip },
      });
      throw HttpError.unauthorized('Correo o contraseña incorrectos.');
    }

    // --- Already locked ----------------------------------------------------
    if (isLockActive(user.lockedAt)) {
      await prisma.loginAttempt.create({
        data: { email: normalizedEmail, userId: user.id, success: false, ip },
      });
      await writeAudit(req, `Intento de acceso con la cuenta bloqueada ${user.email}`, {
        actor: { user: user.name, role: user.role },
      });
      throw lockedError(user.lockedAt);
    }

    // A lock whose window elapsed is cleared lazily, on the next attempt.
    if (user.lockedAt) {
      await clearLockout(prisma, user.id);
      user.lockedAt = null;
      user.failedAttempts = 0;
    }

    // --- Wrong password ----------------------------------------------------
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failedAttempts = user.failedAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockedAt = shouldLock ? new Date() : null;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { failedAttempts, ...(shouldLock ? { lockedAt } : {}) },
        });
        await tx.loginAttempt.create({
          data: { email: normalizedEmail, userId: user.id, success: false, ip },
        });
        await writeAudit(
          req,
          shouldLock
            ? `Cuenta ${user.email} bloqueada tras ${failedAttempts} intentos fallidos de inicio de sesión`
            : `Intento fallido de inicio de sesión de ${user.name} (${failedAttempts}/${MAX_FAILED_ATTEMPTS})`,
          { actor: { user: user.name, role: user.role }, tx },
        );
      });

      if (shouldLock) throw lockedError(lockedAt);
      throw HttpError.unauthorized('Correo o contraseña incorrectos.', {
        failedAttempts,
        maxAttempts: MAX_FAILED_ATTEMPTS,
        remainingAttempts: MAX_FAILED_ATTEMPTS - failedAttempts,
      });
    }

    // --- Success -----------------------------------------------------------
    const fresh = await prisma.$transaction(async (tx) => {
      const updated = await clearLockout(tx, user.id);
      await tx.loginAttempt.create({
        data: { email: normalizedEmail, userId: user.id, success: true, ip },
      });
      // Verbatim string from Login.tsx#finalizeLogin().
      await writeAudit(req, `Inicio de sesión (${method}) como ${user.name}`, {
        actor: { user: user.name, role: user.role },
        tx,
      });
      return updated;
    });

    const token = signToken({
      sub: fresh.id,
      email: fresh.email,
      name: fresh.name,
      role: fresh.role,
    });

    res.status(200).json({ token, user: serializeUser(fresh) });
  }),
);

/** 423 with the seconds left, so the UI can say when to try again. */
function lockedError(lockedAt: Date | null): HttpError {
  const seconds = Math.ceil(lockRemainingMs(lockedAt) / 1000);
  return HttpError.locked(
    `Cuenta bloqueada por ${MAX_FAILED_ATTEMPTS} intentos fallidos. Se desbloquea en ${Math.ceil(
      seconds / 60,
    )} min o mediante un administrador.`,
    { lockedAt: lockedAt?.toISOString() ?? null, retryAfterSeconds: seconds },
  );
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

/**
 * Audited no-op. Token storage is localStorage + `Authorization: Bearer` with
 * no refresh rotation (project decision), so there is no server-side session
 * to destroy and deliberately no blacklist — the client drops the token and
 * the JWT lapses on its own at `JWT_EXPIRES_IN`.
 */
authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthUser(req);
    await writeAudit(req, `Cierre de sesión de ${user.name}`);
    res.status(200).json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

/**
 * Session rehydration on page load — replaces `loadPersistedSession()`'s
 * localStorage read in `AppStateContext.tsx`. `requireAuth` already re-reads
 * the live row, so a role changed by an admin lands on the next page load
 * without a re-login.
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);
    const row = await prisma.user.findUnique({ where: { id } });
    if (!row) throw HttpError.unauthorized('La cuenta ya no existe.');
    res.status(200).json({ user: serializeUser(row) });
  }),
);
