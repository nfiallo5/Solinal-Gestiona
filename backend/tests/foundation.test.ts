/**
 * Foundation smoke tests. These exist mainly to prove the seams other agents
 * build on actually work: the app factory + supertest, the serializers, the
 * enum wire mapping, and the document-code generator.
 */
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { documentInclude, serializeDocument, serializeTemplate } from '../src/lib/serialize.js';
import { ESTADO_FROM_WIRE, ESTADO_TO_WIRE, PERIODICIDAD_TO_WIRE } from '../src/lib/enums.js';
import { DEFAULT_CODING_RULE, nextDocumentCodeFrom } from '../src/lib/documentCode.js';

const app = createApp();

afterAll(async () => {
  await disconnectPrisma();
});

describe('GET /health', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('error handling', () => {
  it('404s unknown routes as JSON', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('enum wire mapping', () => {
  it('round-trips the space-containing values', () => {
    expect(ESTADO_TO_WIRE.En_aprobación).toBe('En aprobación');
    expect(ESTADO_FROM_WIRE['En aprobación']).toBe('En_aprobación');
    expect(PERIODICIDAD_TO_WIRE.No_aplica).toBe('No aplica');
  });
});

describe('documentCode', () => {
  it('reproduces the frontend rule under the default coding rule', () => {
    expect(
      nextDocumentCodeFrom(DEFAULT_CODING_RULE, 'Procedimiento', 'CAL', [
        'PRO-CAL-009',
        'POL-GER-003',
      ]),
    ).toBe('PRO-CAL-010');
    expect(nextDocumentCodeFrom(DEFAULT_CODING_RULE, 'Checklist', 'HAC', [])).toBe('CHK-HAC-001');
  });
});

describe('serializers (requires a seeded test DB)', () => {
  it('serializes a document into the frontend shape', async () => {
    const row = await prisma.document.findUnique({
      where: { code: 'MAN-CAL-001' },
      include: documentInclude,
    });
    if (!row) {
      // Test DB not seeded — skip rather than fail the whole suite.
      return;
    }
    const dto = serializeDocument(row);
    expect(dto.creador).toBe('Erick Murillo');
    expect(dto.signatures).toEqual(['Erick Murillo', 'Carlos Ruiz']);
    expect(dto.revisiones).toEqual([
      'v3.0: Adecuación a nueva estructura',
      'v2.0: Revisión bienal',
    ]);
    expect(dto.nivel).toBeNull();
    expect(dto.rolesRequeridos).toBeNull();
    expect(dto.sectionLocked).toBe(false);
  });

  it('serializes estado back to the literal the UI compares against', async () => {
    const row = await prisma.document.findUnique({
      where: { code: 'POL-GER-003' },
      include: documentInclude,
    });
    if (!row) return;
    expect(serializeDocument(row).estado).toBe('En aprobación');
  });

  it('omits documentoPadreKey on root templates and keeps it on children', async () => {
    const [root, child] = await Promise.all([
      prisma.documentTemplate.findUnique({ where: { key: 'procedimiento' } }),
      prisma.documentTemplate.findUnique({ where: { key: 'instructivo' } }),
    ]);
    if (!root || !child) return;
    expect(serializeTemplate(root).documentoPadreKey).toBeUndefined();
    expect(serializeTemplate(child).documentoPadreKey).toBe('procedimiento');
    expect(serializeTemplate(root).secciones).toHaveLength(5);
  });
});
