/**
 * Prisma row  ->  the EXACT JSON shape the existing frontend already expects.
 *
 * Every document/template/user/audit/comment/config response MUST go through
 * one of these. They are the single place where three things get fixed up:
 *
 *   1. `signatures` collapses from a join table back to `string[]` of user
 *      NAMES, oldest first (Editor.tsx does `doc.signatures.includes(activeUser)`
 *      and appends).
 *   2. `revisiones` collapses to `string[]`, NEWEST FIRST (the frontend
 *      prepends and then indexes positionally in `handleRestoreVersion(idx)`).
 *   3. The two space-containing enum values are converted from their Prisma
 *      identifiers back to the literals the UI compares against
 *      (`"En_aprobación"` -> `"En aprobación"`, `"No_aplica"` -> `"No aplica"`).
 *      See `enums.ts`.
 *
 * The DTO interfaces below are byte-compatible supersets of the interfaces in
 * `src/data/seed.ts`. Extra fields (`sectionLocked`, `contentVersion`, `id`)
 * are additive — the frontend ignores what it does not read.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *   const rows = await prisma.document.findMany({ include: documentInclude });
 *   res.json(rows.map(serializeDocument));
 *
 *   const row = await prisma.document.findUnique({ where: { code }, include: documentInclude });
 *   if (!row) throw HttpError.notFound(`Documento ${code} no encontrado.`);
 *   res.json(serializeDocument(row));
 * ───────────────────────────────────────────────────────────────────────────
 */
import type {
  AuditLogEntry,
  CodingRule,
  Document,
  DocumentComment,
  DocumentRevision,
  DocumentSignature,
  DocumentTemplate,
  DocumentTypeCatalog,
  OrgConfig,
  ProcessArea,
  Prisma,
  RegulationAlert,
  RoleName,
  ScanImport,
  User,
} from '@prisma/client';
import {
  toWireEstado,
  toWirePeriodicidad,
  zRolesRequeridos,
  zTemplateSection,
  type DocumentTypeWire,
  type EstadoWire,
  type PeriodicidadWire,
  type RolesRequeridos,
  type TemplateLevelWire,
  type TemplateSectionShape,
} from './enums.js';

// ---------------------------------------------------------------------------
// Prisma `include` presets — use these so relations arrive pre-ordered.
// ---------------------------------------------------------------------------

/**
 * Include preset for any query whose result you will pass to
 * `serializeDocument`. The serializer re-sorts defensively, so a query that
 * forgets the `orderBy` still produces correct output — but use this.
 */
export const documentInclude = {
  signatures: { orderBy: { signedAt: 'asc' } },
  revisiones: { orderBy: { id: 'desc' } },
} satisfies Prisma.DocumentInclude;

export type DocumentWithRelations = Document & {
  signatures: DocumentSignature[];
  revisiones: DocumentRevision[];
};

// ---------------------------------------------------------------------------
// DTOs (wire shapes)
// ---------------------------------------------------------------------------

/** Mirrors `SolinalDocument` in src/data/seed.ts, plus the new server fields. */
export interface DocumentDTO {
  code: string;
  title: string;
  /** Free text — any `nombre` from `DocumentTypeCatalog`. `DocumentTemplate`
   * still uses the closed `DocumentTypeWire` vocabulary (see `TemplateDTO`). */
  type: string;
  norma: string;
  estado: EstadoWire;
  version: string;
  /** Display NAME of the creator, not the uuid — the frontend compares names. */
  creador: string;
  vencido: boolean;
  critico: boolean;
  content: string;
  /** User names, oldest signature first. */
  signatures: string[];
  /** History lines, newest first. */
  revisiones: string[];
  nivel: TemplateLevelWire | null;
  rolesRequeridos: RolesRequeridos | null;

  // --- additive, new in the backend ---------------------------------------
  /** Per-document replacement for the old global `session.isSectionLocked`. */
  sectionLocked: boolean;
  /** Optimistic-concurrency token. Echo it back on PATCH; a stale value 409s. */
  contentVersion: number;
  /** uuid of the creator, for anything that needs the real FK. */
  creadorId: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `DocumentTemplate` in src/data/seed.ts. */
export interface TemplateDTO {
  key: string;
  name: string;
  norma: string;
  type: DocumentTypeWire;
  desc: string;
  preview: string;
  content: string;
  /** @deprecated superseded by `secciones`; still read by the UI. */
  mandatory: string[];
  nivel: TemplateLevelWire;
  clausulaIso: string;
  secciones: TemplateSectionShape[];
  periodicidadRevision: PeriodicidadWire;
  tiempoRetencionAnios: number;
  /** Omitted (undefined) for root-level templates, matching seed.ts. */
  documentoPadreKey?: string;
  rolesRequeridos: RolesRequeridos;
}

/** Mirrors `AppUser` in src/data/seed.ts, plus `id`/`email` the API needs. */
export interface UserDTO {
  id: string;
  name: string;
  short: string;
  email: string;
  role: RoleName;
  status?: string;
  notes?: string;
  createdAt: string;
}

/** Mirrors `AuditLogEntry` in src/data/seed.ts. */
export interface AuditLogDTO {
  id: number;
  action: string;
  user: string;
  role: RoleName;
  date: string;
  time: string;
  ip: string;
}

/** Mirrors `DocumentComment` in src/data/seed.ts, plus `id`. */
export interface CommentDTO {
  id: number;
  code: string;
  author: string;
  date: string;
  text: string;
}

/** Mirrors `OrgConfig` in src/data/seed.ts (the singleton `id` is dropped). */
export interface ConfigDTO {
  orgName: string;
  brandColor: string;
  twoFactorEnabled: boolean;
  passwordPolicy: OrgConfig['passwordPolicy'];
  doubleApproval: OrgConfig['doubleApproval'];
}

export interface RegulationAlertDTO {
  id: number;
  norma: string;
  marker: string;
  bodyHtml: string;
  active: boolean;
  createdAt: string;
}

export interface ScanImportDTO {
  id: number;
  documentCode: string;
  payload: unknown;
  createdBy: string | null;
  createdAt: string;
}

/** Mirrors the Prisma `DocumentTypeCatalog` row — see NOTES.md § 17. */
export interface DocumentTypeCatalogDTO {
  sigla: string;
  nombre: string;
  nivel: number;
  digitos: number;
  retencion: string;
  firma: boolean;
  orden: number;
}

/** Mirrors the Prisma `ProcessArea` row — Control Documental's "Procesos y
 * áreas" table, source of the "Área / Departamento" dropdown. */
export interface ProcessAreaDTO {
  sigla: string;
  nombre: string;
  orden: number;
}

/** Mirrors the Prisma `CodingRule` singleton row — see documentCode.ts. */
export interface CodingRuleDTO {
  tokens: string[];
  separador: string;
  digitos: number;
  prefijoVer: string;
  formatoAnio: string;
  empresaSigla: string;
  unico: boolean;
  hereda: boolean;
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export function serializeDocument(doc: DocumentWithRelations): DocumentDTO {
  return {
    code: doc.code,
    title: doc.title,
    type: doc.type,
    norma: doc.norma,
    estado: toWireEstado(doc.estado),
    version: doc.version,
    creador: doc.creador,
    vencido: doc.vencido,
    critico: doc.critico,
    content: doc.content,
    signatures: serializeSignatures(doc.signatures),
    revisiones: serializeRevisiones(doc.revisiones),
    nivel: doc.nivel ?? null,
    rolesRequeridos: parseRolesRequeridos(doc.rolesRequeridos),
    sectionLocked: doc.sectionLocked,
    contentVersion: doc.contentVersion,
    creadorId: doc.creadorId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Join rows -> `string[]` of user names, OLDEST FIRST.
 * Sorted defensively in case the caller's query had no `orderBy`.
 */
export function serializeSignatures(rows: readonly DocumentSignature[]): string[] {
  return [...rows]
    .sort((a, b) => a.signedAt.getTime() - b.signedAt.getTime())
    .map((s) => s.userName);
}

/**
 * Join rows -> `string[]` of history lines, NEWEST FIRST.
 * Ordered by descending autoincrement `id`, which is tie-free (unlike
 * `createdAt`, where two same-millisecond inserts could swap).
 */
export function serializeRevisiones(rows: readonly DocumentRevision[]): string[] {
  return [...rows].sort((a, b) => b.id - a.id).map((r) => r.text);
}

export function serializeTemplate(t: DocumentTemplate): TemplateDTO {
  return {
    key: t.key,
    name: t.name,
    norma: t.norma,
    type: t.type,
    desc: t.desc,
    preview: t.preview,
    content: t.content,
    mandatory: t.mandatory,
    nivel: t.nivel,
    clausulaIso: t.clausulaIso,
    secciones: parseSecciones(t.secciones),
    periodicidadRevision: toWirePeriodicidad(t.periodicidadRevision),
    tiempoRetencionAnios: t.tiempoRetencionAnios,
    // Omit the key entirely when null, so the JSON matches seed.ts (where the
    // field is simply absent on root-level templates).
    ...(t.documentoPadreKey ? { documentoPadreKey: t.documentoPadreKey } : {}),
    rolesRequeridos: parseRolesRequeridos(t.rolesRequeridos) ?? {
      elaborador: 'Elaborador',
      revisor: 'Revisor',
      aprobador: 'Aprobador',
      dobleAprobacion: false,
    },
  };
}

/** Never returns `passwordHash`, `failedAttempts` or `lockedAt`. */
export function serializeUser(u: User): UserDTO {
  return {
    id: u.id,
    name: u.name,
    short: u.short,
    email: u.email,
    role: u.role,
    ...(u.status !== null ? { status: u.status } : {}),
    ...(u.notes !== null ? { notes: u.notes } : {}),
    createdAt: u.createdAt.toISOString(),
  };
}

export function serializeAuditLog(l: AuditLogEntry): AuditLogDTO {
  return {
    id: l.id,
    action: l.action,
    user: l.user,
    role: l.role,
    date: l.date,
    time: l.time,
    ip: l.ip,
  };
}

export function serializeComment(c: DocumentComment): CommentDTO {
  return { id: c.id, code: c.code, author: c.author, date: c.date, text: c.text };
}

export function serializeConfig(c: OrgConfig): ConfigDTO {
  return {
    orgName: c.orgName,
    brandColor: c.brandColor,
    twoFactorEnabled: c.twoFactorEnabled,
    passwordPolicy: c.passwordPolicy,
    doubleApproval: c.doubleApproval,
  };
}

export function serializeRegulationAlert(a: RegulationAlert): RegulationAlertDTO {
  return {
    id: a.id,
    norma: a.norma,
    marker: a.marker,
    bodyHtml: a.bodyHtml,
    active: a.active,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializeScanImport(s: ScanImport): ScanImportDTO {
  return {
    id: s.id,
    documentCode: s.documentCode,
    payload: s.payload,
    createdBy: s.createdBy,
    createdAt: s.createdAt.toISOString(),
  };
}

export function serializeDocumentTypeCatalog(t: DocumentTypeCatalog): DocumentTypeCatalogDTO {
  return {
    sigla: t.sigla,
    nombre: t.nombre,
    nivel: t.nivel,
    digitos: t.digitos,
    retencion: t.retencion,
    firma: t.firma,
    orden: t.orden,
  };
}

export function serializeProcessArea(a: ProcessArea): ProcessAreaDTO {
  return {
    sigla: a.sigla,
    nombre: a.nombre,
    orden: a.orden,
  };
}

export function serializeCodingRule(r: CodingRule): CodingRuleDTO {
  return {
    tokens: r.tokens,
    separador: r.separador,
    digitos: r.digitos,
    prefijoVer: r.prefijoVer,
    formatoAnio: r.formatoAnio,
    empresaSigla: r.empresaSigla,
    unico: r.unico,
    hereda: r.hereda,
  };
}

// ---------------------------------------------------------------------------
// JSONB guards
// ---------------------------------------------------------------------------

/** Validates a JSONB `rolesRequeridos` column; returns null if absent/invalid. */
export function parseRolesRequeridos(value: Prisma.JsonValue | null): RolesRequeridos | null {
  if (value === null || value === undefined) return null;
  const parsed = zRolesRequeridos.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Validates a JSONB `secciones` column; returns [] if absent/invalid. */
export function parseSecciones(value: Prisma.JsonValue | null): TemplateSectionShape[] {
  if (value === null || value === undefined) return [];
  const parsed = zTemplateSection.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}
