import type { DocumentType } from "@/data/seed";
import {
  documentAreas as defaultAreas,
  documentTypeAbbr,
  documentTypeOptions as defaultTypeOptions,
  type DocumentArea,
} from "./docStyles";

const STORAGE_KEY = "solinal-gestiona:control-documental-catalog";

export interface ControlCatalogTipo {
  s: string;
  n: string;
}

export interface ControlCatalogProceso {
  s: string;
  n: string;
}

export interface ControlCatalog {
  tipos: ControlCatalogTipo[];
  procesos: ControlCatalogProceso[];
}

/** Written by ControlDocumental.tsx's "Guardar configuración" — the "Tipos
 * y codificación" tab is the source of truth for the type/area options
 * offered when creating a document. */
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
 * "Tipo documental" options for Crear Documento, sourced from Control
 * Documental's "Tipos y codificación" table instead of a fixed list.
 *
 * `Document.type` is a fixed 5-value backend enum (Procedimiento/Política/
 * Manual/Instructivo/Checklist), so a type only appears here if its sigla in
 * the "Tipos y codificación" table still matches one of the 5 known
 * abbreviations (PRO/POL/MAN/INS/CHK) — remove that row there and it
 * disappears here too. The display label follows whatever name is set on
 * that row, even though the value sent to the API stays the enum literal.
 */
export function getDocumentTypeOptions(): DocumentTypeOption[] {
  const catalog = loadControlCatalog();
  if (!catalog || catalog.tipos.length === 0) {
    return defaultTypeOptions.map((t) => ({ value: t, label: t }));
  }

  const abbrToType = Object.fromEntries(
    Object.entries(documentTypeAbbr).map(([type, abbr]) => [abbr, type as DocumentType]),
  ) as Record<string, DocumentType>;

  const seen = new Set<DocumentType>();
  const options: DocumentTypeOption[] = [];
  for (const tipo of catalog.tipos) {
    const value = abbrToType[tipo.s.toUpperCase()];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: tipo.n || value });
  }
  return options.length > 0 ? options : defaultTypeOptions.map((t) => ({ value: t, label: t }));
}

/**
 * "Área / Departamento" options for Crear Documento, sourced from Control
 * Documental's "Procesos y áreas" table — unlike document type, the area
 * code isn't backend-enum-constrained, so it maps over directly.
 */
export function getDocumentAreaOptions(): DocumentArea[] {
  const catalog = loadControlCatalog();
  if (!catalog || catalog.procesos.length === 0) return defaultAreas;
  return catalog.procesos.map((p) => ({ code: p.s, label: p.n || p.s }));
}
