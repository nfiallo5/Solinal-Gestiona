/**
 * `/documents` — generic document CRUD, list/read filters, and the comment
 * thread. Owned by Agent 3.
 *
 * NOT here (owned by Agent 4, in `documentWorkflow.ts`, mounted BEFORE this
 * router so those paths never fall through): `/:code/sign`, `/:code/approve`,
 * `/:code/reject`, `/:code/versions`, `/:code/versions/:index/restore`,
 * `/:code/section-lock`, `/:code/merge`, `/:code/scan-import`,
 * `/:code/apply-regulation`.
 *
 * Ports of:
 *   - `ADD_DOCUMENT`   (AppStateContext.tsx) + `CreateDocumentDialog.tsx`
 *   - `UPDATE_DOCUMENT`(AppStateContext.tsx) + `Editor.tsx#updateDoc`
 *   - `ADD_COMMENT`    (AppStateContext.tsx) + `Editor.tsx#handleAddComment`
 *   - the client-side filtering in `Documentos.tsx`
 */
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { getAuthUser, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { formatCommentDate, writeAudit } from '../lib/audit.js';
import {
  documentInclude,
  parseRolesRequeridos,
  serializeComment,
  serializeDocument,
} from '../lib/serialize.js';
import {
  DocumentStatus,
  fromWireEstado,
  zDocumentType,
  zEstadoWire,
  type EstadoWire,
} from '../lib/enums.js';
import { createWithGeneratedCode, zAreaCode } from '../lib/documentCode.js';

export const documentsRouter: Router = Router();

/**
 * Everyone except `Lector`. `lectorRestrictedPages` (src/data/seed.ts:482)
 * blocks the Lector from the `edit` page, which is where every document
 * mutation and the comment thread live.
 */
const EDITOR_ROLES = ['Administrador', 'Elaborador', 'Revisor', 'Aprobador'] as const;

// ---------------------------------------------------------------------------
// GET /documents — list with the filters Documentos.tsx applies client-side
// ---------------------------------------------------------------------------

/**
 * `"Vencido"` is not a `DocumentStatus`; it is the 5th option of the estado
 * <Select> in Documentos.tsx, where it means `d.vencido === true`.
 */
const zEstadoFilter = z.enum(['Borrador', 'En aprobación', 'Aprobado', 'Rechazado', 'Vencido']);

const zBooleanFlag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const zListQuery = z.object({
  /** `Borrador | En aprobación | Aprobado | Rechazado | Vencido` (see above). */
  estado: zEstadoFilter.optional(),
  type: zDocumentType.optional(),
  norma: z.string().trim().min(1).optional(),
  vencido: zBooleanFlag.optional(),
  critico: zBooleanFlag.optional(),
  /** Case-insensitive substring over `title` OR `code`. */
  search: z.string().trim().min(1).optional(),
});

documentsRouter.get(
  '/',
  requireAuth,
  validate({ query: zListQuery }),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as z.infer<typeof zListQuery>;
    const user = getAuthUser(req);

    const and: Prisma.DocumentWhereInput[] = [];

    if (q.estado === 'Vencido') {
      and.push({ vencido: true });
    } else if (q.estado) {
      and.push({ estado: fromWireEstado(q.estado as EstadoWire) });
    }
    if (q.type) and.push({ type: q.type });
    if (q.norma) and.push({ norma: q.norma });
    if (q.vencido !== undefined) and.push({ vencido: q.vencido });
    if (q.critico !== undefined) and.push({ critico: q.critico });
    if (q.search) {
      and.push({
        OR: [
          { title: { contains: q.search, mode: 'insensitive' } },
          { code: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }

    // "Filtrado según rol: Lector solo ve aprobados." (Documentos.tsx:55)
    // Pushed as an extra AND term rather than overwriting an explicit estado
    // filter, so `?estado=Borrador` as a Lector correctly returns nothing.
    if (user.role === 'Lector') and.push({ estado: DocumentStatus.Aprobado });

    const rows = await prisma.document.findMany({
      where: and.length > 0 ? { AND: and } : {},
      include: documentInclude,
      // Reproduces the seed array order the UI renders today; ties broken by
      // code so the list is deterministic.
      orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
    });

    res.json(rows.map(serializeDocument));
  }),
);

// ---------------------------------------------------------------------------
// GET /documents/:code — single document (Editor.tsx)
// ---------------------------------------------------------------------------

const zCodeParams = z.object({ code: z.string().trim().min(1) });

documentsRouter.get(
  '/:code',
  requireAuth,
  validate({ params: zCodeParams }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const user = getAuthUser(req);

    const row = await loadDocument(code);
    if (user.role === 'Lector' && row.estado !== DocumentStatus.Aprobado) {
      throw HttpError.forbidden('El rol Lector solo puede consultar documentos aprobados.');
    }

    res.json(serializeDocument(row));
  }),
);

// ---------------------------------------------------------------------------
// POST /documents — port of ADD_DOCUMENT / CreateDocumentDialog#handleCreate
// ---------------------------------------------------------------------------

const zCreateBody = z.object({
  /** `key` of the originating template. Omit / null for a blank document. */
  templateKey: z.string().trim().min(1).nullish(),
  title: z.string().trim().min(1, 'El título es necesario.'),
  type: zDocumentType,
  /** 3-letter department code — the middle segment of the control code. */
  area: zAreaCode,
  norma: z.string().trim().min(1),
  /**
   * Collected by the dialog's "Descripción breve" textarea but NOT persisted:
   * `SolinalDocument` has no description field. Accepted and ignored so the
   * existing form can post its whole state unchanged. See NOTES.md.
   */
  description: z.string().optional(),
  /**
   * The "Marcar como documento crítico" checkbox. Only honoured for BLANK
   * documents — when a template is used, `critico` derives from
   * `template.rolesRequeridos.dobleAprobacion` (CreateDocumentDialog.tsx:127).
   */
  critico: z.boolean().optional(),
});

documentsRouter.post(
  '/',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ body: zCreateBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof zCreateBody>;
    const user = getAuthUser(req);

    const template = body.templateKey
      ? await prisma.documentTemplate.findUnique({ where: { key: body.templateKey } })
      : null;
    if (body.templateKey && !template) {
      throw HttpError.badRequest(`La plantilla ${body.templateKey} no existe.`);
    }

    const rolesRequeridos = template ? parseRolesRequeridos(template.rolesRequeridos) : null;

    const created = await createWithGeneratedCode(body.type, body.area, (code) =>
      prisma.document.create({
        data: {
          code,
          title: body.title,
          // `type` / `norma` come from the form: the dialog pre-fills them
          // from the template but leaves both editable before submit.
          type: body.type,
          norma: body.norma,
          estado: DocumentStatus.Borrador,
          version: 'v1.0',
          creadorId: user.id,
          creador: user.name,
          vencido: false,
          critico: template ? (rolesRequeridos?.dobleAprobacion ?? false) : (body.critico ?? false),
          content: template ? template.content : '',
          nivel: template ? template.nivel : null,
          rolesRequeridos: rolesRequeridos
            ? (rolesRequeridos as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
        include: documentInclude,
      }),
    );

    await writeAudit(req, `Creó el documento ${created.code}${template ? ' desde plantilla' : ''}`);

    res.status(201).json(serializeDocument(created));
  }),
);

// ---------------------------------------------------------------------------
// PATCH /documents/:code — generic partial update + optimistic concurrency
// ---------------------------------------------------------------------------

const zPatchBody = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: z.string().optional(),
    /**
     * Optimistic-concurrency token. Send the `contentVersion` the client last
     * read; a stale value makes this request 409 instead of clobbering
     * someone else's edit. Only meaningful alongside `content`.
     */
    contentVersion: z.number().int().nonnegative().optional(),
    estado: zEstadoWire.optional(),
    version: z.string().trim().min(1).optional(),
    vencido: z.boolean().optional(),
    critico: z.boolean().optional(),
  })
  .refine(
    (b) =>
      b.title !== undefined ||
      b.content !== undefined ||
      b.estado !== undefined ||
      b.version !== undefined ||
      b.vencido !== undefined ||
      b.critico !== undefined,
    { message: 'No hay cambios en la solicitud.' },
  );

documentsRouter.patch(
  '/:code',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zPatchBody }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const body = req.body as z.infer<typeof zPatchBody>;

    const existing = await loadDocument(code);
    const writesContent = body.content !== undefined;

    if (writesContent) {
      // --- Optimistic concurrency (drives MergeDialog.tsx) -----------------
      if (body.contentVersion !== undefined && body.contentVersion !== existing.contentVersion) {
        throw new HttpError(409, `El documento ${code} fue modificado por otra sesión.`, {
          code: 'CONTENT_VERSION_CONFLICT',
          details: {
            code,
            clientContentVersion: body.contentVersion,
            serverContentVersion: existing.contentVersion,
            clientContent: body.content,
            serverContent: existing.content,
            serverUpdatedAt: existing.updatedAt.toISOString(),
          },
        });
      }

      // --- A signed Registro is frozen evidence (Editor.tsx:257) -----------
      if (existing.nivel === 'Registro' && existing.signatures.length > 0) {
        throw HttpError.locked(
          `El documento ${code} es un Registro firmado: su contenido queda protegido como evidencia.`,
        );
      }
    }

    const data: Prisma.DocumentUpdateInput = {};
    const campos: string[] = [];
    if (body.title !== undefined) {
      data.title = body.title;
      campos.push('título');
    }
    if (writesContent) {
      data.content = body.content;
      data.contentVersion = { increment: 1 };
      campos.push('contenido');
    }
    if (body.estado !== undefined) {
      data.estado = body.estado;
      campos.push('estado');
    }
    if (body.version !== undefined) {
      data.version = body.version;
      campos.push('versión');
    }
    if (body.vencido !== undefined) {
      data.vencido = body.vencido;
      campos.push('vencido');
    }
    if (body.critico !== undefined) {
      data.critico = body.critico;
      campos.push('crítico');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.document.update({
        where: { code },
        data,
        include: documentInclude,
      });
      await writeAudit(req, `Actualizó el documento ${code} (${campos.join(', ')})`, { tx });
      return row;
    });

    res.json(serializeDocument(updated));
  }),
);

// ---------------------------------------------------------------------------
// Comments — port of ADD_COMMENT / Editor.tsx#handleAddComment
// ---------------------------------------------------------------------------

const zCommentBody = z.object({
  text: z.string().trim().min(1, 'El comentario no puede estar vacío.'),
});

documentsRouter.get(
  '/:code/comments',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    await assertDocumentExists(code);

    const rows = await prisma.documentComment.findMany({
      where: { code },
      // OLDEST FIRST: CommentsThread.tsx renders the array in order and the
      // frontend appends new comments to the end.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    res.json(rows.map(serializeComment));
  }),
);

documentsRouter.post(
  '/:code/comments',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zCommentBody }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { text } = req.body as z.infer<typeof zCommentBody>;
    const user = getAuthUser(req);

    await assertDocumentExists(code);

    const comment = await prisma.$transaction(async (tx) => {
      const row = await tx.documentComment.create({
        data: {
          code,
          authorId: user.id,
          author: user.name,
          date: formatCommentDate(new Date()),
          text,
        },
      });
      await writeAudit(req, `Añadió un comentario en documento ${code}`, { tx });
      return row;
    });

    res.status(201).json(serializeComment(comment));
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDocument(code: string) {
  const row = await prisma.document.findUnique({ where: { code }, include: documentInclude });
  if (!row) throw HttpError.notFound(`Documento ${code} no encontrado.`);
  return row;
}

async function assertDocumentExists(code: string): Promise<void> {
  const row = await prisma.document.findUnique({ where: { code }, select: { code: true } });
  if (!row) throw HttpError.notFound(`Documento ${code} no encontrado.`);
}
