/**
 * `/document-footer` route tests — the `DocumentFooterConfig` singleton behind
 * Control Documental's "Pie de página" tab.
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

type FooterConfig = {
  tpl: string;
  clasificacion: string;
  leyenda: string;
  qr: boolean;
  hash: boolean;
  impresion: boolean;
  mostrarCargo: boolean;
  mostrarFecha: boolean;
};

let adminToken = '';
let lectorToken = '';
let original: FooterConfig;

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
  await prisma.documentFooterConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...original },
    update: original,
  });
}

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);

  const res = await request(app)
    .get('/document-footer')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  original = res.body as FooterConfig;
});

afterAll(async () => {
  if (original) await restoreOriginal();
  await disconnectPrisma();
});

describe('GET /document-footer', () => {
  it('returns the seeded footer defaults', async () => {
    const res = await request(app)
      .get('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tpl: 'firmasTabla',
      clasificacion: 'Documento de uso interno',
      qr: true,
      hash: false,
      impresion: true,
      mostrarCargo: true,
      mostrarFecha: true,
    });
    expect(res.body.leyenda).toContain('COPIA NO CONTROLADA');
  });

  it('is readable by a Lector', async () => {
    const res = await request(app)
      .get('/document-footer')
      .set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/document-footer')).status).toBe(401);
  });
});

describe('PUT /document-footer', () => {
  it('saves a new footer config for an admin and audits it', async () => {
    const since = await auditWatermark();
    const next: FooterConfig = {
      tpl: 'barra',
      clasificacion: 'Confidencial',
      leyenda: 'Uso exclusivo de Aseguramiento de la Calidad.',
      qr: false,
      hash: true,
      impresion: false,
      mostrarCargo: false,
      mostrarFecha: false,
    };

    const res = await request(app)
      .put('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(next);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(next);

    const row = await prisma.documentFooterConfig.findUnique({ where: { id: 1 } });
    expect(row?.tpl).toBe('barra');
    expect(row?.clasificacion).toBe('Confidencial');
    expect(row?.hash).toBe(true);

    const entry = await auditSince(since, 'Actualizó la plantilla de pie de página de documentos');
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe('Erick Murillo');

    await restoreOriginal();
  });

  it('403s a Lector and leaves the config untouched', async () => {
    const before = await prisma.documentFooterConfig.findUnique({ where: { id: 1 } });
    const res = await request(app)
      .put('/document-footer')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send({ ...original, tpl: 'vigor' });
    expect(res.status).toBe(403);
    const after = await prisma.documentFooterConfig.findUnique({ where: { id: 1 } });
    expect(after?.tpl).toBe(before?.tpl);
  });

  it('400s an unknown footer template', async () => {
    const res = await request(app)
      .put('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, tpl: 'holográfico' });
    expect(res.status).toBe(400);
  });

  it('400s an unknown clasificación', async () => {
    const res = await request(app)
      .put('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, clasificacion: 'Alto secreto' });
    expect(res.status).toBe(400);
  });

  it('400s a leyenda over 500 characters', async () => {
    const res = await request(app)
      .put('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, leyenda: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('400s an unexpected top-level key (strict)', async () => {
    const res = await request(app)
      .put('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, firma: 'manuscrita' });
    expect(res.status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).put('/document-footer').send(original)).status).toBe(401);
  });
});

describe('an edited footer config survives a round-trip', () => {
  it('persists a template + content change through GET', async () => {
    const edited: FooterConfig = {
      ...original,
      tpl: 'vigor',
      leyenda: 'Documento de referencia para la auditoría interna 2026.',
    };

    const put = await request(app)
      .put('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(edited);
    expect(put.status).toBe(200);

    const get = await request(app)
      .get('/document-footer')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.tpl).toBe('vigor');
    expect(get.body.leyenda).toBe('Documento de referencia para la auditoría interna 2026.');

    await restoreOriginal();
  });
});
