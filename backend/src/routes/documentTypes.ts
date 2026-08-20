/**
 * `/document-types` — the `DocumentTypeCatalog` table.
 *
 * Backend-persisted form of Control Documental's "Tipos de información
 * documentada" table (the "Tipos y codificación" tab), replacing what used
 * to live only in one browser's localStorage
 * (`frontend/src/features/documents/controlConfigStore.ts`). See
 * NOTES.md § 17 for what this table intentionally does NOT do yet
 * (`Document.type`/`DocumentTemplate.type` still use the fixed `DocumentType`
 * enum — this catalog only drives labels/metadata shown to the user, not the
 * value stored on a document).
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET /document-types   requireAuth     -> DocumentTypeCatalogDTO[]
 *   PUT /document-types   Administrador   -> DocumentTypeCatalogDTO[]
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import { serializeDocumentTypeCatalog } from '../lib/serialize.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const documentTypesRouter: Router = Router();

// ---------------------------------------------------------------------------
// GET /document-types
// ---------------------------------------------------------------------------

/** Any authenticated role — this only labels a dropdown, nothing sensitive. */
documentTypesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.documentTypeCatalog.findMany({ orderBy: { orden: 'asc' } });
    res.status(200).json(rows.map(serializeDocumentTypeCatalog));
  }),
);

// ---------------------------------------------------------------------------
// PUT /document-types — replace-all, matching how Control Documental's
// "Guardar configuración" already sends the whole `tipos` array at once.
// ---------------------------------------------------------------------------

const zItem = z.object({
  sigla: z
    .string()
    .trim()
    .min(1, 'La sigla es obligatoria.')
    .max(10)
    .transform((s) => s.toUpperCase()),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(80),
  nivel: z.number().int().min(1).max(10),
  digitos: z.number().int().min(1).max(6),
  retencion: z.string().trim().min(1).max(60),
  firma: z.boolean(),
  orden: z.number().int().min(0),
});

const zPutBody = z.array(zItem).min(1, 'La lista de tipos no puede quedar vacía.');

documentTypesRouter.put(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar el catálogo de tipos documentales por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPutBody }),
  asyncHandler(async (req, res) => {
    const items = req.body as z.infer<typeof zPutBody>;

    const siglas = new Set<string>();
    for (const item of items) {
      if (siglas.has(item.sigla)) {
        throw HttpError.badRequest(`Sigla duplicada: ${item.sigla}`);
      }
      siglas.add(item.sigla);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.documentTypeCatalog.deleteMany({ where: { sigla: { notIn: [...siglas] } } });
      const rows = await Promise.all(
        items.map((item) =>
          tx.documentTypeCatalog.upsert({
            where: { sigla: item.sigla },
            create: item,
            update: item,
          }),
        ),
      );
      await writeAudit(req, 'Actualizó el catálogo de tipos de información documentada', { tx });
      return rows;
    });

    updated.sort((a, b) => a.orden - b.orden);
    res.status(200).json(updated.map(serializeDocumentTypeCatalog));
  }),
);
