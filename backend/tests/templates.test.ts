/**
 * `/templates` route tests (Agent 3).
 * Requires a seeded test database: `npm run test:db:reset`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();

const EMAILS = {
  admin: 'admin@solinal.com',
  elaborador: 'elaborador@solinal.com',
  lector: 'lector@solinal.com',
} as const;

type Who = keyof typeof EMAILS;

const tokens = {} as Record<Who, string>;
const names = {} as Record<Who, string>;
const createdKeys: string[] = [];

const auth = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });

beforeAll(async () => {
  for (const key of Object.keys(EMAILS) as Who[]) {
    const u = await prisma.user.findUnique({ where: { email: EMAILS[key] } });
    if (!u) throw new Error(`Test DB not seeded (missing ${EMAILS[key]}). Run npm run test:db:reset.`);
    tokens[key] = signToken({ sub: u.id, email: u.email, name: u.name, role: u.role });
    names[key] = u.name;
  }
});

afterAll(async () => {
  if (createdKeys.length > 0) {
    // Children first, so a self-referencing FK cannot block the delete.
    await prisma.documentTemplate.deleteMany({ where: { documentoPadreKey: { in: createdKeys } } });
    await prisma.documentTemplate.deleteMany({ where: { key: { in: createdKeys } } });
  }
  await disconnectPrisma();
});

async function createTemplate(who: Who, body: Record<string, unknown>) {
  const res = await request(app).post('/templates').set(auth(who)).send(body);
  if (res.status === 201) createdKeys.push(res.body.key as string);
  return res;
}

const VALID_SECCIONES = [
  { titulo: 'Alcance', proposito: 'Delimitar el alcance.', obligatoria: true },
  { titulo: 'Anexos', proposito: 'Material de apoyo.', obligatoria: false },
];

// ---------------------------------------------------------------------------

describe('GET /templates', () => {
  it('401s without a token', async () => {
    expect((await request(app).get('/templates')).status).toBe(401);
  });

  it('returns the seed catalogue in the frontend shape', async () => {
    const res = await request(app).get('/templates').set(auth('admin'));
    expect(res.status).toBe(200);

    const byKey = Object.fromEntries(res.body.map((t: { key: string }) => [t.key, t]));
    expect(Object.keys(byKey)).toEqual(
      expect.arrayContaining(['procedimiento', 'politica', 'checklist', 'instructivo']),
    );

    expect(byKey.procedimiento.secciones).toHaveLength(5);
    expect(byKey.procedimiento.secciones[0]).toEqual({
      titulo: 'Alcance',
      proposito: 'Delimitar a qué procesos, áreas o productos aplica el documento.',
      obligatoria: true,
    });
    expect(byKey.procedimiento.mandatory).toEqual(['Alcance', 'Responsabilidades']);
    expect(byKey.procedimiento.nivel).toBe('Procedimiento');
    expect(byKey.procedimiento.clausulaIso).toBe('7.5.1');
    expect(byKey.procedimiento.periodicidadRevision).toBe('Anual');
    expect(byKey.checklist.periodicidadRevision).toBe('Semestral');
    expect(byKey.politica.rolesRequeridos.dobleAprobacion).toBe(true);

    // Root templates omit the key entirely, children carry it.
    expect(byKey.procedimiento).not.toHaveProperty('documentoPadreKey');
    expect(byKey.instructivo.documentoPadreKey).toBe('procedimiento');
  });

  it('is readable by a Lector (Cumplimiento.tsx needs the catalogue)', async () => {
    const res = await request(app).get('/templates').set(auth('lector'));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe('POST /templates', () => {
  it('derives key, desc, preview, content and mandatory from the sections', async () => {
    const res = await createTemplate('elaborador', {
      name: 'Procedimiento Control de Plagas',
      norma: 'ISO 22000:2018',
      type: 'Procedimiento',
      nivel: 'Procedimiento',
      clausulaIso: '8.5.1',
      periodicidadRevision: 'Anual',
      secciones: VALID_SECCIONES,
    });

    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^procedimiento-control-de-plagas-\d+$/);
    expect(res.body.desc).toBe(
      'Estructura personalizada para Procedimiento bajo la norma ISO 22000:2018.',
    );
    expect(res.body.preview).toBe('Secciones: Alcance, Anexos');
    expect(res.body.content).toBe('1. Alcance<br/>2. Anexos');
    // Only the sections flagged obligatoria feed the deprecated `mandatory`.
    expect(res.body.mandatory).toEqual(['Alcance']);
    expect(res.body.tiempoRetencionAnios).toBe(3);
    expect(res.body.rolesRequeridos).toEqual({
      elaborador: 'Elaborador',
      revisor: 'Revisor',
      aprobador: 'Aprobador',
      dobleAprobacion: false,
    });
    expect(res.body).not.toHaveProperty('documentoPadreKey');
  });

  it('round-trips the space-containing "No aplica" periodicidad', async () => {
    const res = await createTemplate('admin', {
      name: 'Registro sin revisión',
      norma: 'ISO 9001:2015',
      type: 'Checklist',
      nivel: 'Registro',
      clausulaIso: '7.5.3',
      periodicidadRevision: 'No aplica',
      secciones: [{ titulo: 'Evidencia', proposito: 'Adjuntar evidencia.', obligatoria: true }],
    });
    expect(res.status).toBe(201);
    expect(res.body.periodicidadRevision).toBe('No aplica');
  });

  it('accepts an explicit parent and rejects a dangling one', async () => {
    const ok = await createTemplate('admin', {
      name: 'Instructivo hijo',
      norma: 'ISO 9001:2015',
      type: 'Instructivo',
      nivel: 'Instructivo',
      periodicidadRevision: 'Anual',
      documentoPadreKey: 'procedimiento',
      secciones: [{ titulo: 'Paso 1', proposito: 'Primer paso.', obligatoria: true }],
    });
    expect(ok.status).toBe(201);
    expect(ok.body.documentoPadreKey).toBe('procedimiento');

    const dangling = await createTemplate('admin', {
      name: 'Instructivo huérfano',
      norma: 'ISO 9001:2015',
      type: 'Instructivo',
      nivel: 'Instructivo',
      periodicidadRevision: 'Anual',
      documentoPadreKey: 'no-existe',
      secciones: [{ titulo: 'Paso 1', proposito: 'Primer paso.', obligatoria: true }],
    });
    expect(dangling.status).toBe(400);
  });

  it('requires at least one section (G06 Scenario 4)', async () => {
    const empty = await createTemplate('elaborador', {
      name: 'Sin secciones',
      norma: 'ISO 9001:2015',
      type: 'Procedimiento',
      nivel: 'Procedimiento',
      periodicidadRevision: 'Anual',
      secciones: [],
    });
    expect(empty.status).toBe(400);

    const blankTitles = await createTemplate('elaborador', {
      name: 'Secciones sin título',
      norma: 'ISO 9001:2015',
      type: 'Procedimiento',
      nivel: 'Procedimiento',
      periodicidadRevision: 'Anual',
      secciones: [{ titulo: '   ', proposito: '', obligatoria: true }],
    });
    expect(blankTitles.status).toBe(400);
  });

  it('writes an audit entry', async () => {
    const name = `Plantilla auditada ${Date.now()}`;
    const res = await createTemplate('elaborador', {
      name,
      norma: 'ISO 9001:2015',
      type: 'Manual',
      nivel: 'Manual',
      periodicidadRevision: 'Bienal',
      secciones: VALID_SECCIONES,
    });
    expect(res.status).toBe(201);

    const entry = await prisma.auditLogEntry.findFirst({
      where: { action: `Creó una nueva plantilla de documento: ${name}` },
    });
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe(names.elaborador);
  });

  it('409s a duplicate key', async () => {
    const body = {
      key: `duplicada-${Date.now()}`,
      name: 'Duplicada',
      norma: 'ISO 9001:2015',
      type: 'Procedimiento',
      nivel: 'Procedimiento',
      periodicidadRevision: 'Anual',
      secciones: VALID_SECCIONES,
    };
    expect((await createTemplate('admin', body)).status).toBe(201);
    expect((await createTemplate('admin', body)).status).toBe(409);
  });

  it('403s a Lector', async () => {
    const res = await createTemplate('lector', {
      name: 'No permitida',
      norma: 'ISO 9001:2015',
      type: 'Procedimiento',
      nivel: 'Procedimiento',
      periodicidadRevision: 'Anual',
      secciones: VALID_SECCIONES,
    });
    expect(res.status).toBe(403);
  });

  it('400s an invalid nivel or periodicidad', async () => {
    const badNivel = await createTemplate('admin', {
      name: 'Nivel inválido',
      norma: 'ISO 9001:2015',
      type: 'Procedimiento',
      nivel: 'Formulario',
      periodicidadRevision: 'Anual',
      secciones: VALID_SECCIONES,
    });
    expect(badNivel.status).toBe(400);

    const badPeriodicidad = await createTemplate('admin', {
      name: 'Periodicidad inválida',
      norma: 'ISO 9001:2015',
      type: 'Procedimiento',
      nivel: 'Procedimiento',
      periodicidadRevision: 'Trimestral',
      secciones: VALID_SECCIONES,
    });
    expect(badPeriodicidad.status).toBe(400);
  });
});
