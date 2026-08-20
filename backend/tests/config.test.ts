/**
 * `/config` route tests — the OrgConfig singleton and its admin-only write.
 *
 * The singleton is restored to its pre-suite values in `afterAll`, because the
 * other suites read `doubleApproval` and `passwordPolicy` from it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';

const app = createApp();

const ADMIN = { email: 'admin@solinal.com', password: 'admin2026' };
const LECTOR = { email: 'lector@solinal.com', password: 'lector2026' };
const APROBADOR = { email: 'aprobador@solinal.com', password: 'aprobador2026' };

let adminToken = '';
let lectorToken = '';
let aprobadorToken = '';
let original: {
  orgName: string;
  brandColor: string;
  twoFactorEnabled: boolean;
  passwordPolicy: 'weak' | 'medium' | 'strong';
  doubleApproval: 'none' | 'critical' | 'all';
};

/**
 * The other agents' suites write to the same audit table, so "the newest row
 * is mine" is racy. Assert on "a row matching this text appeared after this
 * watermark" instead.
 */
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

beforeAll(async () => {
  adminToken = await login(ADMIN);
  lectorToken = await login(LECTOR);
  aprobadorToken = await login(APROBADOR);

  const row = await prisma.orgConfig.findFirstOrThrow();
  original = {
    orgName: row.orgName,
    brandColor: row.brandColor,
    twoFactorEnabled: row.twoFactorEnabled,
    passwordPolicy: row.passwordPolicy,
    doubleApproval: row.doubleApproval,
  };
});

afterAll(async () => {
  if (original) {
    await prisma.orgConfig.update({ where: { id: 1 }, data: original });
  }
  await disconnectPrisma();
});

describe('GET /config', () => {
  it('returns the five OrgConfig fields the config screens use', async () => {
    const res = await request(app).get('/config').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['brandColor', 'doubleApproval', 'orgName', 'passwordPolicy', 'twoFactorEnabled'].sort(),
    );
    expect(res.body.orgName).toBe('Solinal S.A.');
  });

  it('is readable by a Lector — brandColor/doubleApproval are needed outside the config page', async () => {
    const res = await request(app).get('/config').set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/config')).status).toBe(401);
  });
});

describe('PATCH /config', () => {
  it('applies a partial update for an admin and audits it', async () => {
    const since = await auditWatermark();
    const res = await request(app)
      .patch('/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgName: 'Solinal S.A. (prueba)', twoFactorEnabled: true, doubleApproval: 'all' });

    expect(res.status).toBe(200);
    expect(res.body.orgName).toBe('Solinal S.A. (prueba)');
    expect(res.body.twoFactorEnabled).toBe(true);
    expect(res.body.doubleApproval).toBe('all');
    // Untouched fields keep their value.
    expect(res.body.brandColor).toBe(original.brandColor);

    const entry = await auditSince(
      since,
      'Actualizó políticas de seguridad e identidad visual del sistema',
    );
    expect(entry).not.toBeNull();

    // Restore immediately so a later failure cannot leak state.
    await prisma.orgConfig.update({ where: { id: 1 }, data: original });
  });

  it('403s a Lector and audits the rejected attempt', async () => {
    const since = await auditWatermark();
    const res = await request(app)
      .patch('/config')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send({ orgName: 'Hackeado' });
    expect(res.status).toBe(403);

    const entry = await auditSince(
      since,
      'Intento no autorizado de modificar la configuración del sistema por Lector Simulado',
    );
    expect(entry?.role).toBe('Lector');

    const row = await prisma.orgConfig.findFirstOrThrow();
    expect(row.orgName).toBe(original.orgName);
  });

  it('403s a non-admin who is not a Lector either (Administrador is not implicit anywhere else)', async () => {
    const res = await request(app)
      .patch('/config')
      .set('Authorization', `Bearer ${aprobadorToken}`)
      .send({ passwordPolicy: 'weak' });
    expect(res.status).toBe(403);
  });

  it('400s an invalid brand color, an unknown enum value, and unknown keys', async () => {
    const bad = (body: object) =>
      request(app).patch('/config').set('Authorization', `Bearer ${adminToken}`).send(body);

    expect((await bad({ brandColor: 'azul' })).status).toBe(400);
    expect((await bad({ passwordPolicy: 'ultra' })).status).toBe(400);
    expect((await bad({ nuevaClave: true })).status).toBe(400);
    expect((await bad({})).status).toBe(400);
  });

  it('401s without a token', async () => {
    expect((await request(app).patch('/config').send({ orgName: 'X' })).status).toBe(401);
  });
});
