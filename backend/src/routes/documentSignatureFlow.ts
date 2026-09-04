/**
 * `/document-signature-flow` — the `DocumentSignatureFlowConfig` singleton.
 *
 * Backend-persisted form of Control Documental's "Flujo de firmas" card,
 * inside the "Pie de página" tab: whether authoring requires the process
 * owner's participation (`participacionDueno`, ISO 9001:2015 5.1.3), and the
 * 3-stage review-and-approval chain (`etapas`: Elaboró / Revisó / Aprobó,
 * each with a `rol` and whether it's mandatory — 7.5.2). Until now
 * `participacionDueno` lived only in `cfg.ctrl` and reset on reload, and the
 * `etapas` table was an uncontrolled `<select defaultValue>` /
 * `<input defaultChecked>` mock that never persisted anything at all.
 *
 * Like `/document-header` and `/document-footer`, nothing reads this at
 * document-creation or signing time yet — `Editor.tsx` does not gate who may
 * sign against `etapas`. Persisting it just makes a saved choice survive.
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET /document-signature-flow   requireAuth     -> DocumentSignatureFlowConfigDTO
 *   PUT /document-signature-flow   Administrador   -> DocumentSignatureFlowConfigDTO
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import {
  DEFAULT_SIGNATURE_FLOW_CONFIG,
  FLUJO_FIRMAS_ETAPAS,
  FLUJO_FIRMAS_ROLES,
} from '../lib/signatureFlowConfig.js';
import { serializeDocumentSignatureFlowConfig } from '../lib/serialize.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const documentSignatureFlowRouter: Router = Router();

/** There is exactly one row; the schema pins it to `id = 1`. */
const CONFIG_ID = 1;

// ---------------------------------------------------------------------------
// GET /document-signature-flow
// ---------------------------------------------------------------------------

/** Any authenticated role — this only shapes a config preview, nothing
 * sensitive. */
documentSignatureFlowRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const row = await prisma.documentSignatureFlowConfig.findUnique({ where: { id: CONFIG_ID } });
    // Fall back to the defaults the "Flujo de firmas" card has always shown
    // rather than 404ing, so a fresh database that hasn't seeded yet still
    // works.
    if (!row) {
      res.status(200).json(DEFAULT_SIGNATURE_FLOW_CONFIG);
      return;
    }
    res.status(200).json(serializeDocumentSignatureFlowConfig(row));
  }),
);

// ---------------------------------------------------------------------------
// PUT /document-signature-flow
// ---------------------------------------------------------------------------

const zEtapa = z
  .object({
    etapa: z.enum(FLUJO_FIRMAS_ETAPAS),
    rol: z.enum(FLUJO_FIRMAS_ROLES),
    obligatoria: z.boolean(),
  })
  .strict();

const zPutBody = z
  .object({
    participacionDueno: z.boolean(),
    // Exactly 3 stages. z.tuple enforces the length; the .refine below pins
    // the order to Elaboró -> Revisó -> Aprobó, matching FLUJO_FIRMAS_ETAPAS.
    etapas: z
      .tuple([zEtapa, zEtapa, zEtapa])
      .refine((arr) => arr.every((e, i) => e.etapa === FLUJO_FIRMAS_ETAPAS[i]), {
        message: 'Las etapas deben venir en orden: Elaboró, Revisó, Aprobó.',
      }),
  })
  .strict();

documentSignatureFlowRouter.put(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar el flujo de firmas de documentos por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPutBody }),
  asyncHandler(async (req, res) => {
    const changes = req.body as z.infer<typeof zPutBody>;
    if (changes.etapas.length !== 3) {
      // Defense in depth — z.tuple already guarantees this, but keep the
      // invariant explicit since `etapas` is stored as untyped JSONB.
      throw HttpError.badRequest('El flujo de firmas debe tener exactamente 3 etapas.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.documentSignatureFlowConfig.upsert({
        where: { id: CONFIG_ID },
        create: { id: CONFIG_ID, ...changes },
        update: changes,
      });
      await writeAudit(req, 'Actualizó el flujo de firmas de documentos', { tx });
      return row;
    });

    res.status(200).json(serializeDocumentSignatureFlowConfig(updated));
  }),
);
