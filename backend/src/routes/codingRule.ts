/**
 * `/coding-rule` — the `CodingRule` singleton.
 *
 * Backend-persisted form of Control Documental's "Regla de codificación"
 * card (the "Tipos y codificación" tab) — the token order/format
 * `src/lib/documentCode.ts` uses to generate every new document's `code`.
 * Saving a rule here is what makes it actually apply to
 * `POST /documents` and to `CreateDocumentDialog`'s live preview, not just
 * the mock code shown on the Control Documental page itself.
 *
 * ── Routes ─────────────────────────────────────────────────────────────────
 *   GET /coding-rule   requireAuth     -> CodingRuleDTO
 *   PUT /coding-rule   Administrador   -> CodingRuleDTO
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { writeAudit } from '../lib/audit.js';
import {
  CODING_SEPARATORS,
  CODING_TOKENS,
  CODING_VERSION_PREFIXES,
  CODING_YEAR_FORMATS,
  DEFAULT_CODING_RULE,
} from '../lib/documentCode.js';
import { serializeCodingRule } from '../lib/serialize.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from './auth.js';

export const codingRuleRouter: Router = Router();

/** There is exactly one row; the schema pins it to `id = 1`. */
const RULE_ID = 1;

// ---------------------------------------------------------------------------
// GET /coding-rule
// ---------------------------------------------------------------------------

/** Any authenticated role — this only shapes a code preview, nothing sensitive. */
codingRuleRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const row = await prisma.codingRule.findUnique({ where: { id: RULE_ID } });
    // Falls back to the row generation always assumed until now (matches
    // today's actual TIPO-AREA-NNN codes) rather than 404ing, so a fresh
    // database that hasn't run `prisma db seed` yet doesn't break Control
    // Documental or Crear Documento.
    if (!row) {
      res.status(200).json({ ...DEFAULT_CODING_RULE, unico: true, hereda: true });
      return;
    }
    res.status(200).json(serializeCodingRule(row));
  }),
);

// ---------------------------------------------------------------------------
// PUT /coding-rule
// ---------------------------------------------------------------------------

const zPutBody = z
  .object({
    tokens: z
      .array(z.enum(CODING_TOKENS))
      .min(1, 'Agrega al menos un bloque.')
      .refine((arr) => new Set(arr).size === arr.length, {
        message: 'No repitas un mismo bloque en la regla.',
      })
      .refine((arr) => arr.includes('CORRELATIVO'), {
        message: 'El correlativo es obligatorio: sin él, dos documentos nuevos podrían compartir código.',
      }),
    separador: z.enum(CODING_SEPARATORS),
    digitos: z.number().int().min(2).max(6),
    prefijoVer: z.enum(CODING_VERSION_PREFIXES),
    formatoAnio: z.enum(CODING_YEAR_FORMATS),
    empresaSigla: z
      .string()
      .trim()
      .min(1, 'La sigla de la empresa es obligatoria.')
      .max(10)
      .transform((s) => s.toUpperCase()),
    unico: z.boolean(),
    hereda: z.boolean(),
  })
  .strict();

codingRuleRouter.put(
  '/',
  requireAuth,
  requireAdmin(
    (req) =>
      `Intento no autorizado de modificar la regla de codificación por ${req.user?.name} (Rol: ${req.user?.role})`,
  ),
  validate({ body: zPutBody }),
  asyncHandler(async (req, res) => {
    const changes = req.body as z.infer<typeof zPutBody>;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.codingRule.upsert({
        where: { id: RULE_ID },
        create: { id: RULE_ID, ...changes },
        update: changes,
      });
      await writeAudit(req, 'Actualizó la regla de codificación de documentos', { tx });
      return row;
    });

    res.status(200).json(serializeCodingRule(updated));
  }),
);
