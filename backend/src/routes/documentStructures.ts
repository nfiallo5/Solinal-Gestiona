/**
 * `/document-structures` — the `DocumentStructureSection` table.
 *
 * Backend-persisted form of Control Documental's "Estructuras documentales"
 * tab (`cfg.estructuras` in `frontend/src/routes/ControlDocumental.jsx`).
 * Until now the per-type outline lived only in that component's React state,
 * so adding / renaming / reordering / unchecking a section was lost the
 * moment the page was left. See NOTES.md § 17.
 *
 * The wire shape is a map keyed by document-type sigla, mirroring
 * `cfg.estructuras` exactly:
 *
 *   { "PRO": [ { titulo: "Objetivo", activa: true }, ... ], "POL": [ ... ] }
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET /document-structures   requireAuth     -> Record<sigla, Section[]>
 *   PUT /document-structures   Administrador   -> Record<sigla, Section[]>
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import { serializeDocumentStructures } from '../lib/serialize.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const documentStructuresRouter: Router = Router();

// ---------------------------------------------------------------------------
// GET /document-structures
// ---------------------------------------------------------------------------

/** Any authenticated role — this only shapes an outline preview, nothing
 * sensitive. */
documentStructuresRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.documentStructureSection.findMany({
      orderBy: [{ tipoSigla: 'asc' }, { orden: 'asc' }],
    });
    res.status(200).json(serializeDocumentStructures(rows));
  }),
);

// ---------------------------------------------------------------------------
// PUT /document-structures — replace-all, matching how Control Documental's
// "Guardar configuración" sends the whole `estructuras` map at once.
// ---------------------------------------------------------------------------

const zSeccion = z.object({
  titulo: z.string().trim().min(1, 'El nombre de la sección es obligatorio.').max(120),
  activa: z.boolean(),
});

/** A map of type sigla -> ordered sections. Keys are normalised to uppercase
 * in the handler so "pro" and "PRO" can't both land as separate outlines. */
const zPutBody = z
  .record(z.string(), z.array(zSeccion))
  .refine((m) => Object.keys(m).length > 0, {
    message: 'Debe enviar la estructura de al menos un tipo documental.',
  });

documentStructuresRouter.put(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar las estructuras documentales por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPutBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof zPutBody>;

    // Normalise + flatten to rows, folding any case-variant keys together.
    const byType = new Map<string, z.infer<typeof zSeccion>[]>();
    for (const [rawSigla, secciones] of Object.entries(body)) {
      const sigla = rawSigla.trim().toUpperCase();
      if (!sigla) throw HttpError.badRequest('Hay un tipo documental sin sigla.');
      if (sigla.length > 10) throw HttpError.badRequest(`Sigla de tipo inválida: ${rawSigla}`);
      if (byType.has(sigla)) throw HttpError.badRequest(`Sigla de tipo duplicada: ${sigla}`);
      byType.set(sigla, secciones);
    }

    const data = [...byType.entries()].flatMap(([tipoSigla, secciones]) =>
      secciones.map((s, orden) => ({
        tipoSigla,
        titulo: s.titulo,
        activa: s.activa,
        orden,
      })),
    );

    const rows = await prisma.$transaction(async (tx) => {
      await tx.documentStructureSection.deleteMany({});
      if (data.length > 0) await tx.documentStructureSection.createMany({ data });
      await writeAudit(req, 'Actualizó las estructuras documentales por tipo', { tx });
      return tx.documentStructureSection.findMany({
        orderBy: [{ tipoSigla: 'asc' }, { orden: 'asc' }],
      });
    });

    res.status(200).json(serializeDocumentStructures(rows));
  }),
);
