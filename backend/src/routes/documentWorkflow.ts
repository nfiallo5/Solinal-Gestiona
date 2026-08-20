/**
 * Document workflow & demo-flow actions — every mutating *verb* that lives
 * under `/documents/:code/…`.
 *
 * Mounted BEFORE `documentsRouter` in `src/app.ts` so these specific action
 * paths win over the generic `/:code` CRUD handlers. Generic CRUD (list, read,
 * create, PATCH, comments) belongs to `src/routes/documents.ts` — not here.
 *
 * ── What is ported from where ──────────────────────────────────────────────
 *   POST   /:code/sign                     ← Editor.tsx#handleSign (158-205)
 *   POST   /:code/approve                  ← ApprovalFlowDialog.tsx#handleApprove
 *   POST   /:code/reject                   ← ApprovalFlowDialog.tsx#handleReject
 *   POST   /:code/versions                 ← Editor.tsx#handleSaveVersion (123-140)
 *   POST   /:code/versions/:index/restore  ← Editor.tsx#handleRestoreVersion (208-217)
 *   PATCH  /:code/section-lock             ← Editor.tsx#handleToggleLock (111-120)
 *   POST   /:code/merge                    ← MergeDialog / handleConfirmMerge, now real
 *   POST   /:code/scan-import              ← ScannerDialog / handleScanComplete, now real
 *   POST   /:code/apply-regulation         ← RegulationBanner / handleApplyRegulation
 *   GET    /:code/regulation-alert         ← the banner predicate, server-computed
 *
 * ── Response shape ─────────────────────────────────────────────────────────
 * Every mutating action answers `{ document: DocumentDTO, message: string }`.
 * `message` is the exact Spanish string the corresponding `toast.*()` call
 * shows today, so the frontend can drop its hardcoded copies. `document` is
 * always produced by `serializeDocument` from a `documentInclude` query.
 *
 * ── Audit logging ──────────────────────────────────────────────────────────
 * `handleSign` logs its REJECTIONS as well as its successes
 * (`audit("Intento fallido…")` / `audit("Intento no autorizado…")`). That is why
 * the sign route does its role gating INSIDE the handler instead of with
 * `requireRole` — the middleware would 403 before the audit row could be
 * written. Approve/reject keep `requireRole`, because the frontend does not
 * audit their rejections either.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { getAuthUser, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { formatAuditDate, writeAudit, type DbClient } from '../lib/audit.js';
import {
  documentInclude,
  parseRolesRequeridos,
  serializeDocument,
  serializeRegulationAlert,
  serializeRevisiones,
  type DocumentWithRelations,
} from '../lib/serialize.js';
import { DocumentStatus, DoubleApproval } from '../lib/enums.js';
import {
  MERGE_RESOLUTION_TEXT,
  renderScanImportHtml,
  type ScanImportPayload,
} from '../lib/demoContent.js';

export const documentWorkflowRouter: Router = Router();

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/**
 * Roles allowed to reach the Editor at all. `Lector` is excluded because
 * `lectorRestrictedPages` (seed.ts) blocks it from the `edit` page and
 * `Editor.tsx` early-returns "Acceso restringido" for it. Enforced server-side
 * so a Lector cannot call these mutations directly.
 */
const EDITOR_ROLES = ['Administrador', 'Elaborador', 'Revisor', 'Aprobador'] as const;

/** Only these two may sign / approve / reject (`canDecide` in the frontend). */
const DECIDER_ROLES = ['Aprobador', 'Administrador'] as const;

const zCodeParams = z.object({ code: z.string().min(1) });

/** Loads a document with its signature/revision relations, or 404s. */
async function loadDocument(code: string, db: DbClient = prisma): Promise<DocumentWithRelations> {
  const doc = await db.document.findUnique({ where: { code }, include: documentInclude });
  if (!doc) throw HttpError.notFound(`Documento ${code} no encontrado.`);
  return doc;
}

/**
 * Reads the admin-editable org config fresh on every request — `doubleApproval`
 * can be changed from the Configuración screen at any time, so it must never be
 * cached in module scope. Falls back to the seeded default if the singleton row
 * is somehow missing.
 */
async function readDoubleApproval(db: DbClient = prisma): Promise<DoubleApproval> {
  const config = await db.orgConfig.findUnique({ where: { id: 1 } });
  return config?.doubleApproval ?? DoubleApproval.critical;
}

/**
 * The `doc.critico && state.config.doubleApproval === "critical"` predicate that
 * both `handleSign` and `handleApprove` branch on.
 */
function needsDoubleApproval(critico: boolean, doubleApproval: DoubleApproval): boolean {
  return critico && doubleApproval === DoubleApproval.critical;
}

/** Standard success envelope for every action in this router. */
function actionResponse(doc: DocumentWithRelations, message: string) {
  return { document: serializeDocument(doc), message };
}

/**
 * A signed Registro is frozen evidence (`contenidoBloqueado` in Editor.tsx:257,
 * recommendation #4 in CLAUDE.md). `PATCH /documents/:code` enforces this in
 * `src/routes/documents.ts`; every content-writing action here must agree, or
 * merge/scan-import/apply-regulation/restore would be a way around it.
 */
function assertContentWritable(doc: DocumentWithRelations): void {
  if (doc.nivel === 'Registro' && doc.signatures.length > 0) {
    throw HttpError.locked(
      `El documento ${doc.code} es un Registro firmado: su contenido queda protegido como evidencia.`,
    );
  }
}

// ---------------------------------------------------------------------------
// POST /documents/:code/sign   — Editor.tsx#handleSign
// ---------------------------------------------------------------------------

documentWorkflowRouter.post(
  '/:code/sign',
  requireAuth,
  // NOTE: deliberately NOT requireRole(...). The role gate lives in the handler
  // so the rejected attempt can be written to the audit log first.
  validate({ params: zCodeParams }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const user = getAuthUser(req);
    const doc = await loadDocument(code);

    // --- gate 1: role ------------------------------------------------------
    if (user.role !== 'Aprobador' && user.role !== 'Administrador') {
      await writeAudit(req, `Intento fallido de firma en ${code} por ${user.name} (Rol: ${user.role})`);
      throw HttpError.forbidden(
        'Acción bloqueada: Solo los roles de Aprobador o Administrador pueden firmar este documento.',
      );
    }

    // --- gate 2: the template's rolesRequeridos snapshot --------------------
    // Administrador always passes, matching the frontend's explicit carve-out.
    const rolesEsperados = parseRolesRequeridos(doc.rolesRequeridos);
    if (
      rolesEsperados &&
      user.role !== 'Administrador' &&
      user.role !== rolesEsperados.aprobador &&
      user.role !== rolesEsperados.revisor
    ) {
      await writeAudit(
        req,
        `Intento no autorizado de firma en ${code} por ${user.name} (Rol: ${user.role}, se esperaba ${rolesEsperados.aprobador})`,
      );
      throw HttpError.forbidden(
        `Este documento requiere firma de ${rolesEsperados.revisor} o ${rolesEsperados.aprobador}.`,
      );
    }

    // --- gate 3: can't sign twice ------------------------------------------
    // `DocumentSignature @@unique([documentCode, userId])` also enforces this,
    // but checking first yields a clean 409 instead of a raw P2002.
    if (doc.signatures.some((s) => s.userId === user.id)) {
      throw HttpError.conflict('Ya has firmado este documento.', { code, user: user.name });
    }

    const doubleApproval = await readDoubleApproval();
    const signatureCount = doc.signatures.length + 1;
    const critical = needsDoubleApproval(doc.critico, doubleApproval);
    const firstOfTwo = critical && signatureCount < 2;

    // The signature row and the resulting status change must not be able to
    // diverge, so both happen in one transaction together with the audit row.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.documentSignature.create({
        data: { documentCode: code, userId: user.id, userName: user.name },
      });

      // Faithful port: the "1/2" branch touches `estado` only; `vencido` is
      // reset exclusively by the branches that actually approve.
      const row = await tx.document.update({
        where: { code },
        data: firstOfTwo
          ? { estado: DocumentStatus.En_aprobación }
          : { estado: DocumentStatus.Aprobado, vencido: false },
        include: documentInclude,
      });

      const action = firstOfTwo
        ? `Añadió primera firma electrónica al documento crítico ${code}`
        : critical
          ? `Documento crítico ${code} aprobado con firmas completas`
          : `Firmó y aprobó el documento ${code}`;
      await writeAudit(req, action, { tx });

      return row;
    });

    const message = firstOfTwo
      ? 'Firma 1/2 agregada. Pendiente de co-firma de un segundo aprobador.'
      : critical
        ? 'Firma 2/2 agregada. El documento pasa a estado Vigente / Aprobado.'
        : 'Firma colocada. Documento aprobado de forma oficial.';

    res.status(200).json(actionResponse(updated, message));
  }),
);

// ---------------------------------------------------------------------------
// POST /documents/:code/approve   — ApprovalFlowDialog.tsx#handleApprove
// ---------------------------------------------------------------------------

const zApproveBody = z.object({
  /** Optional for approve (mandatory for reject). */
  comment: z.string().optional(),
});

documentWorkflowRouter.post(
  '/:code/approve',
  requireAuth,
  requireRole(...DECIDER_ROLES),
  validate({ params: zCodeParams, body: zApproveBody }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { comment } = req.body as z.infer<typeof zApproveBody>;
    const user = getAuthUser(req);
    const doc = await loadDocument(code);

    const trimmed = comment?.trim() ?? '';
    const alreadySigned = doc.signatures.some((s) => s.userId === user.id);
    const signatureCount = alreadySigned ? doc.signatures.length : doc.signatures.length + 1;
    const doubleApproval = await readDoubleApproval();
    const firstOfTwo = needsDoubleApproval(doc.critico, doubleApproval) && signatureCount < 2;

    const updated = await prisma.$transaction(async (tx) => {
      if (!alreadySigned) {
        await tx.documentSignature.create({
          data: { documentCode: code, userId: user.id, userName: user.name },
        });
      }

      // Faithful port: unlike `handleSign`, the "1/2" branch here does NOT move
      // `estado` — the dialog only opens on documents already "En aprobación".
      const row = firstOfTwo
        ? await tx.document.findUniqueOrThrow({ where: { code }, include: documentInclude })
        : await tx.document.update({
            where: { code },
            data: { estado: DocumentStatus.Aprobado, vencido: false },
            include: documentInclude,
          });

      await writeAudit(
        req,
        firstOfTwo
          ? `Añadió primera firma de aprobación al documento crítico ${code}`
          : `Aprobó y publicó el documento ${code}${trimmed ? `: "${trimmed}"` : ''}`,
        { tx },
      );

      return row;
    });

    const message = firstOfTwo
      ? `Firma 1/2 agregada a ${code}. Pendiente de co-firma de un segundo aprobador.`
      : `${code} aprobado y publicado — todos los usuarios notificados.`;

    res.status(200).json(actionResponse(updated, message));
  }),
);

// ---------------------------------------------------------------------------
// POST /documents/:code/reject   — ApprovalFlowDialog.tsx#handleReject
// ---------------------------------------------------------------------------

const zRejectBody = z.object({
  /**
   * MANDATORY and non-blank. `handleReject` refuses with
   * "El comentario es obligatorio para rechazar el documento."
   */
  comment: z.string().refine((v) => v.trim().length > 0, {
    message: 'El comentario es obligatorio para rechazar el documento.',
  }),
});

documentWorkflowRouter.post(
  '/:code/reject',
  requireAuth,
  requireRole(...DECIDER_ROLES),
  validate({ params: zCodeParams, body: zRejectBody }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { comment } = req.body as z.infer<typeof zRejectBody>;
    const trimmed = comment.trim();

    const doc = await loadDocument(code);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.document.update({
        where: { code },
        data: { estado: DocumentStatus.Rechazado },
        include: documentInclude,
      });
      await writeAudit(req, `Rechazó el documento ${code}: "${trimmed}"`, { tx });
      return row;
    });

    res.status(200).json(
      actionResponse(updated, `${code} rechazado — ${doc.creador} notificado con el motivo.`),
    );
  }),
);

// ---------------------------------------------------------------------------
// POST /documents/:code/versions   — Editor.tsx#handleSaveVersion
// ---------------------------------------------------------------------------

documentWorkflowRouter.post(
  '/:code/versions',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const user = getAuthUser(req);
    const doc = await loadDocument(code);

    const currentVer = parseFloat(doc.version.replace('v', ''));
    if (Number.isNaN(currentVer)) {
      throw HttpError.unprocessable(
        `La versión actual de ${code} ("${doc.version}") no es numérica; no se puede incrementar.`,
      );
    }
    const nextVer = `v${(currentVer + 0.1).toFixed(1)}`;
    const revisionEntry = `${doc.version} - Modificado el ${formatAuditDate(new Date())} por ${user.name}: ${doc.title}`;

    const updated = await prisma.$transaction(async (tx) => {
      // The join row is the "prepend": `serializeRevisiones` orders by id DESC,
      // so the newest insert lands at index 0 of the array the frontend sees.
      await tx.documentRevision.create({ data: { documentCode: code, text: revisionEntry } });
      const row = await tx.document.update({
        where: { code },
        data: { version: nextVer },
        include: documentInclude,
      });
      await writeAudit(req, `Creó la versión ${nextVer} del documento ${code}`, { tx });
      return row;
    });

    res
      .status(201)
      .json(actionResponse(updated, `Nueva versión ${nextVer} guardada con éxito.`));
  }),
);

// ---------------------------------------------------------------------------
// POST /documents/:code/versions/:index/restore   — Editor.tsx#handleRestoreVersion
// ---------------------------------------------------------------------------

const zRestoreParams = z.object({
  code: z.string().min(1),
  /** POSITIONAL index into the newest-first `revisiones` array the API returns. */
  index: z.coerce.number().int().min(0),
});

documentWorkflowRouter.post(
  '/:code/versions/:index/restore',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zRestoreParams }),
  asyncHandler(async (req, res) => {
    const { code, index } = req.params as unknown as z.infer<typeof zRestoreParams>;
    const doc = await loadDocument(code);
    assertContentWritable(doc);

    // Index into exactly what the client saw: `serializeRevisiones` output.
    const revisiones = serializeRevisiones(doc.revisiones);
    const revisionText = revisiones[index];
    if (revisionText === undefined) {
      throw HttpError.badRequest(
        `El documento ${code} no tiene una revisión en la posición ${index} (hay ${revisiones.length}).`,
      );
    }

    // Verbatim port, quirk included: seed revisions like
    // "v1.1: Ajustes en límites de humedad" contain no " - ", so `oldVer`
    // becomes the whole line. See NOTES.md § A4-5.
    const oldVer = revisionText.split(' - ')[0] ?? revisionText;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.document.update({
        where: { code },
        data: {
          content: `<p><em>[Versión Restaurada de ${oldVer}]</em></p>${doc.content}`,
          version: oldVer,
          // Content write → bump the optimistic-concurrency token.
          contentVersion: { increment: 1 },
        },
        include: documentInclude,
      });
      await writeAudit(req, `Restauró documento ${code} a la versión ${oldVer}`, { tx });
      return row;
    });

    res
      .status(200)
      .json(actionResponse(updated, `Versión ${oldVer} restaurada con éxito en el borrador.`));
  }),
);

// ---------------------------------------------------------------------------
// PATCH /documents/:code/section-lock   — Editor.tsx#handleToggleLock
// ---------------------------------------------------------------------------

const zSectionLockBody = z.object({
  /** Absolute target. Omit to toggle, which is what the Editor button does. */
  locked: z.boolean().optional(),
});

documentWorkflowRouter.patch(
  '/:code/section-lock',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zSectionLockBody }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { locked } = req.body as z.infer<typeof zSectionLockBody>;
    const user = getAuthUser(req);
    const doc = await loadDocument(code);

    // `activeUser === doc.creador || activeRole === "Administrador"`, compared
    // against the denormalized creator NAME exactly like the frontend does.
    const isOwner = user.name === doc.creador || user.role === 'Administrador';
    if (!isOwner) {
      // Additive: the frontend only toasts here. Logged because the spec asks
      // every branch of a gated action to leave a trail. See NOTES.md § A4-6.
      await writeAudit(
        req,
        `Intento no autorizado de cambiar el bloqueo de sección en ${code} por ${user.name} (Rol: ${user.role})`,
      );
      throw HttpError.forbidden(
        'Solo el dueño o creador del documento puede modificar las restricciones de bloqueo.',
      );
    }

    const next = locked ?? !doc.sectionLocked;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.document.update({
        where: { code },
        data: { sectionLocked: next },
        include: documentInclude,
      });
      await writeAudit(
        req,
        next
          ? `Bloqueó la sección crítica del documento ${code}`
          : `Desbloqueó la sección crítica del documento ${code}`,
        { tx },
      );
      return row;
    });

    res
      .status(200)
      .json(
        actionResponse(
          updated,
          next ? 'Sección crítica bloqueada para no-propietarios.' : 'Sección desbloqueada.',
        ),
      );
  }),
);

// ---------------------------------------------------------------------------
// POST /documents/:code/merge   — the resolution half of optimistic concurrency
// ---------------------------------------------------------------------------

/**
 * `PATCH /documents/:code` (src/routes/documents.ts) rejects a stale
 * `contentVersion` with:
 *
 *   409 { error: { code: 'CONTENT_VERSION_CONFLICT', details: {
 *          code, clientContentVersion, serverContentVersion,
 *          clientContent, serverContent, serverUpdatedAt } } }
 *
 * MergeDialog shows both sides; this endpoint commits whatever the user
 * resolved to. The conflict body below is deliberately IDENTICAL, so one client
 * handler covers both the initial 409 and a re-conflict during resolution.
 */
const zMergeBody = z
  .object({
    /**
     * The fully resolved content. Omit it to reproduce the old fake flow
     * exactly: server content + `MERGE_RESOLUTION_TEXT` appended.
     */
    content: z.string().optional(),
    /**
     * The server `contentVersion` the resolution was made against — i.e.
     * `details.serverContentVersion` from the 409. Same field name `PATCH
     * /documents/:code` uses. `baseVersion` is accepted as a tolerant alias.
     */
    contentVersion: z.number().int().min(0).optional(),
    baseVersion: z.number().int().min(0).optional(),
    /** Append `MERGE_RESOLUTION_TEXT` on top of `content`. */
    appendResolutionText: z.boolean().optional(),
  })
  .refine((b) => b.contentVersion !== undefined || b.baseVersion !== undefined, {
    message: 'Se requiere `contentVersion` (la versión del servidor contra la que se resolvió).',
  });

documentWorkflowRouter.post(
  '/:code/merge',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zMergeBody }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const body = req.body as z.infer<typeof zMergeBody>;
    const base = (body.contentVersion ?? body.baseVersion) as number;
    const doc = await loadDocument(code);
    assertContentWritable(doc);

    // Someone committed yet another write between the 409 and this call, so the
    // resolution is itself stale. Same error shape as PATCH, so the client can
    // just re-open MergeDialog with the fresher server content.
    if (doc.contentVersion !== base) {
      throw new HttpError(
        409,
        `El documento ${code} cambió de nuevo mientras resolvías la fusión.`,
        {
          code: 'CONTENT_VERSION_CONFLICT',
          details: {
            code,
            clientContentVersion: base,
            serverContentVersion: doc.contentVersion,
            clientContent: body.content ?? null,
            serverContent: doc.content,
            serverUpdatedAt: doc.updatedAt.toISOString(),
          },
        },
      );
    }

    const resolved = body.content ?? doc.content;
    const nextContent =
      body.content === undefined || body.appendResolutionText
        ? resolved + MERGE_RESOLUTION_TEXT
        : resolved;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.document.update({
        where: { code },
        data: { content: nextContent, contentVersion: { increment: 1 } },
        include: documentInclude,
      });
      await writeAudit(req, `Consolidó cambios concurrentes en documento ${code}`, { tx });
      return row;
    });

    res
      .status(200)
      .json(actionResponse(updated, 'Cambios fusionados e integrados al borrador.'));
  }),
);

// ---------------------------------------------------------------------------
// POST /documents/:code/scan-import   — ScannerDialog, made real (no OCR)
// ---------------------------------------------------------------------------

const zScanImportBody = z.object({
  inspector: z.string().min(1),
  resultado: z.string().min(1),
  codigoRegistro: z.string().optional(),
  /** "YYYY-MM-DD". Defaults to today inside `renderScanImportHtml`. */
  fechaInspeccion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato YYYY-MM-DD.')
    .optional(),
});

documentWorkflowRouter.post(
  '/:code/scan-import',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zScanImportBody }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const payload = req.body as ScanImportPayload;
    const user = getAuthUser(req);
    const doc = await loadDocument(code);
    assertContentWritable(doc);

    // Values are HTML-escaped inside renderScanImportHtml before being spliced
    // into the document's rich-text content.
    const html = renderScanImportHtml(payload);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.scanImport.create({
        data: {
          documentCode: code,
          // Zod already narrowed this to the ScanImportPayload shape; the cast
          // only satisfies Prisma's structural `InputJsonObject` index signature.
          payload: payload as unknown as Prisma.InputJsonObject,
          createdBy: user.name,
        },
      });
      const row = await tx.document.update({
        where: { code },
        data: { content: doc.content + html, contentVersion: { increment: 1 } },
        include: documentInclude,
      });
      await writeAudit(req, `Escaneó formato físico e importó datos al editor en ${code}`, { tx });
      return row;
    });

    res.status(201).json(actionResponse(updated, 'Escaneo completado. Datos importados.'));
  }),
);

// ---------------------------------------------------------------------------
// Regulation alerts, per document
// ---------------------------------------------------------------------------

/**
 * The active alert that applies to a document: same `norma`, `active`, and the
 * document's content does not already contain the alert's `marker`. This is the
 * exact banner predicate from Editor.tsx / RegulationBanner.tsx, only
 * data-driven instead of reading `NORMA_CON_CAMBIO_PENDIENTE`.
 */
async function findApplicableAlert(doc: DocumentWithRelations, db: DbClient = prisma) {
  const alerts = await db.regulationAlert.findMany({
    where: { norma: doc.norma, active: true },
    orderBy: { id: 'desc' },
  });
  return alerts.find((a) => !doc.content.includes(a.marker)) ?? null;
}

/** GET /documents/:code/regulation-alert → `{ alert: RegulationAlertDTO | null }`. */
documentWorkflowRouter.get(
  '/:code/regulation-alert',
  requireAuth,
  validate({ params: zCodeParams }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const doc = await loadDocument(code);
    const alert = await findApplicableAlert(doc);
    res.status(200).json({ alert: alert ? serializeRegulationAlert(alert) : null });
  }),
);

/** POST /documents/:code/apply-regulation — appends the alert's `bodyHtml`. */
documentWorkflowRouter.post(
  '/:code/apply-regulation',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams }),
  asyncHandler(async (req, res) => {
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const doc = await loadDocument(code);
    assertContentWritable(doc);

    const anyForNorma = await prisma.regulationAlert.findFirst({
      where: { norma: doc.norma, active: true },
      orderBy: { id: 'desc' },
    });
    if (!anyForNorma) {
      throw HttpError.notFound(
        `No hay una actualización regulatoria activa para ${doc.norma}.`,
      );
    }

    const alert = await findApplicableAlert(doc);
    if (!alert) {
      // The marker is already in the content — appending again would duplicate
      // the block and the banner is already hidden client-side.
      throw HttpError.conflict(
        `El documento ${code} ya tiene aplicada la actualización regulatoria de ${doc.norma}.`,
        { code: 'ALREADY_APPLIED' },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.document.update({
        where: { code },
        data: { content: doc.content + alert.bodyHtml, contentVersion: { increment: 1 } },
        include: documentInclude,
      });
      await writeAudit(
        req,
        `Aplicó la actualización regulatoria de ${alert.norma} en el documento ${code}`,
        { tx },
      );
      return row;
    });

    res.status(200).json({
      ...actionResponse(updated, `Cambios regulatorios de ${alert.norma} aplicados al borrador.`),
      alert: serializeRegulationAlert(alert),
    });
  }),
);
