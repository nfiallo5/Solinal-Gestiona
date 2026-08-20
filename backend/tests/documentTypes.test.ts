/**
 * `/document-types` route tests — the `DocumentTypeCatalog` table.
 *
 * The 5 seeded rows (PRO/POL/INS/MAN/CHK) are restored in `afterAll`, since
 * this is a shared reference table other suites may read.
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
let original: Array<{
  sigla: string;
  nombre: string;
  nivel: number;
  digitos: number;
  retencion: string;
  firma: boolean;
  orden: number;
}>;

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

/** Restores the catalog to exactly `original` via the same replace-all PUT the route uses internally. */
async function restoreOriginal() {
  await prisma.$transaction(async (tx) => {
    await tx.documentTypeCatalog.deleteMany({});
    for (const row of original) {
      await tx.documentTypeCatalog.create({ data: row });
    }
  });
}

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);

  const rows = await prisma.documentTypeCatalog.findMany({ orderBy: { orden: 'asc' } });
  original = rows.map((r) => ({
    sigla: r.sigla,
    nombre: r.nombre,
    nivel: r.nivel,
    digitos: r.digitos,
    retencion: r.retencion,
    firma: r.firma,
    orden: r.orden,
  }));
});

afterAll(async () => {
  if (original) await restoreOriginal();
  await disconnectPrisma();
});

describe('GET /document-types', () => {
  it('returns the 5 seeded types ordered by orden', async () => {
    const res = await request(app)
      .get('/document-types')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map((t: { sigla: string }) => t.sigla)).toEqual([
      'PRO',
      'POL',
      'INS',
      'MAN',
      'CHK',
    ]);
    expect(res.body[0]).toMatchObject({ sigla: 'PRO', nombre: 'Procedimiento', digitos: 3 });
  });

  it('is readable by a Lector', async () => {
    const res = await request(app)
      .get('/document-types')
      .set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/document-types')).status).toBe(401);
  });
});

describe('PUT /document-types', () => {
  it('replaces the whole catalog for an admin, renaming a row and dropping one, and audits it', async () => {
    const since = await auditWatermark();
    const next = [
      { sigla: 'PRO', nombre: 'SOP', nivel: 2, digitos: 3, retencion: '5 años', firma: true, orden: 0 },
      { sigla: 'POL', nombre: 'Política', nivel: 1, digitos: 3, retencion: 'Permanente', firma: true, orden: 1 },
      // INS/MAN/CHK intentionally dropped.
    ];

    const res = await request(app)
      .put('/document-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(next);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ sigla: 'PRO', nombre: 'SOP' });

    const rows = await prisma.documentTypeCatalog.findMany();
    expect(rows).toHaveLength(2);

    const entry = await auditSince(
      since,
      'Actualizó el catálogo de tipos de información documentada',
    );
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe('Erick Murillo');

    await restoreOriginal();
  });

  it('403s a Lector and leaves the catalog untouched', async () => {
    const before = await prisma.documentTypeCatalog.count();
    const res = await request(app)
      .put('/document-types')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send([{ sigla: 'HAX', nombre: 'x', nivel: 1, digitos: 3, retencion: 'x', firma: true, orden: 0 }]);
    expect(res.status).toBe(403);
    expect(await prisma.documentTypeCatalog.count()).toBe(before);
  });

  it('400s an empty array and a duplicate sigla', async () => {
    const empty = await request(app)
      .put('/document-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([]);
    expect(empty.status).toBe(400);

    const dup = await request(app)
      .put('/document-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send([
        { sigla: 'PRO', nombre: 'A', nivel: 1, digitos: 3, retencion: 'x', firma: true, orden: 0 },
        { sigla: 'pro', nombre: 'B', nivel: 1, digitos: 3, retencion: 'x', firma: true, orden: 1 },
      ]);
    expect(dup.status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).put('/document-types').send([])).status).toBe(401);
  });
});
