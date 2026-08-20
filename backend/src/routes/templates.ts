/**
 * `/templates` — the ISO documentary-pyramid template catalogue. Owned by
 * Agent 3.
 *
 * Ports `TEMPLATE_ADD` (AppStateContext.tsx) and
 * `NewTemplateDialog.tsx#handleSave`, including the derived `desc` / `preview`
 * / `content` / `mandatory` values the dialog computes from `secciones`.
 *
 * READ is open to every authenticated role — `Cumplimiento.tsx`
 * (`useRequirementMapping`) reads `state.templates` and that page is NOT in
 * `lectorRestrictedPages`. WRITE is closed to `Lector`, which cannot reach the
 * Plantillas page at all (src/data/seed.ts:482, Plantillas.tsx:33).
 */
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeAudit } from '../lib/audit.js';
import { serializeTemplate } from '../lib/serialize.js';
import {
  zDocumentType,
  zPeriodicidadWire,
  zRolesRequeridos,
  zTemplateLevel,
  zTemplateSection,
  type RolesRequeridos,
  type TemplateSectionShape,
} from '../lib/enums.js';

export const templatesRouter: Router = Router();

const EDITOR_ROLES = ['Administrador', 'Elaborador', 'Revisor', 'Aprobador'] as const;

/** NewTemplateDialog.tsx defaults when the form does not collect them. */
const DEFAULT_ROLES_REQUERIDOS: RolesRequeridos = {
  elaborador: 'Elaborador',
  revisor: 'Revisor',
  aprobador: 'Aprobador',
  dobleAprobacion: false,
};
const DEFAULT_RETENCION_ANIOS = 3;

// ---------------------------------------------------------------------------
// GET /templates
// ---------------------------------------------------------------------------

templatesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.documentTemplate.findMany({
      // Seed order first (the catalogue grid renders in array order today),
      // then key so the result is deterministic.
      orderBy: [{ createdAt: 'asc' }, { key: 'asc' }],
    });
    res.json(rows.map(serializeTemplate));
  }),
);

// ---------------------------------------------------------------------------
// POST /templates — port of TEMPLATE_ADD
// ---------------------------------------------------------------------------

const zCreateBody = z.object({
  /** Optional: the server derives the same slug the dialog builds. */
  key: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'El nombre de la plantilla es obligatorio.'),
  norma: z.string().trim().min(1),
  type: zDocumentType,
  nivel: zTemplateLevel,
  clausulaIso: z.string().trim().default(''),
  periodicidadRevision: zPeriodicidadWire,
  /**
   * G06 Scenario 4: "Debe especificar al menos una sección obligatoria para
   * cumplir con las directrices ISO." Enforced server-side too.
   */
  secciones: z
    .array(zTemplateSection)
    .min(1, 'Debe especificar al menos una sección para cumplir con las directrices ISO.'),
  desc: z.string().trim().optional(),
  preview: z.string().trim().optional(),
  content: z.string().optional(),
  /** @deprecated kept for compatibility; derived from `secciones` if absent. */
  mandatory: z.array(z.string()).optional(),
  tiempoRetencionAnios: z.number().int().nonnegative().optional(),
  documentoPadreKey: z.string().trim().min(1).nullish(),
  rolesRequeridos: zRolesRequeridos.optional(),
});

templatesRouter.post(
  '/',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ body: zCreateBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof zCreateBody>;

    // Same normalization the dialog does before saving: trim, drop untitled.
    const secciones: TemplateSectionShape[] = body.secciones
      .map((s) => ({ ...s, titulo: s.titulo.trim(), proposito: s.proposito.trim() }))
      .filter((s) => s.titulo.length > 0);
    if (secciones.length === 0) {
      throw HttpError.badRequest(
        'Debe especificar al menos una sección obligatoria para cumplir con las directrices ISO.',
      );
    }

    if (body.documentoPadreKey) {
      const padre = await prisma.documentTemplate.findUnique({
        where: { key: body.documentoPadreKey },
        select: { key: true },
      });
      if (!padre) {
        throw HttpError.badRequest(`La plantilla padre ${body.documentoPadreKey} no existe.`);
      }
    }

    const name = body.name;
    const key = body.key ?? `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.documentTemplate.create({
        data: {
          key,
          name,
          norma: body.norma,
          type: body.type,
          desc:
            body.desc ||
            `Estructura personalizada para ${body.type} bajo la norma ${body.norma}.`,
          preview: body.preview || `Secciones: ${secciones.map((s) => s.titulo).join(', ')}`,
          content:
            body.content ?? secciones.map((s, i) => `${i + 1}. ${s.titulo}`).join('<br/>'),
          mandatory: body.mandatory ?? secciones.filter((s) => s.obligatoria).map((s) => s.titulo),
          nivel: body.nivel,
          clausulaIso: body.clausulaIso,
          secciones: secciones as unknown as Prisma.InputJsonValue,
          periodicidadRevision: body.periodicidadRevision,
          tiempoRetencionAnios: body.tiempoRetencionAnios ?? DEFAULT_RETENCION_ANIOS,
          documentoPadreKey: body.documentoPadreKey ?? null,
          rolesRequeridos: (body.rolesRequeridos ??
            DEFAULT_ROLES_REQUERIDOS) as unknown as Prisma.InputJsonValue,
        },
      });
      await writeAudit(req, `Creó una nueva plantilla de documento: ${name}`, { tx });
      return row;
    });

    res.status(201).json(serializeTemplate(created));
  }),
);
