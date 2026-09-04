/**
 * `/document-header` — the `DocumentHeaderConfig` singleton.
 *
 * Backend-persisted form of Control Documental's "Encabezado" tab
 * (`cfg.header` in `frontend/src/routes/ControlDocumental.jsx`): the header
 * template, the identification/description fields toggled on, and the table
 * styling. Until now this lived only in that component's React state and
 * reset on every reload.
 *
 * Like `/document-structures`, nothing reads this at document-creation time
 * yet — the document editor renders a fixed header. Persisting it just makes
 * a saved choice survive and gives a future header renderer one source.
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET /document-header   requireAuth     -> DocumentHeaderConfigDTO
 *   PUT /document-header    Administrador   -> DocumentHeaderConfigDTO
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import { DEFAULT_HEADER_CONFIG, HEADER_BORDES, HEADER_TEMPLATES } from '../lib/headerConfig.js';
import { serializeDocumentHeaderConfig } from '../lib/serialize.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const documentHeaderRouter: Router = Router();

/** There is exactly one row; the schema pins it to `id = 1`. */
const CONFIG_ID = 1;

// ---------------------------------------------------------------------------
// GET /document-header
// ---------------------------------------------------------------------------

/** Any authenticated role — this only shapes a header preview, nothing
 * sensitive. */
documentHeaderRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const row = await prisma.documentHeaderConfig.findUnique({ where: { id: CONFIG_ID } });
    // Fall back to the defaults the "Encabezado" tab has always shown rather
    // than 404ing, so a fresh database that hasn't seeded yet still works.
    if (!row) {
      res.status(200).json(DEFAULT_HEADER_CONFIG);
      return;
    }
    res.status(200).json(serializeDocumentHeaderConfig(row));
  }),
);

// ---------------------------------------------------------------------------
// PUT /document-header
// ---------------------------------------------------------------------------

/**
 * Exactly the 16 header-field keys the "Encabezado" tab toggles — no more, no
 * less (`.strict()`). Idioma / medio / clasificación / próxima revisión were
 * dropped from "Identificación y descripción" (migration
 * `20260904152133_drop_document_header_fields`). Keep in sync with
 * `HEADER_CAMPO_KEYS` in `lib/headerConfig.ts` and `prisma/seed.ts`.
 */
const zCampos = z
  .object({
    titulo: z.boolean(),
    codigo: z.boolean(),
    version: z.boolean(),
    fechaElaboracion: z.boolean(),
    fechaRevision: z.boolean(),
    fechaAprobacion: z.boolean(),
    autor: z.boolean(),
    responsable: z.boolean(),
    proceso: z.boolean(),
    tipoDoc: z.boolean(),
    objetivo: z.boolean(),
    logo: z.boolean(),
    razonSocial: z.boolean(),
    estado: z.boolean(),
    vigencia: z.boolean(),
    pagina: z.boolean(),
  })
  .strict();

const zPutBody = z
  .object({
    tpl: z.enum(HEADER_TEMPLATES),
    campos: zCampos,
    bordes: z.enum(HEADER_BORDES),
    repetir: z.boolean(),
  })
  .strict();

documentHeaderRouter.put(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar la plantilla de encabezado por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPutBody }),
  asyncHandler(async (req, res) => {
    const changes = req.body as z.infer<typeof zPutBody>;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.documentHeaderConfig.upsert({
        where: { id: CONFIG_ID },
        create: { id: CONFIG_ID, ...changes },
        update: changes,
      });
      await writeAudit(req, 'Actualizó la plantilla de encabezado de documentos', { tx });
      return row;
    });

    res.status(200).json(serializeDocumentHeaderConfig(updated));
  }),
);
