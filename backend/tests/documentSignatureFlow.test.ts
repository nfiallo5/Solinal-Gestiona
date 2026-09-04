/**
 * `/document-signature-flow` route tests — the `DocumentSignatureFlowConfig`
 * singleton behind Control Documental's "Flujo de firmas" card (inside "Pie
 * de página").
 *
 * The seeded row is restored in `afterAll`. Nothing reads this config at
 * document-creation or signing time yet, so there is no integration block
 * against `POST /documents` or the signing routes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';

const app = createApp();

const ADMIN = { email: 'admin@solinal.com', password: 'admin2026' };
const LECTOR = { email: 'lector@solinal.com', password: 'lector2026' };

type Etapa = { etapa: string; rol: string; obligatoria: boolean };
type FlowConfig = { participacionDueno: boolean; etapas: [Etapa, Etapa, Etapa] };

let adminToken = '';
let lectorToken = '';
let original: FlowConfig;

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
  await prisma.documentSignatureFlowConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...original },
    update: original,
  });
}

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);

  const res = await request(app)
    .get('/document-signature-flow')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  original = res.body as FlowConfig;
});

afterAll(async () => {
  if (original) await restoreOriginal();
  await disconnectPrisma();
});

describe('GET /document-signature-flow', () => {
  it('returns the seeded defaults: participación del dueño + the 3-stage chain', async () => {
    const res = await request(app)
      .get('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.participacionDueno).toBe(true);
    expect(res.body.etapas).toHaveLength(3);
    expect(res.body.etapas.map((e: Etapa) => e.etapa)).toEqual(['Elaboró', 'Revisó', 'Aprobó']);
    expect(res.body.etapas[0]).toMatchObject({ rol: 'Dueño de proceso', obligatoria: true });
    expect(res.body.etapas[2]).toMatchObject({ rol: 'Alta dirección', obligatoria: true });
  });

  it('is readable by a Lector', async () => {
    const res = await request(app)
      .get('/document-signature-flow')
      .set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/document-signature-flow')).status).toBe(401);
  });
});

describe('PUT /document-signature-flow', () => {
  it('saves a new flow for an admin and audits it', async () => {
    const since = await auditWatermark();
    const next: FlowConfig = {
      participacionDueno: false,
      etapas: [
        { etapa: 'Elaboró', rol: 'Coordinador de calidad', obligatoria: true },
        { etapa: 'Revisó', rol: 'Administrador', obligatoria: false },
        { etapa: 'Aprobó', rol: 'Alta dirección', obligatoria: true },
      ],
    };

    const res = await request(app)
      .put('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(next);

    expect(res.status).toBe(200);
    expect(res.body.participacionDueno).toBe(false);
    expect(res.body.etapas[1]).toMatchObject({ rol: 'Administrador', obligatoria: false });

    const row = await prisma.documentSignatureFlowConfig.findUnique({ where: { id: 1 } });
    expect(row?.participacionDueno).toBe(false);

    const entry = await auditSince(since, 'Actualizó el flujo de firmas de documentos');
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe('Erick Murillo');

    await restoreOriginal();
  });

  it('403s a Lector and leaves the config untouched', async () => {
    const before = await prisma.documentSignatureFlowConfig.findUnique({ where: { id: 1 } });
    const res = await request(app)
      .put('/document-signature-flow')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send({ ...original, participacionDueno: false });
    expect(res.status).toBe(403);
    const after = await prisma.documentSignatureFlowConfig.findUnique({ where: { id: 1 } });
    expect(after?.participacionDueno).toBe(before?.participacionDueno);
  });

  it('400s a wrong stage count', async () => {
    const res = await request(app)
      .put('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, etapas: original.etapas.slice(0, 2) });
    expect(res.status).toBe(400);
  });

  it('400s stages out of order', async () => {
    const [elaboro, reviso, aprobo] = original.etapas;
    const res = await request(app)
      .put('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, etapas: [reviso, elaboro, aprobo] });
    expect(res.status).toBe(400);
  });

  it('400s an unknown rol', async () => {
    const [elaboro, reviso, aprobo] = original.etapas;
    const res = await request(app)
      .put('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, etapas: [{ ...elaboro, rol: 'CEO' }, reviso, aprobo] });
    expect(res.status).toBe(400);
  });

  it('400s an unexpected top-level key (strict)', async () => {
    const res = await request(app)
      .put('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...original, dobleAprobacion: true });
    expect(res.status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).put('/document-signature-flow').send(original)).status).toBe(401);
  });
});

describe('an edited signature flow survives a round-trip', () => {
  it('persists a rol + obligatoria change through GET', async () => {
    const [elaboro, reviso, aprobo] = original.etapas;
    const edited: FlowConfig = {
      participacionDueno: original.participacionDueno,
      etapas: [elaboro, { ...reviso, rol: 'Administrador', obligatoria: false }, aprobo],
    };

    const put = await request(app)
      .put('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(edited);
    expect(put.status).toBe(200);

    const get = await request(app)
      .get('/document-signature-flow')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(200);
    expect(get.body.etapas[1]).toMatchObject({ rol: 'Administrador', obligatoria: false });

    await restoreOriginal();
  });
});
