import type { DocumentType } from "@/data/seed";
import type { DocumentTypeCatalogEntry } from "@/lib/api";
import {
  documentAreas as defaultAreas,
  documentTypeAbbr,
  documentTypeOptions as defaultTypeOptions,
  type DocumentArea,
} from "./docStyles";

const STORAGE_KEY = "solinal-gestiona:control-documental-catalog";

export interface ControlCatalogProceso {
  s: string;
  n: string;
}

/**
 * "Procesos y áreas" only. Document *types* moved to the real backend
 * (`/document-types`, see `buildDocumentTypeOptions` below) — this
 * localStorage-only catalog now covers just the "Área / Departamento" list,
 * which isn't backend-enum-constrained the way document type is.
 */
export interface ControlCatalog {
  procesos: ControlCatalogProceso[];
}

/** Written by ControlDocumental.jsx's "Guardar configuración" for the
 * "Procesos y áreas" table — document types are saved separately via
 * `documentTypesApi.save()` straight to the backend. */
export function saveControlCatalog(catalog: ControlCatalog): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // localStorage unavailable (private mode / quota) — the dialog falls
    // back to the built-in defaults below.
  }
}

function loadControlCatalog(): ControlCatalog | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ControlCatalog) : null;
  } catch {
    return null;
  }
}

export interface DocumentTypeOption {
  value: DocumentType;
  label: string;
}

/**
 * "Tipo documental" options for Crear Documento (and the label shown for a
 * document type in Cumplimiento ISO's "Requisitos ISO Mapeados"), sourced
 * from Control Documental's "Tipos de información documentada" table —
 * now the real `DocumentTypeCatalog` backend table (`GET /document-types`,
 * see `useDocumentTypes()` in `@/lib/queries`) instead of localStorage.
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

/**
 * "Área / Departamento" options for Crear Documento, sourced from Control
 * Documental's "Procesos y áreas" table — unlike document type, the area
 * code isn't backend-enum-constrained, so it maps over directly. Still
 * localStorage-only; not part of this pass.
 */
export function getDocumentAreaOptions(): DocumentArea[] {
  const catalog = loadControlCatalog();
  if (!catalog || catalog.procesos.length === 0) return defaultAreas;
  return catalog.procesos.map((p) => ({ code: p.s, label: p.n || p.s }));
}
