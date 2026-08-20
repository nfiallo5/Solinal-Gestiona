/**
 * `/audit-logs` — read-only view over the immutable audit trail. Owned by
 * Agent 3.
 *
 * There is deliberately **no POST route**: audit entries are a server side
 * effect written by `src/lib/audit.ts#writeAudit()` from every mutating
 * handler. `ADD_AUDIT_LOG` in the frontend has no REST counterpart on purpose
 * (backend-agent-instructions.md §3) — the client must never be able to forge
 * trail entries, and `Auditoria.tsx` itself calls the page "Audit Trail
 * inmutable".
 *
 * Filters are the three in `src/features/audit/AuditFilters.tsx`.
 */
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { serializeAuditLog } from '../lib/serialize.js';
import { zRoleName } from '../lib/enums.js';

export const auditLogsRouter: Router = Router();

/** `audit` is in `lectorRestrictedPages` (src/data/seed.ts:482). */
const AUDIT_ROLES = ['Administrador', 'Elaborador', 'Revisor', 'Aprobador'] as const;

/**
 * The <Select>s use the literal `"all"` as their "no filter" sentinel, so it
 * is accepted and treated as absent rather than as a user named "all".
 */
const ALL = 'all';
const zAllOr = <T extends z.ZodTypeAny>(schema: T) => z.union([z.literal(ALL), schema]).optional();

const zListQuery = z.object({
  /** Exact match on the denormalized actor name. */
  user: zAllOr(z.string().trim().min(1)),
  /**
   * Document code. The frontend filters with `l.action.includes(filters.doc)`
   * because an audit row has no document FK — the code is embedded in the
   * freeform Spanish `action` text. Ported verbatim as a substring match.
   */
  doc: zAllOr(z.string().trim().min(1)),
  role: zAllOr(zRoleName),
  /** Optional cap; omitted returns the whole trail, like the UI does today. */
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

auditLogsRouter.get(
  '/',
  requireAuth,
  requireRole(...AUDIT_ROLES),
  validate({ query: zListQuery }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as z.infer<typeof zListQuery>;

    const where: Prisma.AuditLogEntryWhereInput = {};
    if (q.user && q.user !== ALL) where.user = q.user;
    if (q.role && q.role !== ALL) where.role = q.role;
    if (q.doc && q.doc !== ALL) where.action = { contains: q.doc };

    const rows = await prisma.auditLogEntry.findMany({
      where,
      // NEWEST FIRST. Must be createdAt-then-id: the seed ids ascend while the
      // seed array is newest-first, so a plain `id desc` renders them
      // backwards (see NOTES.md §6).
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(q.limit ? { take: q.limit } : {}),
    });

    res.json(rows.map(serializeAuditLog));
  }),
);
