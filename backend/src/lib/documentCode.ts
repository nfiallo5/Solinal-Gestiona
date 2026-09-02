/**
 * Document control-code generation — server-side port of `nextDocumentCode()`
 * from `src/features/documents/docStyles.ts`.
 *
 * A code is built by joining the segments configured on the `CodingRule`
 * singleton (Control Documental's "Regla de codificación" card, "Tipos y
 * codificación" tab) — by default `TIPO-AREA-NNN`, e.g. `"PRO-CAL-009"`, but
 * an Administrador can reorder/add/remove segments (SIGLA, TIPO, PROCESO,
 * CORRELATIVO, ANIO, VERSION), change the separator, the correlativo's
 * digit width, the version prefix and the year format. See `CODING_TOKENS`
 * below and `routes/codingRule.ts`.
 *
 * The frontend derived this from its in-memory document list; the spec says
 * to preserve the rule but compute it on the server, so the client can no
 * longer supply an arbitrary `code`.
 */
import { DocumentType, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { HttpError } from '../middleware/error.js';

/** Verbatim from docStyles.ts. */
export const documentTypeAbbr: Record<DocumentType, string> = {
  Procedimiento: 'PRO',
  Política: 'POL',
  Manual: 'MAN',
  Instructivo: 'INS',
  Checklist: 'CHK',
};

export interface DocumentArea {
  code: string;
  label: string;
}

/** Fallback list of the 9 processes/areas Control Documental ships with —
 * mirrors `PROCESOS_INI` in ControlDocumental.jsx and the `ProcessArea`
 * migration seed. The live list is the `ProcessArea` table; this is only a
 * default for `areaFromCode` and for tests that don't hit the DB. */
export const documentAreas: DocumentArea[] = [
  { code: 'GER', label: 'Gerencia y estrategia' },
  { code: 'CAL', label: 'Aseguramiento de la calidad' },
  { code: 'PRD', label: 'Producción' },
  { code: 'MTO', label: 'Mantenimiento y metrología' },
  { code: 'RHU', label: 'Talento humano' },
  { code: 'LOG', label: 'Logística y almacenamiento' },
  { code: 'COM', label: 'Compras y comercial' },
  { code: 'IDD', label: 'Investigación y desarrollo' },
  { code: 'SSA', label: 'Seguridad, salud y ambiente' },
];

export const documentAreaCodes = documentAreas.map((a) => a.code) as [string, ...string[]];

/**
 * zod schema for the `area` field of `POST /documents`.
 *
 * No longer a fixed `z.enum` — the area catalog is the `ProcessArea` table
 * now, editable from Control Documental. This only normalises the shape
 * (uppercase, length); the route checks the value actually exists in the
 * catalog via `assertAreaExists`.
 */
export const zAreaCode = z
  .string()
  .trim()
  .min(1, 'El área es obligatoria.')
  .max(10)
  .transform((s) => s.toUpperCase());

/** Throws `400` if `sigla` is not a row in the `ProcessArea` catalog. */
export async function assertAreaExists(
  sigla: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const row = await client.processArea.findUnique({ where: { sigla } });
  if (!row) {
    const known = await client.processArea.findMany({
      select: { sigla: true },
      orderBy: { orden: 'asc' },
    });
    throw new HttpError(
      400,
      `El área "${sigla}" no está en el catálogo de procesos y áreas. ` +
        `Opciones válidas: ${known.map((r) => r.sigla).join(', ')}.`,
      { code: 'BAD_REQUEST' },
    );
  }
}

/** Middle segment of a TIPO-AREA-NNN code -> its area, for display.
 * NOTE: this assumes the default segment order/separator. A rule that
 * moves PROCESO out of position 1 (e.g. drops the separator, or puts
 * PROCESO first) makes this heuristic unreliable for codes generated under
 * that rule — `Document` has no separate `area` column, the code is the
 * only place it's recorded. Out of scope here; flagged for a follow-up. */
export function areaFromCode(code: string): DocumentArea | undefined {
  const areaCode = code.split('-')[1];
  return documentAreas.find((a) => a.code === areaCode);
}

// ---------------------------------------------------------------------------
// Coding rule — the configurable segment engine
// ---------------------------------------------------------------------------

/** The 6 segment kinds the "Regla de codificación" builder can combine. */
export const CODING_TOKENS = ['SIGLA', 'TIPO', 'PROCESO', 'CORRELATIVO', 'ANIO', 'VERSION'] as const;
export type CodingToken = (typeof CODING_TOKENS)[number];

export const CODING_SEPARATORS = ['-', '.', ':', '_', 'ninguno'] as const;
export type CodingSeparator = (typeof CODING_SEPARATORS)[number];

export const CODING_VERSION_PREFIXES = ['V', 'R', 'Rev.', ''] as const;
export const CODING_YEAR_FORMATS = ['26', '2026'] as const;

/** Plain-data shape of the `CodingRule` singleton — same fields as the
 * Prisma model, kept as its own interface so the pure functions below don't
 * need `@prisma/client`'s generated type. */
export interface CodingRuleShape {
  tokens: string[];
  separador: string;
  digitos: number;
  prefijoVer: string;
  formatoAnio: string;
  empresaSigla: string;
}

/** Matches today's actual TIPO-AREA-NNN codes exactly — used only if the
 * `CodingRule` row is somehow missing (fresh DB before seeding). */
export const DEFAULT_CODING_RULE: CodingRuleShape = {
  tokens: ['TIPO', 'PROCESO', 'CORRELATIVO'],
  separador: '-',
  digitos: 3,
  prefijoVer: 'V',
  formatoAnio: '26',
  empresaSigla: 'SOL',
};

/** Loads the singleton `CodingRule` row, falling back to `DEFAULT_CODING_RULE`
 * so document creation never breaks even if the row hasn't been seeded yet. */
export async function loadCodingRule(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CodingRuleShape> {
  const row = await client.codingRule.findUnique({ where: { id: 1 } });
  return row ?? DEFAULT_CODING_RULE;
}

interface TokenContext {
  type: DocumentType;
  areaCode: string;
  year: number;
}

function tokenValue(token: string, rule: CodingRuleShape, ctx: TokenContext): string {
  switch (token) {
    case 'SIGLA':
      return rule.empresaSigla;
    case 'TIPO':
      return documentTypeAbbr[ctx.type];
    case 'PROCESO':
      return ctx.areaCode;
    case 'ANIO':
      return rule.formatoAnio === '2026' ? String(ctx.year) : String(ctx.year).slice(-2);
    case 'VERSION':
      // A newly created document always starts at version 1.
      return `${rule.prefijoVer}01`;
    default:
      return '';
  }
}

/** Placeholder swapped in for CORRELATIVO while templating, then located by
 * `indexOf` to split the templated string into its fixed prefix/suffix — a
 * single non-printable char, so it can't collide with a real segment value. */
const CORRELATIVO_MARK = '\u0000';

/** Every other token's value is fixed for a given (type, area, year); only
 * CORRELATIVO varies per document. Splitting the templated code around it
 * gives the fixed prefix/suffix to search existing codes against, robust to
 * wherever CORRELATIVO sits in the rule and whatever the separator is. */
function splitAroundCorrelativo(
  rule: CodingRuleShape,
  ctx: TokenContext,
): { prefix: string; suffix: string } {
  const sep = rule.separador === 'ninguno' ? '' : rule.separador;
  const templated = rule.tokens
    .map((t) => (t === 'CORRELATIVO' ? CORRELATIVO_MARK : tokenValue(t, rule, ctx)))
    .join(sep);
  const idx = templated.indexOf(CORRELATIVO_MARK);
  if (idx === -1) {
    // No CORRELATIVO token — the route's zod schema forbids saving a rule
    // like this, but stay correct if it ever happens (e.g. DEFAULT_CODING_RULE
    // misconfigured): treat the whole thing as a fixed prefix.
    return { prefix: templated, suffix: '' };
  }
  return { prefix: templated.slice(0, idx), suffix: templated.slice(idx + 1) };
}

/** Build the code for a specific correlativo number — used both to produce
 * the final code and (with existingCodes) to find the next free one. */
export function buildDocumentCode(
  rule: CodingRuleShape,
  type: DocumentType,
  areaCode: string,
  correlativo: number,
  year: number = new Date().getFullYear(),
): string {
  const { prefix, suffix } = splitAroundCorrelativo(rule, { type, areaCode, year });
  return `${prefix}${String(correlativo).padStart(rule.digitos, '0')}${suffix}`;
}

/**
 * Pure form — identical arithmetic to the frontend's `nextDocumentCode`, but
 * taking the existing codes as a plain array so it is trivially testable.
 */
export function nextDocumentCodeFrom(
  rule: CodingRuleShape,
  type: DocumentType,
  areaCode: string,
  existingCodes: readonly string[],
  year: number = new Date().getFullYear(),
): string {
  const { prefix, suffix } = splitAroundCorrelativo(rule, { type, areaCode, year });
  let max = 0;
  for (const code of existingCodes) {
    if (code.length < prefix.length + suffix.length) continue;
    if (!code.startsWith(prefix) || !code.endsWith(suffix)) continue;
    const numPart = code.slice(prefix.length, code.length - suffix.length);
    const n = Number.parseInt(numPart, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return buildDocumentCode(rule, type, areaCode, max + 1, year);
}

/** `"PRO-CAL-"` for (Procedimiento, "CAL") under the default rule — kept for
 * anything still assuming the classic 3-segment shape (none left in this
 * file; retained as a small, testable convenience). */
export function documentCodePrefix(type: DocumentType, areaCode: string): string {
  return `${documentTypeAbbr[type]}-${areaCode}-`;
}

/**
 * DB-backed form, for `POST /documents`.
 *
 * NOTE ON RACES: two simultaneous creates can compute the same code. `code` is
 * the primary key, so the loser's insert fails with Prisma `P2002`, which the
 * central error handler already turns into a 409. Wrap the create in
 * `createWithGeneratedCode()` below to retry transparently instead.
 */
export async function nextDocumentCode(
  type: DocumentType,
  areaCode: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const rule = await loadCodingRule(client);
  const year = new Date().getFullYear();
  const { prefix, suffix } = splitAroundCorrelativo(rule, { type, areaCode, year });
  // `startsWith` narrows the scan in the common case; when a rule puts
  // CORRELATIVO first (empty prefix) this just fetches every code, which is
  // fine at this app's scale — correctness over the query being tight.
  const rows = await client.document.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  const codes = suffix ? rows.map((r) => r.code).filter((c) => c.endsWith(suffix)) : rows.map((r) => r.code);
  return nextDocumentCodeFrom(rule, type, areaCode, codes, year);
}

/**
 * Generate a code and run `create` with it, retrying on a unique-code
 * collision. `create` receives the freshly generated code.
 *
 * @example
 *   const doc = await createWithGeneratedCode(type, area, (code) =>
 *     prisma.document.create({ data: { code, ...rest } }),
 *   );
 */
export async function createWithGeneratedCode<T>(
  type: DocumentType,
  areaCode: string,
  create: (code: string) => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const code = await nextDocumentCode(type, areaCode);
    try {
      return await create(code);
    } catch (err) {
      lastError = err;
      const prismaCode = (err as { code?: string } | null)?.code;
      if (prismaCode !== 'P2002') throw err;
    }
  }
  throw lastError;
}
