/**
 * Regulation alerts — the data-driven replacement for
 * `NORMA_CON_CAMBIO_PENDIENTE` / `REGULATION_UPDATE_MARKER` in
 * `src/features/editor/aiEngine.ts`, plus the per-document banner predicate and
 * `POST /documents/:code/apply-regulation`.
 *
 * Fixtures are namespaced (`RAT-` codes, an `ISO TEST:2099` norm) so nothing
 * here depends on or disturbs the seeded ISO 22000:2018 alert.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { RoleName } from '@prisma/client';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();

const PREFIX = 'RAT-';
const USER_TAG = '[ra-test]';
const TEST_NORMA = 'ISO TEST:2099';
const TEST_MARKER = '[ACTUALIZACIÓN DE PRUEBA ISO TEST:2100]';
const TEST_BODY = `<p><strong>${TEST_MARKER}</strong></p><ul><li>Enmienda de prueba.</li></ul>`;
const INACTIVE_NORMA = 'ISO TEST:2098';
const INACTIVE_MARKER = '[ACTUALIZACIÓN INACTIVA DE PRUEBA]';

interface TestUser {
  id: string;
  name: string;
  token: string;
}

let editor: TestUser;
let lector: TestUser;
let alertId: number;
let codeCounter = 0;

async function makeUser(key: string, role: RoleName): Promise<TestUser> {
  const name = `${USER_TAG} ${key}`;
  const email = `ra-test-${key}@solinal.test`;
  const row = await prisma.user.upsert({
    where: { email },
    create: { name, short: 'RT', email, passwordHash: 'x', role },
    update: { name, role, lockedAt: null, failedAttempts: 0 },
  });
  return {
    id: row.id,
    name: row.name,
    token: signToken({ sub: row.id, email: row.email, name: row.name, role: row.role }),
  };
}

async function makeDoc(norma: string, content: string): Promise<string> {
  const code = `${PREFIX}${Date.now()}-${codeCounter++}`;
  await prisma.document.create({
    data: {
      code,
      title: 'Documento de prueba de normativa',
      type: 'Política',
      norma,
      estado: 'Borrador',
      version: 'v1.0',
      creadorId: editor.id,
      creador: editor.name,
      content,
    },
  });
  return code;
}

const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });

beforeAll(async () => {
  editor = await makeUser('editor', 'Elaborador');
  lector = await makeUser('lector', 'Lector');

  const alert = await prisma.regulationAlert.upsert({
    where: { norma_marker: { norma: TEST_NORMA, marker: TEST_MARKER } },
    create: { norma: TEST_NORMA, marker: TEST_MARKER, bodyHtml: TEST_BODY, active: true },
    update: { bodyHtml: TEST_BODY, active: true },
  });
  alertId = alert.id;

  await prisma.regulationAlert.upsert({
    where: { norma_marker: { norma: INACTIVE_NORMA, marker: INACTIVE_MARKER } },
    create: {
      norma: INACTIVE_NORMA,
      marker: INACTIVE_MARKER,
      bodyHtml: '<p>inactiva</p>',
      active: false,
    },
    update: { active: false },
  });
});

afterAll(async () => {
  await prisma.document.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.regulationAlert.deleteMany({ where: { norma: { in: [TEST_NORMA, INACTIVE_NORMA] } } });
  await prisma.auditLogEntry.deleteMany({ where: { user: { startsWith: USER_TAG } } });
  await prisma.user.deleteMany({ where: { name: { startsWith: USER_TAG } } });
  await disconnectPrisma();
});

// ---------------------------------------------------------------------------
// GET /regulation-alerts
// ---------------------------------------------------------------------------

describe('GET /regulation-alerts', () => {
  it('401s without a token', async () => {
    await request(app).get('/regulation-alerts').expect(401);
  });

  it('filters by norma and returns the exact marker/bodyHtml', async () => {
    const res = await request(app)
      .get('/regulation-alerts')
      .query({ norma: TEST_NORMA })
      .set(auth(editor));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: alertId,
      norma: TEST_NORMA,
      marker: TEST_MARKER,
      bodyHtml: TEST_BODY,
      active: true,
    });
  });

  it('hides inactive alerts unless includeInactive=true', async () => {
    const active = await request(app)
      .get('/regulation-alerts')
      .query({ norma: INACTIVE_NORMA })
      .set(auth(editor));
    expect(active.body).toHaveLength(0);

    const all = await request(app)
      .get('/regulation-alerts')
      .query({ norma: INACTIVE_NORMA, includeInactive: 'true' })
      .set(auth(editor));
    expect(all.body).toHaveLength(1);
    expect(all.body[0].active).toBe(false);
  });

  it('is readable by a Lector', async () => {
    const res = await request(app).get('/regulation-alerts').set(auth(lector));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('exposes the seeded ISO 22000:2018 alert', async () => {
    const res = await request(app)
      .get('/regulation-alerts')
      .query({ norma: 'ISO 22000:2018' })
      .set(auth(editor));
    if (res.body.length === 0) return; // test DB not seeded
    expect(res.body[0].marker).toBe('[ACTUALIZACIÓN REGULATORIA AUTOMÁTICA ISO 22000:2026]');
  });
});

// ---------------------------------------------------------------------------
// GET /documents/:code/regulation-alert — the banner predicate
// ---------------------------------------------------------------------------

describe('GET /documents/:code/regulation-alert', () => {
  it('returns the alert when the norma matches and the marker is absent', async () => {
    const code = await makeDoc(TEST_NORMA, '<p>sin la enmienda</p>');
    const res = await request(app).get(`/documents/${code}/regulation-alert`).set(auth(editor));

    expect(res.status).toBe(200);
    expect(res.body.alert?.marker).toBe(TEST_MARKER);
  });

  it('returns null once the content already contains the marker', async () => {
    const code = await makeDoc(TEST_NORMA, `<p>ya aplicado</p>${TEST_BODY}`);
    const res = await request(app).get(`/documents/${code}/regulation-alert`).set(auth(editor));

    expect(res.status).toBe(200);
    expect(res.body.alert).toBeNull();
  });

  it('returns null for a norma with no active alert', async () => {
    const code = await makeDoc('ISO 9001:2015', '<p>nada pendiente</p>');
    const res = await request(app).get(`/documents/${code}/regulation-alert`).set(auth(editor));
    expect(res.body.alert).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /documents/:code/apply-regulation
// ---------------------------------------------------------------------------

describe('POST /documents/:code/apply-regulation', () => {
  it('appends the alert bodyHtml, bumps contentVersion and audits', async () => {
    const code = await makeDoc(TEST_NORMA, '<p>base</p>');
    const res = await request(app)
      .post(`/documents/${code}/apply-regulation`)
      .set(auth(editor));

    expect(res.status).toBe(200);
    expect(res.body.document.content).toBe(`<p>base</p>${TEST_BODY}`);
    expect(res.body.document.contentVersion).toBe(1);
    expect(res.body.alert.marker).toBe(TEST_MARKER);

    const entry = await prisma.auditLogEntry.findFirst({
      where: { action: { contains: code } },
      orderBy: { id: 'desc' },
    });
    expect(entry?.action).toBe(
      `Aplicó la actualización regulatoria de ${TEST_NORMA} en el documento ${code}`,
    );
  });

  it('409s instead of appending the block twice', async () => {
    const code = await makeDoc(TEST_NORMA, '<p>base</p>');
    await request(app).post(`/documents/${code}/apply-regulation`).set(auth(editor)).expect(200);

    const res = await request(app).post(`/documents/${code}/apply-regulation`).set(auth(editor));
    expect(res.status).toBe(409);

    const row = await prisma.document.findUniqueOrThrow({ where: { code } });
    expect(row.content.split(TEST_MARKER).length - 1).toBe(1);
  });

  it('404s when the norma has no active alert', async () => {
    const code = await makeDoc('ISO 9001:2015', '<p>base</p>');
    const res = await request(app).post(`/documents/${code}/apply-regulation`).set(auth(editor));
    expect(res.status).toBe(404);
  });

  it('403s for a Lector', async () => {
    const code = await makeDoc(TEST_NORMA, '<p>base</p>');
    const res = await request(app).post(`/documents/${code}/apply-regulation`).set(auth(lector));
    expect(res.status).toBe(403);
  });
});
