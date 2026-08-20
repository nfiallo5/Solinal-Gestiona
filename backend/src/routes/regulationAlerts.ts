/**
 * Regulation alerts — the data-driven replacement for the hardcoded
 * `NORMA_CON_CAMBIO_PENDIENTE` / `REGULATION_UPDATE_MARKER` /
 * `regulationUpdateText` consts in `src/features/editor/aiEngine.ts`.
 *
 * Mounted at `/regulation-alerts` (see `src/app.ts`).
 *
 *   GET /regulation-alerts?norma=ISO%2022000:2018   → RegulationAlertDTO[]
 *
 * The banner predicate in `Editor.tsx` — *the document's `norma` has an active
 * alert AND `doc.content` does not already contain that alert's `marker`* — is
 * unchanged in meaning. A client can evaluate it from this list, or let the
 * server do it with `GET /documents/:code/regulation-alert`
 * (`src/routes/documentWorkflow.ts`).
 *
 * Read-only on purpose: alerts are seeded/administered out of band. There is no
 * create/update endpoint because nothing in the frontend authors them.
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { serializeRegulationAlert } from '../lib/serialize.js';

export const regulationAlertsRouter: Router = Router();

const zListQuery = z.object({
  /** Filter to one norm, e.g. "ISO 22000:2018". Omit to list every alert. */
  norma: z.string().min(1).optional(),
  /**
   * Include deactivated alerts too. Defaults to false — the banner only ever
   * cares about active ones.
   */
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

regulationAlertsRouter.get(
  '/',
  requireAuth,
  validate({ query: zListQuery }),
  asyncHandler(async (req, res) => {
    const { norma, includeInactive } = req.validatedQuery as z.infer<typeof zListQuery>;

    const alerts = await prisma.regulationAlert.findMany({
      where: {
        ...(norma ? { norma } : {}),
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: [{ norma: 'asc' }, { id: 'desc' }],
    });

    res.status(200).json(alerts.map(serializeRegulationAlert));
  }),
);
