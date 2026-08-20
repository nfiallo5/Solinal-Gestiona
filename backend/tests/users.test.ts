/**
 * `/users` route tests — listing, admin-only creation (incl. the generated
 * temporary password), role reassignment, and the admin unlock gate.
 *
 * Every user created here is removed in `afterAll`; seed users are never
 * mutated, so the other agents' suites keep seeing the baseline roles.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { initialsOf } from '../src/routes/users.js';

const app = createApp();

const ADMIN = { email: 'admin@solinal.com', password: 'admin2026' };
const LECTOR = { email: 'lector@solinal.com', password: 'lector2026' };
const ELABORADOR = { email: 'elaborador@solinal.com', password: 'elaborador2026' };

/** Names/emails owned by this suite, cleaned up at the end. */
const TEST_EMAIL_PREFIX = 'usertest-';
const TEST_NAME_PREFIX = 'Usuario Prueba';

let adminToken = '';
let lectorToken = '';
let elaboradorToken = '';

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
  elaboradorToken = await login(ELABORADOR);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  await disconnectPrisma();
});

let counter = 0;
function freshUser(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    name: `${TEST_NAME_PREFIX} ${counter} Alfa`,
    email: `${TEST_EMAIL_PREFIX}${counter}@solinal.com`,
    role: 'Elaborador',
    status: 'Activo',
    notes: 'Planta Central',
    ...overrides,
  };
}

describe('initialsOf (port of roleTheme.ts)', () => {
  it('matches the frontend implementation', () => {
    expect(initialsOf('Ana Torres')).toBe('AT');
    expect(initialsOf('  Erick   Murillo ')).toBe('EM');
    // Frontend slices to 3, not 2 — reproduced faithfully. See NOTES.md § 20.
    expect(initialsOf('Maria Jose Del Campo')).toBe('MJD');
  });
});

describe('GET /users', () => {
  it('lists users for any authenticated role, without secrets', async () => {
    const res = await request(app).get('/users').set('Authorization', `Bearer ${lectorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    const admin = res.body.find((u: { email: string }) => u.email === ADMIN.email);
    expect(admin.role).toBe('Administrador');
    for (const u of res.body) {
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('failedAttempts');
      expect(u).not.toHaveProperty('lockedAt');
    }
  });

  it('401s without a token', async () => {
    expect((await request(app).get('/users')).status).toBe(401);
  });
});

describe('POST /users', () => {
  it('creates a user, derives `short`, and returns a one-time temporary password', async () => {
    const payload = freshUser();
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe(payload.name);
    expect(res.body.user.short).toBe(initialsOf(payload.name));
    expect(res.body.user.status).toBe('Activo');
    expect(res.body.user.notes).toBe('Planta Central');
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const temp = res.body.temporaryPassword as string;
    expect(typeof temp).toBe('string');
    expect(temp.length).toBeGreaterThanOrEqual(10);

    // The generated password actually works.
    const login = await request(app)
      .post('/auth/login')
      .send({ email: payload.email, password: temp });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('Elaborador');
  });

  it('accepts an explicit password and then does NOT return one', async () => {
    const payload = freshUser({ password: 'Contrasena2026' });
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('temporaryPassword');

    const login = await request(app)
      .post('/auth/login')
      .send({ email: payload.email, password: 'Contrasena2026' });
    expect(login.status).toBe(200);
  });

  it('422s an explicit password that violates the org password policy', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(freshUser({ password: 'corta' }));
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/política/i);
  });

  it('409s a duplicate name (User.name is @unique) case-insensitively', async () => {
    const payload = freshUser();
    expect(
      (
        await request(app)
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(payload)
      ).status,
    ).toBe(201);

    const dup = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...freshUser(), name: payload.name.toUpperCase() });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/nombre/i);
  });

  it('409s a duplicate email', async () => {
    const payload = freshUser();
    await request(app).post('/users').set('Authorization', `Bearer ${adminToken}`).send(payload);
    const dup = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...freshUser(), email: payload.email });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/correo/i);
  });

  it('403s a non-admin AND writes the "Intento no autorizado" audit entry', async () => {
    const payload = freshUser();
    const since = await auditWatermark();
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${elaboradorToken}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { email: payload.email } })).toBeNull();

    const entry = await auditSince(since, `Intento no autorizado de registrar el usuario ${payload.name}`);
    expect(entry).not.toBeNull();
    expect(entry?.role).toBe('Elaborador');
  });

  it('403s a Lector too', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${lectorToken}`)
      .send(freshUser());
    expect(res.status).toBe(403);
  });

  it('400s a malformed body for an admin', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', email: 'no-es-un-correo', role: 'Emperador' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /users/:id/role', () => {
  async function createTarget() {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(freshUser({ role: 'Lector' }));
    expect(res.status).toBe(201);
    return res.body.user as { id: string; name: string };
  }

  it('reassigns the role for an admin and reports isSelf=false', async () => {
    const target = await createTarget();
    const since = await auditWatermark();
    const res = await request(app)
      .patch(`/users/${target.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Revisor' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('Revisor');
    expect(res.body.isSelf).toBe(false);

    const entry = await auditSince(since, `Cambió el rol del usuario ${target.name} a Revisor`);
    expect(entry).not.toBeNull();
  });

  it('reports isSelf=true when an admin edits their own row', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN.email } });
    const res = await request(app)
      .patch(`/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Administrador' }); // no-op role, keeps the seed intact
    expect(res.status).toBe(200);
    expect(res.body.isSelf).toBe(true);
    expect(res.body.user.role).toBe('Administrador');
  });

  it('403s a non-admin AND audits the rejected attempt', async () => {
    const target = await createTarget();
    const since = await auditWatermark();
    const res = await request(app)
      .patch(`/users/${target.id}/role`)
      .set('Authorization', `Bearer ${elaboradorToken}`)
      .send({ role: 'Administrador' });

    expect(res.status).toBe(403);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.role).toBe('Lector');

    const entry = await auditSince(since, `Intento no autorizado de cambiar el rol del usuario ${target.id}`);
    expect(entry).not.toBeNull();
  });

  it('404s an unknown user and 400s a non-uuid id', async () => {
    const missing = await request(app)
      .patch('/users/00000000-0000-4000-8000-000000000000/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Revisor' });
    expect(missing.status).toBe(404);

    const bad = await request(app)
      .patch('/users/not-a-uuid/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Revisor' });
    expect(bad.status).toBe(400);
  });
});

describe('POST /users/:id/unlock', () => {
  it('403s a non-admin', async () => {
    const target = await prisma.user.findUniqueOrThrow({ where: { email: LECTOR.email } });
    const since = await auditWatermark();
    const res = await request(app)
      .post(`/users/${target.id}/unlock`)
      .set('Authorization', `Bearer ${elaboradorToken}`);
    expect(res.status).toBe(403);

    const entry = await auditSince(since, `Intento no autorizado de desbloquear la cuenta ${target.id}`);
    expect(entry).not.toBeNull();
  });

  it('reports unlocked=false when the account was not locked', async () => {
    const created = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(freshUser());
    const res = await request(app)
      .post(`/users/${created.body.user.id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.unlocked).toBe(false);
  });
});
