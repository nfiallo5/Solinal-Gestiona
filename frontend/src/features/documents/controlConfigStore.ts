import type { DocumentType } from "@/data/seed";
import type { DocumentTypeCatalogEntry } from "@/lib/api";
import { documentTypeAbbr, documentTypeOptions as defaultTypeOptions } from "./docStyles";

/**
 * Label helper for Crear Documento's "Tipo documental" dropdown.
 *
 * Both catalogs that used to live here in `localStorage` are real backend
 * tables now: document *types* → `/document-types` (`DocumentTypeCatalog`,
 * see `useDocumentTypes()`), processes/*areas* → `/process-areas`
 * (`ProcessArea`, see `useProcessAreas()`). This file keeps only the small
 * mapping that turns the type catalog into dropdown options.
 */

export interface DocumentTypeOption {
  value: DocumentType;
  label: string;
}

/**
 * "Tipo documental" options for Crear Documento (and the label shown for a
 * document type in Cumplimiento ISO's "Requisitos ISO Mapeados"), sourced
 * from Control Documental's "Tipos de información documentada" table
 * (`GET /document-types`, see `useDocumentTypes()` in `@/lib/queries`).
 *
 * `Document.type` is a fixed 5-value backend enum (Procedimiento/Política/
 * Manual/Instructivo/Checklist) — that constraint is real (Postgres enum,
 * enforced server-side) and out of scope to lift here. So this always
 * offers exactly those 5 values (never fewer — dropping one whose sigla
 * isn't in the catalog would silently make that type impossible to pick),
 * but each one's *label* comes from whatever name is set on the matching
 * sigla row (PRO/POL/MAN/INS/CHK) in that table, falling back to the
 * built-in name when the catalog hasn't loaded yet or has no such row.
 * Rename "Procedimiento" there and every consumer of this function shows
 * the new name; the value posted to the API stays the enum literal either
 * way.
 */
export function buildDocumentTypeOptions(
  catalog: DocumentTypeCatalogEntry[] | undefined,
): DocumentTypeOption[] {
  const labelBySigla = new Map<string, string>();
  for (const tipo of catalog ?? []) {
    if (tipo.nombre) labelBySigla.set(tipo.sigla.toUpperCase(), tipo.nombre);
  }

  return defaultTypeOptions.map((type) => ({
    value: type,
    label: labelBySigla.get(documentTypeAbbr[type]) ?? type,
  }));
}
