/**
 * `/config` — the `OrgConfig` singleton.
 * Owned by Agent 2 (auth & admin).
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET   /config   requireAuth     -> ConfigDTO
 *   PATCH /config   Administrador   -> ConfigDTO
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Field set confirmed against `src/features/config/IdentitySection.tsx`
 * (`orgName`, `brandColor`) and `SecuritySection.tsx` (`twoFactorEnabled`,
 * `passwordPolicy`, `doubleApproval`) — exactly the five fields on `OrgConfig`
 * in `src/data/seed.ts`, nothing more.
 *
 * **2FA is a UI-only simulation** (project decision): `twoFactorEnabled` is
 * stored and served, and `TwoFactorDialog.tsx` reacts to it, but the backend
 * never issues or verifies a TOTP and login stays one step. See NOTES.md § 9.
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import { serializeConfig } from '../lib/serialize.js';
import { zDoubleApproval, zPasswordPolicy } from '../lib/enums.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const configRouter: Router = Router();

/** There is exactly one row; the schema pins it to `id = 1`. */
const CONFIG_ID = 1;

async function loadConfig() {
  const row = await prisma.orgConfig.findFirst({ orderBy: { id: 'asc' } });
  if (!row) {
    throw HttpError.notFound(
      'No hay configuración de organización. Ejecuta `npx prisma db seed`.',
    );
  }
  return row;
}

// ---------------------------------------------------------------------------
// GET /config
// ---------------------------------------------------------------------------

/**
 * Any authenticated role, INCLUDING `Lector`.
 *
 * `lectorRestrictedPages` blocks a Lector from the *Configuración page*, and
 * that restriction is enforced on the mutation below. The read has to stay
 * open: `brandColor`/`orgName` theme the whole shell and `doubleApproval` is
 * read from `Editor.tsx:190` and `ApprovalFlowDialog.tsx:88`, screens that have
 * nothing to do with the config page. Nothing here is sensitive. See NOTES.md § 21.
 */
configRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.status(200).json(serializeConfig(await loadConfig()));
  }),
);

// ---------------------------------------------------------------------------
// PATCH /config
// ---------------------------------------------------------------------------

/**
 * Partial update, matching `UPDATE_CONFIG`'s `Partial<OrgConfig>` payload —
 * although `Configuracion.tsx#handleSave()` in practice sends the whole draft.
 * Unknown keys are rejected rather than silently dropped, so a typo surfaces
 * as a 400 instead of a save that quietly does nothing.
 */
const zPatchConfigBody = z
  .object({
    orgName: z.string().trim().min(1, 'El nombre de la organización es obligatorio.').max(120),
    brandColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser hexadecimal, ej. "#1B4F8A".'),
    twoFactorEnabled: z.boolean(),
    passwordPolicy: zPasswordPolicy,
    doubleApproval: zDoubleApproval,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No se envió ningún cambio.',
  });

configRouter.patch(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar la configuración del sistema por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPatchConfigBody }),
  asyncHandler(async (req, res) => {
    const changes = req.body as z.infer<typeof zPatchConfigBody>;
    await loadConfig(); // 404s before the update if the singleton is missing.

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.orgConfig.update({ where: { id: CONFIG_ID }, data: changes });
      // Verbatim string from Configuracion.tsx#handleSave().
      await writeAudit(
        req,
        'Actualizó políticas de seguridad e identidad visual del sistema',
        { tx },
      );
      return row;
    });

    res.status(200).json(serializeConfig(updated));
  }),
);
