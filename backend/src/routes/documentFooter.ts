/**
 * `/document-footer` — the `DocumentFooterConfig` singleton.
 *
 * Backend-persisted form of Control Documental's "Pie de página" tab
 * (`cfg.footer` in `frontend/src/routes/ControlDocumental.jsx`): the footer
 * template and its content fields (confidentiality label, print legend, and
 * the QR / hash / print-timestamp / cargo / fecha switches). Until now this
 * lived only in that component's React state and reset on every reload.
 *
 * Like `/document-header`, nothing reads this at document-creation time yet
 * — the document editor renders a fixed signature block. Persisting it just
 * makes a saved choice survive and gives a future footer renderer one
 * source.
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET /document-footer   requireAuth     -> DocumentFooterConfigDTO
 *   PUT /document-footer   Administrador   -> DocumentFooterConfigDTO
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import {
  DEFAULT_FOOTER_CONFIG,
  FOOTER_CLASIFICACIONES,
  FOOTER_TEMPLATES,
} from '../lib/footerConfig.js';
import { serializeDocumentFooterConfig } from '../lib/serialize.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const documentFooterRouter: Router = Router();

/** There is exactly one row; the schema pins it to `id = 1`. */
const CONFIG_ID = 1;

// ---------------------------------------------------------------------------
// GET /document-footer
// ---------------------------------------------------------------------------

/** Any authenticated role — this only shapes a footer preview, nothing
 * sensitive. */
documentFooterRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const row = await prisma.documentFooterConfig.findUnique({ where: { id: CONFIG_ID } });
    // Fall back to the defaults the "Pie de página" tab has always shown
    // rather than 404ing, so a fresh database that hasn't seeded yet still
    // works.
    if (!row) {
      res.status(200).json(DEFAULT_FOOTER_CONFIG);
      return;
    }
    res.status(200).json(serializeDocumentFooterConfig(row));
  }),
);

// ---------------------------------------------------------------------------
// PUT /document-footer
// ---------------------------------------------------------------------------

const zPutBody = z
  .object({
    tpl: z.enum(FOOTER_TEMPLATES),
    clasificacion: z.enum(FOOTER_CLASIFICACIONES),
    leyenda: z.string().trim().max(500, 'La leyenda es demasiado larga (máximo 500 caracteres).'),
    qr: z.boolean(),
    hash: z.boolean(),
    impresion: z.boolean(),
    mostrarCargo: z.boolean(),
    mostrarFecha: z.boolean(),
  })
  .strict();

documentFooterRouter.put(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar la plantilla de pie de página por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPutBody }),
  asyncHandler(async (req, res) => {
    const changes = req.body as z.infer<typeof zPutBody>;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.documentFooterConfig.upsert({
        where: { id: CONFIG_ID },
        create: { id: CONFIG_ID, ...changes },
        update: changes,
      });
      await writeAudit(req, 'Actualizó la plantilla de pie de página de documentos', { tx });
      return row;
    });

    res.status(200).json(serializeDocumentFooterConfig(updated));
  }),
);
