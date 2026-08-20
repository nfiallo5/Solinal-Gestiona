/**
 * `/audit-logs` route tests (Agent 3).
 * Requires a seeded test database: `npm run test:db:reset`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();

const EMAILS = {
  admin: 'admin@solinal.com',
  revisor: 'revisor@solinal.com',
  lector: 'lector@solinal.com',
} as const;

type Who = keyof typeof EMAILS;

const tokens = {} as Record<Who, string>;
const auth = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });

interface AuditRow {
  id: number;
  action: string;
  user: string;
  role: string;
  date: string;
  time: string;
  ip: string;
}

beforeAll(async () => {
  for (const key of Object.keys(EMAILS) as Who[]) {
    const u = await prisma.user.findUnique({ where: { email: EMAILS[key] } });
    if (!u) throw new Error(`Test DB not seeded (missing ${EMAILS[key]}). Run npm run test:db:reset.`);
    tokens[key] = signToken({ sub: u.id, email: u.email, name: u.name, role: u.role });
  }
});

afterAll(async () => {
  await disconnectPrisma();
});

// ---------------------------------------------------------------------------

describe('GET /audit-logs', () => {
  it('401s without a token and 403s a Lector', async () => {
    expect((await request(app).get('/audit-logs')).status).toBe(401);
    expect((await request(app).get('/audit-logs').set(auth('lector'))).status).toBe(403);
  });

  it('returns the seed rows newest-first, not id-descending', async () => {
    const res = await request(app).get('/audit-logs').set(auth('admin'));
    expect(res.status).toBe(200);

    // The four seed entries have ascending ids but a newest-first array order
    // in src/data/seed.ts, so a plain `id desc` would render them backwards.
    const seedIds = (res.body as AuditRow[]).map((l) => l.id).filter((id) => id <= 4);
    expect(seedIds).toEqual([1, 2, 3, 4]);

    const first = (res.body as AuditRow[]).find((l) => l.id === 1);
    expect(first).toMatchObject({
      action: 'Documento POL-GER-003 aprobado',
      user: 'Carlos Ruiz',
      role: 'Aprobador',
      date: '2026-06-20',
      time: '09:14',
      ip: '190.45.23.10',
    });
  });

  it('filters by user', async () => {
    const res = await request(app).get('/audit-logs').query({ user: 'Carlos Ruiz' }).set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect((res.body as AuditRow[]).every((l) => l.user === 'Carlos Ruiz')).toBe(true);
  });

  it('filters by role', async () => {
    const res = await request(app).get('/audit-logs').query({ role: 'Revisor' }).set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect((res.body as AuditRow[]).every((l) => l.role === 'Revisor')).toBe(true);
  });

  it('filters by document code as a substring of the action text', async () => {
    const res = await request(app)
      .get('/audit-logs')
      .query({ doc: 'INS-PRO-012' })
      .set(auth('admin'));
    expect(res.status).toBe(200);
    expect((res.body as AuditRow[]).every((l) => l.action.includes('INS-PRO-012'))).toBe(true);
    expect((res.body as AuditRow[]).map((l) => l.id)).toContain(2);
  });

  it('treats the UI\'s "all" sentinel as no filter', async () => {
    const [all, none] = await Promise.all([
      request(app).get('/audit-logs').query({ user: 'all', doc: 'all', role: 'all' }).set(auth('admin')),
      request(app).get('/audit-logs').set(auth('admin')),
    ]);
    expect(all.status).toBe(200);
    expect(all.body.length).toBe(none.body.length);
  });

  it('combines filters and honours limit', async () => {
    const combined = await request(app)
      .get('/audit-logs')
      .query({ user: 'Erick Murillo', role: 'Administrador' })
      .set(auth('admin'));
    expect(combined.status).toBe(200);
    expect(
      (combined.body as AuditRow[]).every(
        (l) => l.user === 'Erick Murillo' && l.role === 'Administrador',
      ),
    ).toBe(true);

    const limited = await request(app).get('/audit-logs').query({ limit: 2 }).set(auth('admin'));
    expect(limited.body).toHaveLength(2);
  });

  it('400s an unknown role value', async () => {
    const res = await request(app).get('/audit-logs').query({ role: 'Auditor' }).set(auth('admin'));
    expect(res.status).toBe(400);
  });

  it('has no POST route — the trail is server-written only', async () => {
    const res = await request(app)
      .post('/audit-logs')
      .set(auth('admin'))
      .send({ action: 'Entrada forjada por el cliente' });
    expect(res.status).toBe(404);

    const forged = await prisma.auditLogEntry.findFirst({
      where: { action: 'Entrada forjada por el cliente' },
    });
    expect(forged).toBeNull();
  });

  it('reflects an entry written as a side effect of a mutation', async () => {
    const before = await request(app).get('/audit-logs').query({ limit: 1 }).set(auth('admin'));

    const created = await request(app)
      .post('/documents')
      .set(auth('revisor'))
      .send({
        title: `Documento para auditoría ${Date.now()}`,
        type: 'Procedimiento',
        area: 'CAL',
        norma: 'ISO 9001:2015',
      });
    expect(created.status).toBe(201);

    try {
      const after = await request(app)
        .get('/audit-logs')
        .query({ doc: created.body.code as string })
        .set(auth('admin'));
      const head = (after.body as AuditRow[])[0];
      expect(head).toBeDefined();
      // Newest first: the entry just written must be at the head.
      expect(head!.action).toBe(`Creó el documento ${created.body.code}`);
      expect(head!.id).not.toBe((before.body as AuditRow[])[0]?.id);
      expect(head!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(head!.time).toMatch(/^\d{2}:\d{2}$/);
    } finally {
      await prisma.document.delete({ where: { code: created.body.code } });
    }
  });
});
