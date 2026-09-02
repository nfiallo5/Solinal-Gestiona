/**
 * Presentation helpers for the Documentos table: document-type "tag" badges
 * and estado/vencido "status" badges.
 *
 * DOCUMENT TYPE -> TAG COLOR MAPPING
 * ----------------------------------
 * DESIGN_SYSTEM.md ties document-type badges to the Lovable "tag" palette,
 * which only defines 4 hues (sanitary / permit / lab / technical) while the
 * legacy app has 5 document types (Procedimiento, Política, Instructivo,
 * Manual, Checklist). Mapping chosen (documented per DESIGN_SYSTEM.md
 * section 8 reporting requirement):
 *
 *   Procedimiento -> technical (blue)   - core operational/process document
 *   Política      -> permit    (amber)  - top-level authorization/mandate,
 *                                         same "grants authority" semantics
 *                                         as a permit
 *   Manual        -> lab       (purple) - consolidated reference document,
 *                                         analogous to a lab report bundle
 *   Instructivo   -> sanitary  (red)    - in this dataset, instructivos are
 *                                         hygiene/CIP cleaning docs, i.e.
 *                                         sanitary-flavored content
 *   Checklist     -> NEW "checklist" tag (teal, hue 195) - no existing
 *                    Lovable tag fits a verification/audit-style document,
 *                    so a 5th tag hue was added following the same
 *                    oklch(<lightness> <chroma> <hue>) pattern as the other
 *                    4 tag tokens. Promoted in Phase 2 (integration-qa) from
 *                    a feature-local arbitrary Tailwind value into a proper
 *                    `--tag-checklist` / `--tag-checklist-bg` token pair in
 *                    src/styles.css, for consistency with the other 4.
 */
import type { DocumentStatus, DocumentType, SolinalDocument, TemplateLevel } from "@/data/seed";
import type { CodingRuleDTO } from "@/lib/api";

/** Un Registro (ej. un Checklist ya firmado) es evidencia congelada: una
 * vez firmado no debería poder editarse. Se deriva de `nivel` en vez de
 * agregar un booleano redundante — ver ContentEditor.tsx / Editor.tsx. */
export function esRegistroPorNivel(nivel: TemplateLevel | undefined): boolean {
  return nivel === "Registro";
}

export const docTypeBadgeClass: Record<DocumentType, string> = {
  Procedimiento: "border-tag-technical/40 bg-tag-technical-bg text-tag-technical",
  Política: "border-tag-permit/40 bg-tag-permit-bg text-tag-permit",
  Manual: "border-tag-lab/40 bg-tag-lab-bg text-tag-lab",
  Instructivo: "border-tag-sanitary/40 bg-tag-sanitary-bg text-tag-sanitary",
  Checklist: "border-tag-checklist/40 bg-tag-checklist-bg text-tag-checklist",
};

/** Estado (+ vencido override) -> status badge classes, using the shared
 * status-valid / status-warning / status-danger tokens from styles.css. */
export function statusBadgeClass(estado: DocumentStatus, vencido: boolean): string {
  if (vencido) return "border-status-danger/30 bg-status-danger/10 text-status-danger";
  switch (estado) {
    case "Aprobado":
      return "border-status-valid/30 bg-status-valid/10 text-status-valid";
    case "En aprobación":
      return "border-status-warning/40 bg-status-warning/15 text-status-warning";
    case "Rechazado":
      return "border-status-danger/30 bg-status-danger/10 text-status-danger";
    case "Borrador":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function statusLabel(estado: DocumentStatus, vencido: boolean): string {
  return vencido ? "Vencido" : estado;
}

export const normaOptions = ["ISO 9001:2015", "ISO 14001:2015", "ISO 22000:2018"] as const;

export const documentTypeOptions: DocumentType[] = [
  "Procedimiento",
  "Política",
  "Instructivo",
  "Manual",
  "Checklist",
];

/**
 * Document codes are not arbitrary names — each is
 * `TIPO-AREA-NNN` (e.g. "PRO-CAL-009" = Procedimiento, área Calidad, #009),
 * per SolinalGestiona_MVP.html's legacy DOCS table. TIPO is derived from
 * the document type below; AREA is chosen at creation time from
 * `documentAreas`; NNN is the next sequential number for that exact
 * TIPO-AREA pair (see nextDocumentCode).
 */
export const documentTypeAbbr: Record<DocumentType, string> = {
  Procedimiento: "PRO",
  Política: "POL",
  Manual: "MAN",
  Instructivo: "INS",
  Checklist: "CHK",
};

export interface DocumentArea {
  code: string;
  label: string;
}

/**
 * Fallback list of the 9 processes/areas Control Documental ships with —
 * mirrors `PROCESOS_INI` in ControlDocumental.jsx and the backend
 * `ProcessArea` seed. The live list comes from the `ProcessArea` table via
 * `useProcessAreas()`; this is only what a dropdown shows before that query
 * resolves. */
export const documentAreas: DocumentArea[] = [
  { code: "GER", label: "Gerencia y estrategia" },
  { code: "CAL", label: "Aseguramiento de la calidad" },
  { code: "PRD", label: "Producción" },
  { code: "MTO", label: "Mantenimiento y metrología" },
  { code: "RHU", label: "Talento humano" },
  { code: "LOG", label: "Logística y almacenamiento" },
  { code: "COM", label: "Compras y comercial" },
  { code: "IDD", label: "Investigación y desarrollo" },
  { code: "SSA", label: "Seguridad, salud y ambiente" },
];

/** Middle segment of a document code -> its area, for display purposes
 * (the code itself stays the single source of truth, nothing duplicates it
 * on the document record). */
export function areaFromCode(code: string): DocumentArea | undefined {
  const areaCode = code.split("-")[1];
  return documentAreas.find((a) => a.code === areaCode);
}

/**
 * Coding-rule engine — mirrors `backend/src/lib/documentCode.ts` exactly, so
 * this preview always matches the code `POST /documents` will actually
 * assign. The rule itself comes from Control Documental's "Regla de
 * codificación" card, persisted via `/coding-rule` (see `useCodingRule()`
 * in `@/lib/queries` and `CodingRuleDTO` in `@/lib/api`).
 */

/** Matches today's actual TIPO-AREA-NNN codes exactly — used only while
 * `useCodingRule()` hasn't resolved yet. */
export const DEFAULT_CODING_RULE: CodingRuleDTO = {
  tokens: ["TIPO", "PROCESO", "CORRELATIVO"],
  separador: "-",
  digitos: 3,
  prefijoVer: "V",
  formatoAnio: "26",
  empresaSigla: "SOL",
  unico: true,
  hereda: true,
};

interface TokenContext {
  type: DocumentType;
  areaCode: string;
  year: number;
}

function tokenValue(token: string, rule: CodingRuleDTO, ctx: TokenContext): string {
  switch (token) {
    case "SIGLA":
      return rule.empresaSigla;
    case "TIPO":
      return documentTypeAbbr[ctx.type];
    case "PROCESO":
      return ctx.areaCode;
    case "ANIO":
      return rule.formatoAnio === "2026" ? String(ctx.year) : String(ctx.year).slice(-2);
    case "VERSION":
      // A newly created document always starts at version 1.
      return `${rule.prefijoVer}01`;
    default:
      return "";
  }
}

/** Placeholder for CORRELATIVO while templating — see the identical
 * technique (and rationale) in the backend's `documentCode.ts`. */
const CORRELATIVO_MARK = "\u0000";

function splitAroundCorrelativo(
  rule: CodingRuleDTO,
  ctx: TokenContext,
): { prefix: string; suffix: string } {
  const sep = rule.separador === "ninguno" ? "" : rule.separador;
  const templated = rule.tokens
    .map((t) => (t === "CORRELATIVO" ? CORRELATIVO_MARK : tokenValue(t, rule, ctx)))
    .join(sep);
  const idx = templated.indexOf(CORRELATIVO_MARK);
  if (idx === -1) return { prefix: templated, suffix: "" };
  return { prefix: templated.slice(0, idx), suffix: templated.slice(idx + 1) };
}

/** Next sequential code under `rule` for a (type, area) pair, e.g.
 * nextDocumentCode(rule, "Procedimiento", "CAL", docs) -> "PRO-CAL-010". */
export function nextDocumentCode(
  rule: CodingRuleDTO,
  type: DocumentType,
  areaCode: string,
  existingDocs: SolinalDocument[],
  year: number = new Date().getFullYear(),
): string {
  const { prefix, suffix } = splitAroundCorrelativo(rule, { type, areaCode, year });
  let max = 0;
  for (const doc of existingDocs) {
    const code = doc.code;
    if (code.length < prefix.length + suffix.length) continue;
    if (!code.startsWith(prefix) || !code.endsWith(suffix)) continue;
    const numPart = code.slice(prefix.length, code.length - suffix.length);
    const n = Number.parseInt(numPart, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(rule.digitos, "0")}${suffix}`;
}
