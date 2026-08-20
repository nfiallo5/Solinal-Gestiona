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

/** Departments/areas in use across the seed documents (Calidad, Gerencia,
 * Producción, Ambiental, Seguridad, Higiene y Alérgenos). */
export const documentAreas: DocumentArea[] = [
  { code: "CAL", label: "Calidad" },
  { code: "GER", label: "Gerencia" },
  { code: "PRO", label: "Producción" },
  { code: "AMB", label: "Ambiental" },
  { code: "SEG", label: "Seguridad" },
  { code: "HAC", label: "Higiene y Alérgenos" },
];

/** Middle segment of a document code -> its area, for display purposes
 * (the code itself stays the single source of truth, nothing duplicates it
 * on the document record). */
export function areaFromCode(code: string): DocumentArea | undefined {
  const areaCode = code.split("-")[1];
  return documentAreas.find((a) => a.code === areaCode);
}

/** Next sequential code for a TIPO-AREA pair, e.g. nextDocumentCode("Procedimiento", "CAL", docs) -> "PRO-CAL-010". */
export function nextDocumentCode(
  type: DocumentType,
  areaCode: string,
  existingDocs: SolinalDocument[],
): string {
  const prefix = `${documentTypeAbbr[type]}-${areaCode}-`;
  let max = 0;
  for (const doc of existingDocs) {
    if (doc.code.startsWith(prefix)) {
      const n = parseInt(doc.code.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
