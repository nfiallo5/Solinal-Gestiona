/**
 * `/document-header` route tests — the `DocumentHeaderConfig` singleton behind
 * Control Documental's "Encabezado" tab.
 *
 * The seeded row is restored in `afterAll`. Nothing reads this config at
 * document-creation time yet, so there is no `POST /documents` integration
 * block (unlike `/coding-rule`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';

const app = createApp();

const ADMIN = { email: 'admin@solinal.com', password: 'admin2026' };
const LECTOR = { email: 'lector@solinal.com', password: 'lector2026' };

type HeaderConfig = {
  tpl: string;
  campos: Record<string, boolean>;
  bordes: string;
  repetir: boolean;
};

let adminToken = '';
let lectorToken = '';
let original: HeaderConfig;

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
  await prisma.documentHeaderConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...original },
    update: original,
  });
}

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);

  const res = await request(app)
    .get('/document-header')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  original = res.body as HeaderConfig;
});

afterAll(async () => {
  if (original) await restoreOriginal();
  await disconnectPrisma();
});

describe('GET /document-header', () => {
  it('returns the seeded header defaults', async () => {
    const res = await request(app)
      .get('/document-header')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tpl: 'tripartito', bordes: 'completo', repetir: true });
    expect(res.body.campos.titulo).toBe(true);
    expect(res.body.campos.objetivo).toBe(false);
    expect(Object.keys(res.body.campos)).toHaveLength(20);
  });

  it('is readable by a Lector', async () => {
    const res = await request(app)
      .get('/document-header')
      .set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/document-header')).status).toBe(401);
  });
});

describe('PUT /document-header', () => {
  it('saves a new header config for an admin and audits it', async () => {
    const since = await auditWatermark();
    const next: HeaderConfig = {
      tpl: 'linea',
      bordes: 'suave',
      repetir: false,
      campos: { ...original.campos, objetivo: true, logo: false },
    };

    const res = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(next);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tpl: 'linea', bordes: 'suave', repetir: false });
    expect(res.body.campos.objetivo).toBe(true);
    expect(res.body.campos.logo).toBe(false);

    const row = await prisma.documentHeaderConfig.findUnique({ where: { id: 1 } });
    expect(row?.tpl).toBe('linea');
    expect((row?.campos as Record<string, boolean>).objetivo).toBe(true);

    const entry = await auditSince(since, 'Actualizó la plantilla de encabezado de documentos');
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe('Erick Murillo');

    await restoreOriginal();
  });

  it('403s a Lector and leaves the config untouched', async () => {
    const before = await prisma.documentHeaderConfig.findUnique({ where: { id: 1 } });
    const res = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send({ ...original, tpl: 'institucional' });
    expect(res.status).toBe(403);
    const after = await prisma.documentHeaderConfig.findUnique({ where: { id: 1 } });
    expect(after?.tpl).toBe(before?.tpl);
  });

  it('400s an unknown header template', async () => {
    const res = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, tpl: 'holográfico' });
    expect(res.status).toBe(400);
  });

  it('400s an invalid bordes value', async () => {
    const res = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, bordes: 'punteado' });
    expect(res.status).toBe(400);
  });

  it('400s an unknown campos key (strict)', async () => {
    const res = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, campos: { ...original.campos, firmaHolografica: true } });
    expect(res.status).toBe(400);
  });

  it('400s a campos object missing a key', async () => {
    const partial = { ...original.campos };
    delete partial.titulo;
    const res = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, campos: partial });
    expect(res.status).toBe(400);
  });

  it('400s an unexpected top-level key (strict)', async () => {
    const res = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, colorTitulo: '#123456' });
    expect(res.status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).put('/document-header').send(original)).status).toBe(401);
  });
});

describe('an edited header config survives a round-trip', () => {
  it('persists a template + field change through GET', async () => {
    const edited: HeaderConfig = {
      tpl: 'proceso',
      bordes: original.bordes,
      repetir: original.repetir,
      campos: { ...original.campos, idioma: true, medio: true },
    };

    const put = await request(app)
      .put('/document-header')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(edited);
    expect(put.status).toBe(200);

    const get = await request(app)
      .get('/document-header')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.tpl).toBe('proceso');
    expect(get.body.campos.idioma).toBe(true);
    expect(get.body.campos.medio).toBe(true);

    await restoreOriginal();
  });
});
