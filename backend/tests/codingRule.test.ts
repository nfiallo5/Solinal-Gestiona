/**
 * `/coding-rule` route tests — the `CodingRule` singleton that drives
 * `src/lib/documentCode.ts`.
 *
 * The seeded row is restored in `afterAll` since this is a shared table
 * `POST /documents` reads on every create.
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
let original: {
  tokens: string[];
  separador: string;
  digitos: number;
  prefijoVer: string;
  formatoAnio: string;
  empresaSigla: string;
  unico: boolean;
  hereda: boolean;
};

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
  await prisma.codingRule.upsert({
    where: { id: 1 },
    create: { id: 1, ...original },
    update: original,
  });
}

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);

  const row = await prisma.codingRule.findUnique({ where: { id: 1 } });
  if (!row) throw new Error('Test DB not seeded (missing CodingRule). Run npm run test:db:reset.');
  original = {
    tokens: row.tokens,
    separador: row.separador,
    digitos: row.digitos,
    prefijoVer: row.prefijoVer,
    formatoAnio: row.formatoAnio,
    empresaSigla: row.empresaSigla,
    unico: row.unico,
    hereda: row.hereda,
  };
});

afterAll(async () => {
  if (createdCodes.length > 0) {
    await prisma.document.deleteMany({ where: { code: { in: createdCodes } } });
  }
  if (original) await restoreOriginal();
  await disconnectPrisma();
});

describe('GET /coding-rule', () => {
  it('returns the seeded default rule (matches TIPO-AREA-NNN)', async () => {
    const res = await request(app).get('/coding-rule').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tokens: ['TIPO', 'PROCESO', 'CORRELATIVO'],
      separador: '-',
      digitos: 3,
    });
  });

  it('is readable by a Lector', async () => {
    const res = await request(app).get('/coding-rule').set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/coding-rule')).status).toBe(401);
  });
});

describe('PUT /coding-rule', () => {
  it('saves a new rule for an admin and audits it', async () => {
    const since = await auditWatermark();
    const next = {
      tokens: ['SIGLA', 'TIPO', 'PROCESO', 'CORRELATIVO'],
      separador: '.',
      digitos: 4,
      prefijoVer: 'R',
      formatoAnio: '2026',
      empresaSigla: 'sol',
      unico: true,
      hereda: false,
    };

    const res = await request(app)
      .put('/coding-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(next);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tokens: ['SIGLA', 'TIPO', 'PROCESO', 'CORRELATIVO'],
      separador: '.',
      digitos: 4,
      empresaSigla: 'SOL', // uppercased server-side
      hereda: false,
    });

    const row = await prisma.codingRule.findUnique({ where: { id: 1 } });
    expect(row?.separador).toBe('.');

    const entry = await auditSince(since, 'Actualizó la regla de codificación');
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe('Erick Murillo');

    await restoreOriginal();
  });

  it('403s a Lector and leaves the rule untouched', async () => {
    const before = await prisma.codingRule.findUnique({ where: { id: 1 } });
    const res = await request(app)
      .put('/coding-rule')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send({ ...original, separador: ':' });
    expect(res.status).toBe(403);
    const after = await prisma.codingRule.findUnique({ where: { id: 1 } });
    expect(after?.separador).toBe(before?.separador);
  });

  it('400s a rule missing CORRELATIVO', async () => {
    const res = await request(app)
      .put('/coding-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, tokens: ['TIPO', 'PROCESO'] });
    expect(res.status).toBe(400);
  });

  it('400s a rule with a duplicated token', async () => {
    const res = await request(app)
      .put('/coding-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, tokens: ['TIPO', 'TIPO', 'CORRELATIVO'] });
    expect(res.status).toBe(400);
  });

  it('400s an invalid separador', async () => {
    const res = await request(app)
      .put('/coding-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, separador: '#' });
    expect(res.status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).put('/coding-rule').send(original)).status).toBe(401);
  });
});

describe('coding rule applied to real document codes', () => {
  it('POST /documents follows a custom saved rule, not the hardcoded TIPO-AREA-NNN shape', async () => {
    await request(app)
      .put('/coding-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tokens: ['SIGLA', 'TIPO', 'PROCESO', 'CORRELATIVO'],
        separador: '_',
        digitos: 4,
        prefijoVer: 'V',
        formatoAnio: '26',
        empresaSigla: 'SOL',
        unico: true,
        hereda: true,
      });

    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        templateKey: null,
        title: 'Prueba de regla de codificación personalizada',
        type: 'Procedimiento',
        area: 'CAL',
        norma: 'ISO 9001:2015',
        critico: false,
      });

    expect(res.status).toBe(201);
    createdCodes.push(res.body.code as string);
    expect(res.body.code).toMatch(/^SOL_PRO_CAL_\d{4}$/);

    await restoreOriginal();
  });

  it('reverts to TIPO-AREA-NNN once the rule is restored to its default', async () => {
    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        templateKey: null,
        title: 'Prueba de regla de codificación por defecto',
        type: 'Procedimiento',
        area: 'CAL',
        norma: 'ISO 9001:2015',
        critico: false,
      });

    expect(res.status).toBe(201);
    createdCodes.push(res.body.code as string);
    expect(res.body.code).toMatch(/^PRO-CAL-\d{3}$/);
  });
});
