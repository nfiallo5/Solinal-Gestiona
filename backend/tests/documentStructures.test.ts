/**
 * `/document-structures` route tests — the `DocumentStructureSection` table
 * behind Control Documental's "Estructuras documentales" tab.
 *
 * The seeded outlines (14 types, from ESTRUCTURAS_INI) are restored in
 * `afterAll` via the same replace-all PUT the route exposes, since other
 * suites may read this table.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';

const app = createApp();

const ADMIN = { email: 'admin@solinal.com', password: 'admin2026' };
const LECTOR = { email: 'lector@solinal.com', password: 'lector2026' };

type Section = { titulo: string; activa: boolean };
type StructureMap = Record<string, Section[]>;

let adminToken = '';
let lectorToken = '';
let original: StructureMap = {};

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

/** Restores the outlines to exactly `original` via the route's own PUT. */
async function restoreOriginal() {
  const res = await request(app)
    .put('/document-structures')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(original);
  expect(res.status).toBe(200);
}

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);

  const res = await request(app)
    .get('/document-structures')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  original = res.body as StructureMap;
  if (Object.keys(original).length === 0) {
    throw new Error(
      'Test DB not seeded (missing DocumentStructureSection). Run npm run test:db:reset.',
    );
  }
});

afterAll(async () => {
  if (Object.keys(original).length > 0) await restoreOriginal();
  await disconnectPrisma();
});

describe('GET /document-structures', () => {
  it('returns the seeded per-type outlines, each ordered', async () => {
    const res = await request(app)
      .get('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    expect(Object.keys(res.body).sort()).toEqual([
      'DOC-EXT',
      'ESP',
      'FOR',
      'FT',
      'INS',
      'LST',
      'MAN',
      'MAT',
      'PLA',
      'POL',
      'PRG',
      'PRO',
      'PTC',
      'REG',
    ]);

    expect(res.body.PRO).toHaveLength(12);
    expect(res.body.PRO[0]).toEqual({ titulo: 'Objetivo', activa: true });
    expect(res.body.PRO.at(-1)).toEqual({ titulo: 'Historial de cambios', activa: true });
  });

  it('is readable by a Lector', async () => {
    const res = await request(app)
      .get('/document-structures')
      .set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/document-structures')).status).toBe(401);
  });
});

describe('PUT /document-structures', () => {
  it('replaces the outlines for an admin (rename + uncheck + reorder + drop) and audits it', async () => {
    const since = await auditWatermark();
    const next: StructureMap = {
      PRO: [
        { titulo: 'Propósito', activa: true }, // renamed + moved to front
        { titulo: 'Alcance', activa: true },
        { titulo: 'Anexos', activa: false }, // unchecked
      ],
      POL: [{ titulo: 'Título', activa: true }],
      // the other 12 types intentionally dropped
    };

    const res = await request(app)
      .put('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(next);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['POL', 'PRO']);
    expect(res.body.PRO).toEqual(next.PRO);

    const rows = await prisma.documentStructureSection.findMany();
    expect(rows).toHaveLength(4); // 3 for PRO + 1 for POL
    const pro = await prisma.documentStructureSection.findMany({
      where: { tipoSigla: 'PRO' },
      orderBy: { orden: 'asc' },
    });
    expect(pro.map((r) => r.titulo)).toEqual(['Propósito', 'Alcance', 'Anexos']);
    expect(pro.map((r) => r.orden)).toEqual([0, 1, 2]);
    expect(pro[2].activa).toBe(false);

    const entry = await auditSince(since, 'Actualizó las estructuras documentales por tipo');
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe('Erick Murillo');

    await restoreOriginal();
  });

  it('normalises a lowercase type key to uppercase', async () => {
    const res = await request(app)
      .put('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pro: [{ titulo: 'Objetivo', activa: true }] });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['PRO']);

    await restoreOriginal();
  });

  it('403s a Lector and leaves the table untouched', async () => {
    const before = await prisma.documentStructureSection.count();
    const res = await request(app)
      .put('/document-structures')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send({ PRO: [{ titulo: 'x', activa: true }] });
    expect(res.status).toBe(403);
    expect(await prisma.documentStructureSection.count()).toBe(before);
  });

  it('400s an empty map', async () => {
    const res = await request(app)
      .put('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('400s a section with an empty title', async () => {
    const res = await request(app)
      .put('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ PRO: [{ titulo: '   ', activa: true }] });
    expect(res.status).toBe(400);
  });

  it('400s two case-variant keys for the same type', async () => {
    const res = await request(app)
      .put('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        PRO: [{ titulo: 'Objetivo', activa: true }],
        pro: [{ titulo: 'Alcance', activa: true }],
      });
    expect(res.status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).put('/document-structures').send(original)).status).toBe(401);
  });
});

describe('an edited outline survives a round-trip', () => {
  it('persists an added section and a removed one', async () => {
    const edited: StructureMap = {
      ...original,
      INS: [
        ...original.INS.filter((s) => s.titulo !== 'Anexos'),
        { titulo: 'Lecciones aprendidas', activa: true },
      ],
    };

    const put = await request(app)
      .put('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(edited);
    expect(put.status).toBe(200);

    const get = await request(app)
      .get('/document-structures')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    const ins = (get.body as StructureMap).INS.map((s) => s.titulo);
    expect(ins).toContain('Lecciones aprendidas');
    expect(ins).not.toContain('Anexos');

    await restoreOriginal();
  });
});
