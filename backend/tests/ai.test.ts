/**
 * `/documents/:code/ai/*` route tests.
 *
 * Deliberately scoped to what's deterministic and free to run: auth gating,
 * role gating, and request validation — all enforced by middleware that
 * runs BEFORE the handler ever calls Claude. None of these tests exercise
 * `askClaude()`/the real Anthropic API (no mocking, no live calls, no cost,
 * no dependence on whether ANTHROPIC_API_KEY happens to be set in this
 * environment) — that would require either a real key (costs money, is
 * non-deterministic) or mocking the SDK (not worth it for a v1 feature this
 * thin). See src/lib/claude.ts / src/routes/ai.ts for the implementation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { RoleName } from '@prisma/client';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { signToken } from '../src/lib/jwt.js';

const app = createApp();

const PREFIX = 'AIT-';
const USER_TAG = '[ai-test]';

interface TestUser {
  id: string;
  name: string;
  role: RoleName;
  token: string;
}

const users: Record<'elaborador' | 'lector', TestUser> = {} as never;

async function makeUser(key: keyof typeof users, role: RoleName): Promise<void> {
  const name = `${USER_TAG} ${key}`;
  const email = `ai-test-${key}@solinal.test`;
  const row = await prisma.user.upsert({
    where: { email },
    create: { name, short: 'AT', email, passwordHash: 'x', role },
    update: { name, role, lockedAt: null, failedAttempts: 0 },
  });
  users[key] = {
    id: row.id,
    name: row.name,
    role: row.role,
    token: signToken({ sub: row.id, email: row.email, name: row.name, role: row.role }),
  };
}

let code: string;

beforeAll(async () => {
  await makeUser('elaborador', 'Elaborador');
  await makeUser('lector', 'Lector');

  code = `${PREFIX}${Date.now()}`;
  await prisma.document.create({
    data: {
      code,
      title: 'Documento de prueba IA',
      type: 'Procedimiento',
      norma: 'ISO 9001:2015',
      estado: 'Borrador',
      version: 'v1.0',
      creadorId: users.elaborador.id,
      creador: users.elaborador.name,
      content: '<p>contenido base</p>',
    },
  });
});

afterAll(async () => {
  await prisma.document.delete({ where: { code } }).catch(() => {});
  await disconnectPrisma();
});

const routes: Array<{ path: string; body: object }> = [
  { path: 'draft', body: {} },
  { path: 'compliance', body: {} },
  { path: 'improve', body: { selectionHtml: '<p>texto</p>' } },
  { path: 'chat', body: { messages: [], question: '¿Qué le falta a este documento?' } },
];

describe.each(routes)('POST /documents/:code/ai/$path', ({ path, body }) => {
  it('401s without a token', async () => {
    const res = await request(app).post(`/documents/${code}/ai/${path}`).send(body);
    expect(res.status).toBe(401);
  });

  it('403s a Lector', async () => {
    const res = await request(app)
      .post(`/documents/${code}/ai/${path}`)
      .set('Authorization', `Bearer ${users.lector.token}`)
      .send(body);
    expect(res.status).toBe(403);
  });
});

describe('POST /documents/:code/ai/improve — validation', () => {
  it('400s an empty selectionHtml', async () => {
    const res = await request(app)
      .post(`/documents/${code}/ai/improve`)
      .set('Authorization', `Bearer ${users.elaborador.token}`)
      .send({ selectionHtml: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /documents/:code/ai/chat — validation', () => {
  it('400s an empty question', async () => {
    const res = await request(app)
      .post(`/documents/${code}/ai/chat`)
      .set('Authorization', `Bearer ${users.elaborador.token}`)
      .send({ messages: [], question: '' });
    expect(res.status).toBe(400);
  });

  it('400s a malformed message role in history', async () => {
    const res = await request(app)
      .post(`/documents/${code}/ai/chat`)
      .set('Authorization', `Bearer ${users.elaborador.token}`)
      .send({ messages: [{ role: 'system', text: 'x' }], question: '¿Y bien?' });
    expect(res.status).toBe(400);
  });
});
