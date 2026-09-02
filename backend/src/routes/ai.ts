/**
 * Real Claude-backed document-editing assistance — `/documents/:code/ai/*`.
 *
 * Scope, deliberately narrow (per the feature request): Claude here only
 * helps with THIS document, under ITS norma/tipo/cláusula. It never mutates
 * the document itself — every route is a pure "ask Claude, return text/JSON"
 * call. Insertion into the document goes through the SAME paths the rest of
 * the editor already uses:
 *   - draft / chat suggestion → frontend calls `appendContent()`, which is
 *     just a normal `PATCH /documents/:code` (see Editor.tsx#appendContent).
 *   - improve-selection → frontend replaces the live selection via
 *     `execCommand('insertHTML', …)`, which fires the editor's own `input`
 *     handler → the existing autosave PATCH loop.
 * That reuse is why NONE of these routes need `assertContentWritable` or a
 * `prisma.$transaction` — a locked/signed Registro is still protected,
 * because the eventual PATCH the frontend makes already 423s (see
 * documentWorkflow.ts's `assertContentWritable` and documents.ts's PATCH
 * handler); this file would just waste a Claude call before hitting that,
 * which is an acceptable v1 tradeoff over duplicating the lock check here.
 *
 * Mounted at `/documents` in app.ts, same prefix as documentWorkflowRouter,
 * for the same reason: these are `/documents/:code/...` action routes.
 */
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeAudit } from '../lib/audit.js';
import { documentInclude, type DocumentWithRelations } from '../lib/serialize.js';
import { askClaude, isClaudeConfigured, stripFences } from '../lib/claude.js';

export const aiRouter: Router = Router();

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** Same roles allowed to reach the Editor at all — mirrors
 * documentWorkflow.ts's EDITOR_ROLES (kept local; see that file's comment
 * for why Lector is excluded). */
const EDITOR_ROLES = ['Administrador', 'Elaborador', 'Revisor', 'Aprobador'] as const;

const zCodeParams = z.object({ code: z.string().min(1) });

async function loadDocument(code: string): Promise<DocumentWithRelations> {
  const doc = await prisma.document.findUnique({ where: { code }, include: documentInclude });
  if (!doc) throw HttpError.notFound(`Documento ${code} no encontrado.`);
  return doc;
}

function requireClaudeConfigured(): void {
  if (!isClaudeConfigured()) {
    throw new HttpError(
      503,
      'El asistente de IA no está configurado en este servidor (falta ANTHROPIC_API_KEY).',
      { code: 'AI_NOT_CONFIGURED' },
    );
  }
}

/** Wraps a Claude call so any SDK/network failure surfaces as a clean 502
 * instead of a raw 500 with an Anthropic stack trace. */
async function callClaude(...args: Parameters<typeof askClaude>): Promise<string> {
  try {
    return await askClaude(...args);
  } catch (cause) {
    // eslint-disable-next-line no-console
    console.error('[ai] Claude call failed:', cause);
    throw new HttpError(502, 'El asistente de IA no respondió correctamente. Intenta de nuevo.', {
      code: 'AI_UPSTREAM_ERROR',
      cause,
    });
  }
}

const SYSTEM_PREAMBLE =
  'Eres el asistente de redacción de Solinal Gestiona, un sistema de gestión documental ' +
  'ISO 9001 / 14001 / 22000 para Solinal S.A., una planta de producción de papas fritas. ' +
  'Tu único ámbito es ayudar a redactar y revisar EL DOCUMENTO ACTIVO y su cumplimiento con ' +
  'la normativa que ese documento declara. No respondas preguntas ajenas a este documento, ' +
  'a la norma ISO aplicable, o a la gestión documental en general — redirige amablemente en ' +
  'ese caso. Responde siempre en español.';

function docContext(doc: DocumentWithRelations, clausulaIso?: string): string {
  return (
    `Documento: "${doc.title}" (código ${doc.code}).\n` +
    `Tipo: ${doc.type}. Norma: ${doc.norma}.` +
    (clausulaIso ? ` Cláusula ISO indicada: ${clausulaIso}.` : '')
  );
}

// ---------------------------------------------------------------------------
// POST /:code/ai/draft — generar documento base por normativa
// ---------------------------------------------------------------------------

const zDraftBody = z.object({ clausulaIso: z.string().trim().max(40).optional() });

aiRouter.post(
  '/:code/ai/draft',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zDraftBody }),
  asyncHandler(async (req, res) => {
    requireClaudeConfigured();
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { clausulaIso } = req.body as z.infer<typeof zDraftBody>;
    const doc = await loadDocument(code);

    const system =
      `${SYSTEM_PREAMBLE}\n\n` +
      'Tarea: redactar el CUERPO de un documento nuevo (o completar uno vacío). Responde ' +
      'ÚNICAMENTE con HTML del cuerpo — usa <h2>, <p>, <ul>/<ol>, <li>, <strong>. NO incluyas ' +
      '<html>/<head>/<body>, NO uses bloques de código markdown (```), NO agregues texto fuera ' +
      'del HTML. Estructura el contenido con las secciones típicas de un documento de este tipo ' +
      'bajo la norma indicada (p. ej. Objetivo, Alcance, Responsabilidades, Desarrollo, Registros, ' +
      'Control de cambios — adapta según el tipo).';

    const html = stripFences(
      await callClaude(system, [
        {
          role: 'user',
          content: `${docContext(doc, clausulaIso)}\n\nRedacta el borrador base de este documento.`,
        },
      ]),
    );

    await writeAudit(
      req,
      `Generó un borrador con IA para el documento ${code} (${doc.type}, ${doc.norma})`,
    );

    res.status(200).json({ html });
  }),
);

// ---------------------------------------------------------------------------
// POST /:code/ai/compliance — análisis de cumplimiento normativo
// ---------------------------------------------------------------------------

const zComplianceBody = z.object({ clausulaIso: z.string().trim().max(40).optional() });

const zFindings = z.object({
  findings: z
    .array(
      z.object({
        severity: z.enum(['gap', 'weak', 'ok']),
        title: z.string().min(1),
        detail: z.string().min(1),
      }),
    )
    .max(12),
});

aiRouter.post(
  '/:code/ai/compliance',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zComplianceBody }),
  asyncHandler(async (req, res) => {
    requireClaudeConfigured();
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { clausulaIso } = req.body as z.infer<typeof zComplianceBody>;
    const doc = await loadDocument(code);

    const system =
      `${SYSTEM_PREAMBLE}\n\n` +
      'Tarea: auditar el contenido HTML de este documento contra su norma (y cláusula, si se ' +
      'indica) y señalar brechas de cumplimiento. Responde ÚNICAMENTE con JSON válido (sin ' +
      'bloques de código markdown, sin texto fuera del JSON) con esta forma exacta:\n' +
      '{"findings":[{"severity":"gap"|"weak"|"ok","title":string,"detail":string}]}\n' +
      '"gap" = requisito ausente. "weak" = presente pero insuficiente/ambiguo. "ok" = cumplido ' +
      'correctamente. Máximo 8 hallazgos, los más importantes primero.';

    const raw = await callClaude(system, [
      {
        role: 'user',
        content: `${docContext(doc, clausulaIso)}\n\nContenido HTML actual:\n${doc.content || '(vacío)'}`,
      },
    ]);

    let parsed: z.infer<typeof zFindings>;
    try {
      parsed = zFindings.parse(JSON.parse(stripFences(raw)));
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.error('[ai] compliance: unparsable response:', raw);
      throw new HttpError(502, 'El asistente de IA devolvió una respuesta inesperada. Intenta de nuevo.', {
        code: 'AI_UPSTREAM_ERROR',
        cause,
      });
    }

    await writeAudit(req, `Ejecutó análisis de cumplimiento IA sobre el documento ${code}`);

    res.status(200).json(parsed);
  }),
);

// ---------------------------------------------------------------------------
// POST /:code/ai/improve — mejorar redacción del texto seleccionado
// ---------------------------------------------------------------------------

const zImproveBody = z.object({
  selectionHtml: z.string().min(1, 'Selecciona texto en el documento primero.').max(20000),
});

aiRouter.post(
  '/:code/ai/improve',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zImproveBody }),
  asyncHandler(async (req, res) => {
    requireClaudeConfigured();
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { selectionHtml } = req.body as z.infer<typeof zImproveBody>;
    const doc = await loadDocument(code);

    const system =
      `${SYSTEM_PREAMBLE}\n\n` +
      'Tarea: mejorar un FRAGMENTO HTML seleccionado por el usuario dentro de este documento — ' +
      'más claro, más preciso, terminología adecuada a la norma indicada. Conserva el mismo tipo ' +
      'de etiquetas cuando sea razonable (si te dan un <p>, responde con <p>; si es una lista, ' +
      'conserva la lista). Responde ÚNICAMENTE con el HTML de reemplazo, sin explicaciones ni ' +
      'bloques de código markdown.';

    const html = stripFences(
      await callClaude(system, [
        {
          role: 'user',
          content: `${docContext(doc)}\n\nMejora este fragmento:\n${selectionHtml}`,
        },
      ]),
    );

    await writeAudit(req, `Mejoró un fragmento del documento ${code} con IA`);

    res.status(200).json({ html });
  }),
);

// ---------------------------------------------------------------------------
// POST /:code/ai/chat — chat acotado al documento/norma activos
// ---------------------------------------------------------------------------

const zChatBody = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1) }))
    .max(30)
    .default([]),
  question: z.string().min(1, 'Escribe una pregunta.').max(4000),
});

const zChatReply = z.object({
  answer: z.string().min(1),
  suggestionHtml: z.string().nullable().default(null),
});

aiRouter.post(
  '/:code/ai/chat',
  requireAuth,
  requireRole(...EDITOR_ROLES),
  validate({ params: zCodeParams, body: zChatBody }),
  asyncHandler(async (req, res) => {
    requireClaudeConfigured();
    const { code } = req.params as z.infer<typeof zCodeParams>;
    const { messages, question } = req.body as z.infer<typeof zChatBody>;
    const doc = await loadDocument(code);

    const system =
      `${SYSTEM_PREAMBLE}\n\n${docContext(doc)}\n\n` +
      'Responde la pregunta del usuario sobre este documento/norma. Tono profesional y conciso ' +
      '(máx. ~120 palabras). Si tu respuesta incluye texto que el usuario podría insertar en el ' +
      'documento, ponlo en "suggestionHtml" como HTML (<p>, <ul>, <strong>, etc.); si no aplica, ' +
      'usa null. Responde ÚNICAMENTE con JSON válido (sin bloques de código markdown) con esta ' +
      'forma exacta: {"answer": string, "suggestionHtml": string | null}.';

    const raw = await callClaude(system, [
      ...messages.map((m) => ({ role: m.role, content: m.text })),
      { role: 'user' as const, content: question },
    ]);

    let parsed: z.infer<typeof zChatReply>;
    try {
      parsed = zChatReply.parse(JSON.parse(stripFences(raw)));
    } catch (cause) {
      // eslint-disable-next-line no-console
      console.error('[ai] chat: unparsable response:', raw);
      throw new HttpError(502, 'El asistente de IA devolvió una respuesta inesperada. Intenta de nuevo.', {
        code: 'AI_UPSTREAM_ERROR',
        cause,
      });
    }

    await writeAudit(req, `Consultó al asistente IA sobre el documento ${code}`);

    res.status(200).json(parsed);
  }),
);
