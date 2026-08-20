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
 * Documental's "Tipos de información documentada" table (the "Tipos y
 * codificación" tab) instead of the hardcoded seed.ts list.
 *
 * `Document.type` is a fixed 5-value backend enum (Procedimiento/Política/
 * Manual/Instructivo/Checklist) — that constraint is real (Postgres enum,
 * enforced server-side) and out of scope to lift here. So this always
 * offers exactly those 5 values (never fewer: an earlier version dropped a
 * type whose sigla wasn't present in the saved catalog, which silently
 * made "Checklist" impossible to pick the moment an admin saved Control
 * Documental's *default* catalog, since it ships without a "CHK" row) —
 * but each one's *label* comes from whatever name is set on the matching
 * sigla row (PRO/POL/MAN/INS/CHK) in that table, falling back to the
 * built-in name only when no such row exists. Rename "Procedimiento" to
 * "SOP" there and this dropdown says "SOP"; the value posted to the API
 * stays the enum literal either way.
 */
export function getDocumentTypeOptions(): DocumentTypeOption[] {
  const catalog = loadControlCatalog();
  const labelBySigla = new Map<string, string>();
  for (const tipo of catalog?.tipos ?? []) {
    if (tipo.n) labelBySigla.set(tipo.s.toUpperCase(), tipo.n);
  }

  return defaultTypeOptions.map((type) => ({
    value: type,
    label: labelBySigla.get(documentTypeAbbr[type]) ?? type,
  }));
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
