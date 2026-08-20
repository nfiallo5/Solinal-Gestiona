/**
 * `/users` — user directory, admin user creation, role reassignment, unlock.
 * Owned by Agent 2 (auth & admin).
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET   /users              requireAuth                 -> UserDTO[]
 *   POST  /users              Administrador               -> { user, temporaryPassword? }
 *   PATCH /users/:id/role     Administrador               -> { user, isSelf }
 *   POST  /users/:id/unlock   Administrador               -> { user, unlocked }
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Ports `ADD_USER` (via `src/features/users/NewUserDialog.tsx`) and
 * `UPDATE_USER_ROLE` (via `src/routes/Usuarios.tsx`) from `AppStateContext.tsx`.
 * Both are admin-only client-side today with nothing stopping a direct call;
 * here `requireAdmin()` enforces it AND logs the rejected attempt, matching the
 * `"Intento no autorizado…"` audit entry `Usuarios.tsx` already writes.
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { PasswordPolicy } from '@prisma/client';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import { serializeUser } from '../lib/serialize.js';
import { zRoleName } from '../lib/enums.js';
import {
  assertPasswordPolicy,
  BCRYPT_ROUNDS,
  generateTemporaryPassword,
  initialsOf,
} from '../lib/userAccount.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { getAuthUser, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { clearLockout, isLockActive, requireAdmin } from './auth.js';

export const usersRouter: Router = Router();

// Re-exported so existing imports (e.g. `backend/tests/users.test.ts`) keep
// working now that the implementation lives in `../lib/userAccount.js`.
export { initialsOf };

// ---------------------------------------------------------------------------
// GET /users
// ---------------------------------------------------------------------------

/**
 * The "Usuarios y Roles" page is NOT in `lectorRestrictedPages`, so every
 * authenticated role may read the directory. `serializeUser` strips
 * `passwordHash`, `failedAttempts`, and `lockedAt`.
 */
usersRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    res.status(200).json(rows.map(serializeUser));
  }),
);

// ---------------------------------------------------------------------------
// POST /users
// ---------------------------------------------------------------------------

/**
 * Fields mirror what `NewUserDialog.tsx` collects. `short` is derived, never
 * accepted from the client, so avatars stay consistent with `initialsOf()`.
 *
 * `password` is OPTIONAL because the dialog does not collect one — see
 * NOTES.md § 19. Omit it and the server mints a temporary password, returned
 * exactly once in the creation response.
 */
const zCreateUserBody = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  email: z.string().trim().toLowerCase().email('Correo electrónico inválido.'),
  role: zRoleName,
  /** "Activo" | "Invitado" | "Inactivo" in the dialog; free text is accepted. */
  status: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
  password: z.string().min(1).max(200).optional(),
});

usersRouter.post(
  '/',
  requireAuth,
  // Runs BEFORE body validation on purpose: an unauthorized attempt must be
  // logged even when the payload is also malformed.
  requireAdmin((req) => {
    const raw = (req.body as { name?: unknown } | undefined)?.name;
    const name = typeof raw === 'string' && raw.trim() ? raw.trim() : '(sin nombre)';
    return `Intento no autorizado de registrar el usuario ${name} por ${req.user?.name} (Rol: ${req.user?.role})`;
  }),
  validate({ body: zCreateUserBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof zCreateUserBody>;

    // `User.name` is @unique (the frontend identifies users by name), and the
    // dialog does its own case-insensitive check — reproduce that here so the
    // error is a readable 409 instead of a Prisma P2002 on a case variant.
    const [nameClash, emailClash, config] = await Promise.all([
      prisma.user.findFirst({ where: { name: { equals: body.name, mode: 'insensitive' } } }),
      prisma.user.findUnique({ where: { email: body.email } }),
      prisma.orgConfig.findFirst(),
    ]);
    if (nameClash) throw HttpError.conflict('Ya existe un usuario registrado con ese nombre.');
    if (emailClash) throw HttpError.conflict('Ya existe un usuario registrado con ese correo.');

    const policy: PasswordPolicy = config?.passwordPolicy ?? 'strong';
    const generated = body.password === undefined;
    const password = body.password ?? generateTemporaryPassword();
    if (!generated) assertPasswordPolicy(password, policy);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.user.create({
        data: {
          name: body.name,
          short: initialsOf(body.name),
          email: body.email,
          role: body.role,
          passwordHash,
          status: body.status ?? null,
          // The dialog sends "" when the textarea is untouched; store NULL so
          // `serializeUser` omits the key rather than emitting an empty string.
          notes: body.notes ? body.notes : null,
        },
      });
      // Verbatim string from NewUserDialog.tsx#handleSave().
      await writeAudit(req, `Registró nuevo usuario: ${row.name} (${row.role})`, { tx });
      return row;
    });

    res.status(201).json({
      user: serializeUser(created),
      // Shown once. Never persisted in plaintext and never returned again.
      ...(generated ? { temporaryPassword: password } : {}),
    });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /users/:id/role
// ---------------------------------------------------------------------------

const zUserIdParams = z.object({ id: z.string().uuid('Id de usuario inválido.') });
const zRoleBody = z.object({ role: zRoleName });

/**
 * Port of `UPDATE_USER_ROLE`. The reducer also rewrites
 * `session.activeRole` when the edited user IS the logged-in one
 * (`Usuarios.tsx:45`), which is a client-side concern — the response carries
 * `isSelf` so the frontend knows to apply that live permission update without
 * having to compare names itself.
 */
usersRouter.patch(
  '/:id/role',
  requireAuth,
  validate({ params: zUserIdParams }),
  requireAdmin(
    (req) =>
      `Intento no autorizado de cambiar el rol del usuario ${req.params.id} por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zRoleBody }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof zUserIdParams>;
    const { role } = req.body as z.infer<typeof zRoleBody>;
    const actor = getAuthUser(req);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw HttpError.notFound('Usuario no encontrado.');

    if (target.role === role) {
      res.status(200).json({ user: serializeUser(target), isSelf: target.id === actor.id });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data: { role } });
      // Verbatim string from Usuarios.tsx#handleRoleChange().
      await writeAudit(req, `Cambió el rol del usuario ${row.name} a ${role}`, { tx });
      return row;
    });

    res.status(200).json({
      user: serializeUser(updated),
      /** True when the admin edited their own row — the session role must follow. */
      isSelf: updated.id === actor.id,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /users/:id/unlock
// ---------------------------------------------------------------------------

/**
 * Administrative unlock — the second half of the answer to NOTES.md § 8's open
 * question (the first half is the time-based expiry in `auth.ts`). Without
 * this, a lock could only be waited out.
 *
 * Closest existing analogue in the frontend is `LockScreen.tsx#handleUnlock()`,
 * which dispatches `UNLOCK_SYSTEM` and logs "Sistema desbloqueado manualmente
 * por el administrador (Simulado)". That one is a demo affordance available to
 * whoever is looking at the screen; this one is real and admin-gated.
 */
usersRouter.post(
  '/:id/unlock',
  requireAuth,
  validate({ params: zUserIdParams }),
  requireAdmin(
    (req) =>
      `Intento no autorizado de desbloquear la cuenta ${req.params.id} por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof zUserIdParams>;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw HttpError.notFound('Usuario no encontrado.');

    const wasLocked = isLockActive(target.lockedAt);
    const updated = await prisma.$transaction(async (tx) => {
      const row = await clearLockout(tx, id);
      await writeAudit(
        req,
        wasLocked
          ? `Desbloqueó manualmente la cuenta de ${row.name}`
          : `Reinició el contador de intentos fallidos de ${row.name}`,
        { tx },
      );
      return row;
    });

    res.status(200).json({ user: serializeUser(updated), unlocked: wasLocked });
  }),
);
