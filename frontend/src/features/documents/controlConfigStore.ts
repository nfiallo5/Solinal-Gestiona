import type { DocumentTypeCatalogEntry } from "@/lib/api";
import { documentTypeOptions as defaultTypeOptions } from "./docStyles";

/**
 * "Tipo documental" dropdown options for Crear Documento (and the type-badge
 * labels in Cumplimiento ISO's "Requisitos ISO Mapeados").
 *
 * Both catalogs that used to live here in `localStorage` are real backend
 * tables now: document *types* → `/document-types` (`DocumentTypeCatalog`,
 * see `useDocumentTypes()`), processes/*areas* → `/process-areas`
 * (`ProcessArea`, see `useProcessAreas()`).
 */

export interface DocumentTypeOption {
  /** The type name — also what gets posted as `SolinalDocument.type`. */
  value: string;
  label: string;
}

/**
 * Every row of Control Documental's "Tipos de información documentada" table
 * (`GET /document-types`). `Document.type` is free text now, so this offers
 * the full catalog — Procedimiento, Política, …, Programa, Ficha técnica,
 * Registro — not just the 5 template types. Falls back to the canonical 5
 * while the catalog query is still loading, so the dropdown is never empty.
 */
export function buildDocumentTypeOptions(
  catalog: DocumentTypeCatalogEntry[] | undefined,
): DocumentTypeOption[] {
  if (catalog && catalog.length > 0) {
    return catalog.map((t) => ({ value: t.nombre, label: t.nombre }));
  }
  return defaultTypeOptions.map((type) => ({ value: type, label: type }));
}
