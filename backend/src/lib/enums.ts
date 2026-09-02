/**
 * Enum vocabulary shared by every route.
 *
 * Two of the frontend's enum literals contain a space (`"En aprobación"` and
 * `"No aplica"`), which a Prisma enum *identifier* cannot. Those two use
 * `@map` in schema.prisma, so:
 *
 *   - the POSTGRES label is the exact original string  ✅
 *   - the API WIRE format must also be the exact original string  ✅ (this file)
 *   - Prisma Client, in between, hands back the underscore identifier
 *     (`"En_aprobación"` / `"No_aplica"`).
 *
 * So: **never send a Prisma enum value straight to `res.json()`** for
 * `estado` or `periodicidadRevision`. Use `toWire*` on the way out (the
 * serializers in `serialize.ts` already do this for you) and `fromWire*` /
 * the `z*Wire` zod schemas on the way in.
 *
 * Every other enum (`DocumentType`, `TemplateLevel`, `RoleName`,
 * `PasswordPolicy`, `DoubleApproval`) round-trips unchanged — accents are
 * legal in Prisma identifiers, so `"Política"` is `"Política"` end to end.
 */
import { z } from 'zod';
import {
  DocumentStatus,
  DocumentType,
  DoubleApproval,
  PasswordPolicy,
  PeriodicidadRevision,
  RoleName,
  TemplateLevel,
} from '@prisma/client';

export {
  DocumentStatus,
  DocumentType,
  DoubleApproval,
  PasswordPolicy,
  PeriodicidadRevision,
  RoleName,
  TemplateLevel,
};

// ---------------------------------------------------------------------------
// Wire literal unions — these are exactly what `src/data/seed.ts` declares.
// ---------------------------------------------------------------------------

/** seed.ts `DocumentStatus`. */
export type EstadoWire = 'Borrador' | 'En aprobación' | 'Aprobado' | 'Rechazado';
/** seed.ts `DocumentTemplate["periodicidadRevision"]`. */
export type PeriodicidadWire = 'Anual' | 'Bienal' | 'Semestral' | 'No aplica';
/** seed.ts `DocumentType` — identical to the Prisma enum. */
export type DocumentTypeWire = `${DocumentType}`;
/** seed.ts `TemplateLevel` — identical to the Prisma enum. */
export type TemplateLevelWire = `${TemplateLevel}`;
/** seed.ts `RoleName` — identical to the Prisma enum. */
export type RoleNameWire = `${RoleName}`;

// ---------------------------------------------------------------------------
// Prisma identifier <-> wire string
// ---------------------------------------------------------------------------

export const ESTADO_TO_WIRE: Record<DocumentStatus, EstadoWire> = {
  Borrador: 'Borrador',
  En_aprobación: 'En aprobación',
  Aprobado: 'Aprobado',
  Rechazado: 'Rechazado',
};

export const ESTADO_FROM_WIRE: Record<EstadoWire, DocumentStatus> = {
  Borrador: DocumentStatus.Borrador,
  'En aprobación': DocumentStatus.En_aprobación,
  Aprobado: DocumentStatus.Aprobado,
  Rechazado: DocumentStatus.Rechazado,
};

export const PERIODICIDAD_TO_WIRE: Record<PeriodicidadRevision, PeriodicidadWire> = {
  Anual: 'Anual',
  Bienal: 'Bienal',
  Semestral: 'Semestral',
  No_aplica: 'No aplica',
};

export const PERIODICIDAD_FROM_WIRE: Record<PeriodicidadWire, PeriodicidadRevision> = {
  Anual: PeriodicidadRevision.Anual,
  Bienal: PeriodicidadRevision.Bienal,
  Semestral: PeriodicidadRevision.Semestral,
  'No aplica': PeriodicidadRevision.No_aplica,
};

export const toWireEstado = (v: DocumentStatus): EstadoWire => ESTADO_TO_WIRE[v];
export const fromWireEstado = (v: EstadoWire): DocumentStatus => ESTADO_FROM_WIRE[v];
export const toWirePeriodicidad = (v: PeriodicidadRevision): PeriodicidadWire =>
  PERIODICIDAD_TO_WIRE[v];
export const fromWirePeriodicidad = (v: PeriodicidadWire): PeriodicidadRevision =>
  PERIODICIDAD_FROM_WIRE[v];

// ---------------------------------------------------------------------------
// zod schemas over the WIRE vocabulary (use these in request validation)
// ---------------------------------------------------------------------------

/** Accepts `"En aprobación"` and outputs the Prisma `DocumentStatus`. */
export const zEstadoWire = z
  .enum(['Borrador', 'En aprobación', 'Aprobado', 'Rechazado'])
  .transform(fromWireEstado);

/** Accepts `"No aplica"` and outputs the Prisma `PeriodicidadRevision`. */
export const zPeriodicidadWire = z
  .enum(['Anual', 'Bienal', 'Semestral', 'No aplica'])
  .transform(fromWirePeriodicidad);

/** These three need no transform — identifier === wire string. */
export const zDocumentType = z.nativeEnum(DocumentType);

/**
 * `Document.type` (unlike `DocumentTemplate.type`) is free text now — any row
 * of the `DocumentTypeCatalog` table. This only checks the shape; the
 * documents route confirms the value exists in the catalog via
 * `assertTypeExists` in `documentCode.ts`.
 */
export const zDocumentTypeFree = z
  .string()
  .trim()
  .min(1, 'El tipo documental es obligatorio.')
  .max(60);
export const zTemplateLevel = z.nativeEnum(TemplateLevel);
export const zRoleName = z.nativeEnum(RoleName);
export const zPasswordPolicy = z.nativeEnum(PasswordPolicy);
export const zDoubleApproval = z.nativeEnum(DoubleApproval);

/**
 * `rolesRequeridos` snapshot, shape-identical to seed.ts. Stored as JSONB on
 * both `DocumentTemplate` and `Document`, so it needs its own runtime guard.
 */
export const zRolesRequeridos = z.object({
  elaborador: zRoleName,
  revisor: zRoleName,
  aprobador: zRoleName,
  dobleAprobacion: z.boolean(),
});
export type RolesRequeridos = z.infer<typeof zRolesRequeridos>;

/** `TemplateSection` from seed.ts. */
export const zTemplateSection = z.object({
  titulo: z.string(),
  proposito: z.string(),
  obligatoria: z.boolean(),
});
export type TemplateSectionShape = z.infer<typeof zTemplateSection>;

/**
 * Pages the `Lector` role cannot reach — verbatim from
 * `src/data/seed.ts#lectorRestrictedPages`. Route agents should gate the
 * corresponding endpoints with `requireRole(...)` rather than relying on this
 * list directly, but it is here as the canonical reference.
 */
export const LECTOR_RESTRICTED_PAGES = ['edit', 'templates', 'audit', 'config'] as const;
