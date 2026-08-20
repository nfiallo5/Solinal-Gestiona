/**
 * Document control-code generation — server-side port of `nextDocumentCode()`
 * from `src/features/documents/docStyles.ts`.
 *
 * A code is `TIPO-AREA-NNN`, e.g. `"PRO-CAL-009"`:
 *   TIPO  3-letter abbreviation of the document type
 *   AREA  3-letter department code chosen at creation time
 *   NNN   next sequential number for that exact TIPO-AREA pair, zero-padded
 *
 * The frontend derived this from its in-memory document list; the spec says to
 * preserve the rule but compute it on the server, so the client can no longer
 * supply an arbitrary `code`.
 */
import { DocumentType, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma.js';

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

/** Verbatim from docStyles.ts — the departments used across the seed data. */
export const documentAreas: DocumentArea[] = [
  { code: 'CAL', label: 'Calidad' },
  { code: 'GER', label: 'Gerencia' },
  { code: 'PRO', label: 'Producción' },
  { code: 'AMB', label: 'Ambiental' },
  { code: 'SEG', label: 'Seguridad' },
  { code: 'HAC', label: 'Higiene y Alérgenos' },
];

export const documentAreaCodes = documentAreas.map((a) => a.code) as [string, ...string[]];

/** zod schema for the `area` field of `POST /documents`. */
export const zAreaCode = z.enum(documentAreaCodes);

/** Middle segment of a code -> its area, for display. */
export function areaFromCode(code: string): DocumentArea | undefined {
  const areaCode = code.split('-')[1];
  return documentAreas.find((a) => a.code === areaCode);
}

/** `"PRO-CAL-"` for (Procedimiento, "CAL"). */
export function documentCodePrefix(type: DocumentType, areaCode: string): string {
  return `${documentTypeAbbr[type]}-${areaCode}-`;
}

/**
 * Pure form — identical arithmetic to the frontend's `nextDocumentCode`, but
 * taking the existing codes as a plain array so it is trivially testable.
 */
export function nextDocumentCodeFrom(
  type: DocumentType,
  areaCode: string,
  existingCodes: readonly string[],
): string {
  const prefix = documentCodePrefix(type, areaCode);
  let max = 0;
  for (const code of existingCodes) {
    if (code.startsWith(prefix)) {
      const n = Number.parseInt(code.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
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
  const prefix = documentCodePrefix(type, areaCode);
  const rows = await client.document.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  return nextDocumentCodeFrom(
    type,
    areaCode,
    rows.map((r) => r.code),
  );
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
