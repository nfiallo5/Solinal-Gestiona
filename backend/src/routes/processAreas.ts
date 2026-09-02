/**
 * `/process-areas` — the `ProcessArea` table.
 *
 * Backend-persisted form of Control Documental's "Procesos y áreas" table
 * (the "Tipos y codificación" tab), replacing what used to live only in one
 * browser's localStorage
 * (`frontend/src/features/documents/controlConfigStore.ts`).
 *
 * Unlike document type, the area code was never a Postgres enum, so this
 * table IS the source of truth: the "Área / Departamento" dropdown in Crear
 * Documento is built from it, and `POST /documents` rejects an `area` that
 * isn't one of these siglas.
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET /process-areas   requireAuth     -> ProcessAreaDTO[]
 *   PUT /process-areas   Administrador   -> ProcessAreaDTO[]
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import { serializeProcessArea } from '../lib/serialize.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const processAreasRouter: Router = Router();

// ---------------------------------------------------------------------------
// GET /process-areas
// ---------------------------------------------------------------------------

/** Any authenticated role — this only fills a dropdown, nothing sensitive. */
processAreasRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.processArea.findMany({ orderBy: { orden: 'asc' } });
    res.status(200).json(rows.map(serializeProcessArea));
  }),
);

// ---------------------------------------------------------------------------
// PUT /process-areas — replace-all, matching how Control Documental's
// "Guardar configuración" already sends the whole `procesos` array at once.
// ---------------------------------------------------------------------------

const zItem = z.object({
  sigla: z
    .string()
    .trim()
    .min(1, 'La sigla del área es obligatoria.')
    .max(10)
    .transform((s) => s.toUpperCase()),
  nombre: z.string().trim().min(1, 'El nombre del área es obligatorio.').max(80),
  orden: z.number().int().min(0),
});

const zPutBody = z.array(zItem).min(1, 'La lista de procesos/áreas no puede quedar vacía.');

processAreasRouter.put(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar el catálogo de procesos/áreas por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPutBody }),
  asyncHandler(async (req, res) => {
    const items = req.body as z.infer<typeof zPutBody>;

    const siglas = new Set<string>();
    for (const item of items) {
      if (siglas.has(item.sigla)) {
        throw HttpError.badRequest(`Sigla de área duplicada: ${item.sigla}`);
      }
      siglas.add(item.sigla);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.processArea.deleteMany({ where: { sigla: { notIn: [...siglas] } } });
      const rows = await Promise.all(
        items.map((item) =>
          tx.processArea.upsert({
            where: { sigla: item.sigla },
            create: item,
            update: item,
          }),
        ),
      );
      await writeAudit(req, 'Actualizó el catálogo de procesos y áreas', { tx });
      return rows;
    });

    updated.sort((a, b) => a.orden - b.orden);
    res.status(200).json(updated.map(serializeProcessArea));
  }),
);
