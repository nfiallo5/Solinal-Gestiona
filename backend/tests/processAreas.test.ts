/**
 * `/process-areas` route tests — the `ProcessArea` catalog behind Control
 * Documental's "Procesos y áreas" table.
 *
 * This is a shared table `POST /documents` validates `area` against on every
 * create, so the seeded 9 rows are restored in `afterAll`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';

const app = createApp();

const ADMIN = { email: 'admin@solinal.com', password: 'admin2026' };
const LECTOR = { email: 'lector@solinal.com', password: 'lector2026' };

let adminToken = '';
let lectorToken = '';
let original: { sigla: string; nombre: string; orden: number }[] = [];

const createdCodes: string[] = [];

async function auditWatermark(): Promise<number> {
  const row = await prisma.auditLogEntry.findFirst({ orderBy: { id: 'desc' } });
  return row?.id ?? 0;
}

function auditSince(since: number, contains: string) {
  return prisma.auditLogEntry.findFirst({
    where: { id: { gt: since }, action: { contains } },
    orderBy: { id: 'desc' },
  });
}

async function login(creds: { email: string; password: string }): Promise<string> {
  await prisma.user.updateMany({
    where: { email: creds.email },
    data: { failedAttempts: 0, lockedAt: null },
  });
  const res = await request(app).post('/auth/login').send(creds);
  expect(res.status).toBe(200);
  return res.body.token as string;
}

async function restoreOriginal() {
  const siglas = original.map((a) => a.sigla);
  await prisma.processArea.deleteMany({ where: { sigla: { notIn: siglas } } });
  for (const a of original) {
    await prisma.processArea.upsert({ where: { sigla: a.sigla }, create: a, update: a });
  }
}

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);

  const rows = await prisma.processArea.findMany({ orderBy: { orden: 'asc' } });
  if (rows.length === 0) {
    throw new Error('Test DB not seeded (missing ProcessArea). Run npm run test:db:reset.');
  }
  original = rows.map((r) => ({ sigla: r.sigla, nombre: r.nombre, orden: r.orden }));
});

afterAll(async () => {
  if (createdCodes.length > 0) {
    await prisma.document.deleteMany({ where: { code: { in: createdCodes } } });
  }
  if (original.length > 0) await restoreOriginal();
  await disconnectPrisma();
});

describe('GET /process-areas', () => {
  it('returns the 9 seeded processes/areas in order', async () => {
    const res = await request(app)
      .get('/process-areas')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((a: { sigla: string }) => a.sigla)).toEqual([
      'GER',
      'CAL',
      'PRD',
      'MTO',
      'RHU',
      'LOG',
      'COM',
      'IDD',
      'SSA',
    ]);
  });

  it('is readable by a Lector', async () => {
    const res = await request(app)
      .get('/process-areas')
      .set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/process-areas')).status).toBe(401);
  });
});

describe('PUT /process-areas', () => {
  it('replaces the catalog for an admin (rename + reorder + drop) and audits it', async () => {
    const since = await auditWatermark();
    const next = [
      { sigla: 'cal', nombre: 'Calidad renombrada', orden: 0 },
      { sigla: 'GER', nombre: 'Gerencia y estrategia', orden: 1 },
    ];

    const res = await request(app)
      .put('/process-areas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(next);

    expect(res.status).toBe(200);
    expect(res.body.map((a: { sigla: string }) => a.sigla)).toEqual(['CAL', 'GER']); // uppercased
    expect(res.body[0].nombre).toBe('Calidad renombrada');

    const rows = await prisma.processArea.findMany();
    expect(rows).toHaveLength(2); // the other 7 were dropped

    const entry = await auditSince(since, 'Actualizó el catálogo de procesos y áreas');
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe('Erick Murillo');

    await restoreOriginal();
  });

  it('403s a Lector and leaves the catalog untouched', async () => {
    const before = await prisma.processArea.count();
    const res = await request(app)
      .put('/process-areas')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send([{ sigla: 'CAL', nombre: 'x', orden: 0 }]);
    expect(res.status).toBe(403);
    expect(await prisma.processArea.count()).toBe(before);
  });

  it('400s an empty list', async () => {
    const res = await request(app)
      .put('/process-areas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([]);
    expect(res.status).toBe(400);
  });

  it('400s a duplicated sigla', async () => {
    const res = await request(app)
      .put('/process-areas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([
        { sigla: 'CAL', nombre: 'Uno', orden: 0 },
        { sigla: 'cal', nombre: 'Dos', orden: 1 },
      ]);
    expect(res.status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).put('/process-areas').send(original)).status).toBe(401);
  });
});

describe('process-area catalog gates POST /documents', () => {
  it('accepts a newly added area and rejects it again once removed', async () => {
    await request(app)
      .put('/process-areas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([...original, { sigla: 'TST', nombre: 'Área de prueba', orden: original.length }]);

    const ok = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        templateKey: null,
        title: 'Documento en área nueva',
        type: 'Procedimiento',
        area: 'TST',
        norma: 'ISO 9001:2015',
        critico: false,
      });
    expect(ok.status).toBe(201);
    createdCodes.push(ok.body.code as string);
    expect(ok.body.code).toMatch(/^PRO-TST-\d{3}$/);

    await restoreOriginal();

    const rejected = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        templateKey: null,
        title: 'Documento en área removida',
        type: 'Procedimiento',
        area: 'TST',
        norma: 'ISO 9001:2015',
        critico: false,
      });
    expect(rejected.status).toBe(400);
  });
});
