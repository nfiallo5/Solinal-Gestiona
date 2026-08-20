/**
 * `/auth` route tests — login, the 3-strike lockout, unlock, /me, logout.
 *
 * These run against the seeded `solinal_gestiona_test` database
 * (`npm run test:db:reset`). Anything mutated here is restored in `afterAll`
 * so the other agents' suites see the baseline.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { MAX_FAILED_ATTEMPTS } from '../src/routes/auth.js';

const app = createApp();

const ADMIN = { email: 'admin@solinal.com', password: 'admin2026', name: 'Erick Murillo' };
/** Deliberately not the admin: this account gets locked mid-suite. */
const VICTIM = { email: 'revisor@solinal.com', password: 'revisor2026', name: 'Ana Torres' };

async function resetLockout(email: string) {
  await prisma.user.updateMany({ where: { email }, data: { failedAttempts: 0, lockedAt: null } });
}

/**
 * The other agents' suites write to the same audit table, so "the newest row
 * is mine" and "the count went up by exactly one" are both racy. Assert on
 * "a row matching this text appeared after this watermark" instead.
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

beforeAll(async () => {
  await resetLockout(ADMIN.email);
  await resetLockout(VICTIM.email);
});

afterAll(async () => {
  await resetLockout(ADMIN.email);
  await resetLockout(VICTIM.email);
  await disconnectPrisma();
});

describe('POST /auth/login', () => {
  it('accepts a seeded demo credential and returns a token + user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.name).toBe(ADMIN.name);
    expect(res.body.user.role).toBe('Administrador');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('failedAttempts');
    expect(res.body.user).not.toHaveProperty('lockedAt');
  });

  it('is case-insensitive on the email, like findCredential() was', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: '  ADMIN@Solinal.com ', password: ADMIN.password });
    expect(res.status).toBe(200);
  });

  it('writes an audit entry on success', async () => {
    const since = await auditWatermark();
    await request(app).post('/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    const entry = await auditSince(since, `Inicio de sesión (credenciales) como ${ADMIN.name}`);
    expect(entry).not.toBeNull();
    expect(entry?.role).toBe('Administrador');
  });

  it('rejects a wrong password with 401 and logs the failed attempt', async () => {
    const since = await auditWatermark();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN.email, password: 'definitivamente-incorrecta' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/incorrectos/i);
    expect(res.body.error.details.remainingAttempts).toBe(MAX_FAILED_ATTEMPTS - 1);

    const entry = await auditSince(since, 'Intento fallido de inicio de sesión');
    expect(entry?.action).toContain(ADMIN.name);

    // A later success must clear the counter again for the rest of the suite.
    await request(app).post('/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    const user = await prisma.user.findUnique({ where: { email: ADMIN.email } });
    expect(user?.failedAttempts).toBe(0);
  });

  it('rejects an unknown email with 401 and records a userless LoginAttempt', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nadie@solinal.com', password: 'x' });
    expect(res.status).toBe(401);

    const attempt = await prisma.loginAttempt.findFirst({
      where: { email: 'nadie@solinal.com' },
      orderBy: { id: 'desc' },
    });
    expect(attempt?.userId).toBeNull();
    expect(attempt?.success).toBe(false);
  });

  it('400s a malformed body', async () => {
    const res = await request(app).post('/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
  });
});

describe('server-side lockout (port of REGISTER_FAILED_ATTEMPT / LOCK_SYSTEM)', () => {
  it(`locks the account after ${MAX_FAILED_ATTEMPTS} failures and 423s afterwards`, async () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(3); // matches the frontend's hardcoded 3

    const since = await auditWatermark();
    const statuses: number[] = [];
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: VICTIM.email, password: 'mal' });
      statuses.push(res.status);
    }
    // The first two are plain 401s; the one that trips the threshold is 423.
    expect(statuses.slice(0, MAX_FAILED_ATTEMPTS - 1).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(423);

    const locked = await prisma.user.findUnique({ where: { email: VICTIM.email } });
    expect(locked?.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(locked?.lockedAt).not.toBeNull();

    // Crucially: the CORRECT password is also refused while locked. This is
    // the bug being fixed — the client-side version was bypassed by reloading.
    const correct = await request(app)
      .post('/auth/login')
      .send({ email: VICTIM.email, password: VICTIM.password });
    expect(correct.status).toBe(423);
    expect(correct.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    const audit = await auditSince(since, `Cuenta ${VICTIM.email} bloqueada`);
    expect(audit).not.toBeNull();
  });

  it('an admin can unlock the account via POST /users/:id/unlock', async () => {
    const admin = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password });
    const victim = await prisma.user.findUniqueOrThrow({ where: { email: VICTIM.email } });

    const unlock = await request(app)
      .post(`/users/${victim.id}/unlock`)
      .set('Authorization', `Bearer ${admin.body.token}`);

    expect(unlock.status).toBe(200);
    expect(unlock.body.unlocked).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({ where: { email: VICTIM.email } });
    expect(after.lockedAt).toBeNull();
    expect(after.failedAttempts).toBe(0);

    const relogin = await request(app)
      .post('/auth/login')
      .send({ email: VICTIM.email, password: VICTIM.password });
    expect(relogin.status).toBe(200);
  });

  it('an expired lock lets the user back in without admin help', async () => {
    // Backdate the lock past the auto-expiry window instead of waiting 15 min.
    await prisma.user.update({
      where: { email: VICTIM.email },
      data: { failedAttempts: MAX_FAILED_ATTEMPTS, lockedAt: new Date(Date.now() - 60 * 60_000) },
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: VICTIM.email, password: VICTIM.password });

    expect(res.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { email: VICTIM.email } });
    expect(after.lockedAt).toBeNull();
    expect(after.failedAttempts).toBe(0);
  });

  it('requireAuth honours the lock expiry window, not just a non-null lockedAt', async () => {
    // Regression for NOTES.md § 17: requireAuth used a bare `if (user.lockedAt)`
    // while login used the expiry window, so a token holder whose lock had
    // already elapsed kept getting 423 on every authenticated route.
    const login = await request(app)
      .post('/auth/login')
      .send({ email: VICTIM.email, password: VICTIM.password });
    expect(login.status).toBe(200);
    const token: string = login.body.token;

    // Lock still inside the window -> the live token must be refused.
    await prisma.user.update({
      where: { email: VICTIM.email },
      data: { failedAttempts: MAX_FAILED_ATTEMPTS, lockedAt: new Date() },
    });
    const whileLocked = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(whileLocked.status).toBe(423);

    // Same lock, backdated past the window -> the same token must work again.
    await prisma.user.update({
      where: { email: VICTIM.email },
      data: { lockedAt: new Date(Date.now() - 60 * 60_000) },
    });
    const afterExpiry = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(afterExpiry.status).toBe(200);
  });

  it('a successful login resets a partial failure count', async () => {
    await request(app).post('/auth/login').send({ email: VICTIM.email, password: 'mal' });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: VICTIM.email } })).failedAttempts)
      .toBe(1);

    await request(app).post('/auth/login').send({ email: VICTIM.email, password: VICTIM.password });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: VICTIM.email } })).failedAttempts)
      .toBe(0);
  });
});

describe('GET /auth/me', () => {
  it('rehydrates the session from the bearer token', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(ADMIN.email);
    expect(res.body.user.short).toBe('EM');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('401s without a token and with a garbage token', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-jwt')).status,
    ).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('is an audited no-op that requires a valid token', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN.email, password: ADMIN.password });

    const since = await auditWatermark();
    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const entry = await auditSince(since, `Cierre de sesión de ${ADMIN.name}`);
    expect(entry).not.toBeNull();

    // No blacklist by design — the same token still works afterwards.
    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
  });

  it('401s without a token', async () => {
    expect((await request(app).post('/auth/logout')).status).toBe(401);
  });
});
