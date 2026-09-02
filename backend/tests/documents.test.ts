/**
 * `/documents` route tests (Agent 3).
 *
 * Tokens are minted directly with `signToken` rather than going through
 * `POST /auth/login`, so this file does not depend on another agent's router
 * being finished — and so a lockout left behind by the auth tests cannot make
 * these fail.
 *
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
  elaborador: 'elaborador@solinal.com',
  aprobador: 'aprobador@solinal.com',
  lector: 'lector@solinal.com',
} as const;

type Who = keyof typeof EMAILS;

const tokens = {} as Record<Who, string>;
const names = {} as Record<Who, string>;
/** Documents created by this file, torn down in `afterAll`. */
const createdCodes: string[] = [];

const auth = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });

beforeAll(async () => {
  for (const key of Object.keys(EMAILS) as Who[]) {
    const u = await prisma.user.findUnique({ where: { email: EMAILS[key] } });
    if (!u) throw new Error(`Test DB not seeded (missing ${EMAILS[key]}). Run npm run test:db:reset.`);
    tokens[key] = signToken({ sub: u.id, email: u.email, name: u.name, role: u.role });
    names[key] = u.name;
  }
});

afterAll(async () => {
  if (createdCodes.length > 0) {
    // Signatures / revisions / comments cascade from Document.
    await prisma.document.deleteMany({ where: { code: { in: createdCodes } } });
  }
  await disconnectPrisma();
});

/** POST /documents and remember the code so `afterAll` can clean it up. */
async function createDocument(who: Who, body: Record<string, unknown>) {
  const res = await request(app).post('/documents').set(auth(who)).send(body);
  if (res.status === 201) createdCodes.push(res.body.code as string);
  return res;
}

// ---------------------------------------------------------------------------

describe('GET /documents', () => {
  it('401s without a token', async () => {
    const res = await request(app).get('/documents');
    expect(res.status).toBe(401);
  });

  it('lists the seed documents in seed order', async () => {
    const res = await request(app).get('/documents').set(auth('admin'));
    expect(res.status).toBe(200);
    const codes = res.body.map((d: { code: string }) => d.code);
    expect(codes.slice(0, 7)).toEqual([
      'PRO-CAL-009',
      'POL-GER-003',
      'MAN-CAL-001',
      'INS-PRO-012',
      'CHK-HAC-001',
      'INS-AMB-002',
      'PRO-SEG-005',
    ]);
  });

  it('filters by estado', async () => {
    const res = await request(app).get('/documents').query({ estado: 'Aprobado' }).set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((d: { estado: string }) => d.estado === 'Aprobado')).toBe(true);
    const codes = res.body.map((d: { code: string }) => d.code);
    expect(codes).toContain('MAN-CAL-001');
    expect(codes).not.toContain('PRO-CAL-009'); // Borrador
  });

  it('accepts the space-containing "En aprobación" literal', async () => {
    const res = await request(app)
      .get('/documents')
      .query({ estado: 'En aprobación' })
      .set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.map((d: { code: string }) => d.code)).toContain('POL-GER-003');
    expect(res.body.every((d: { estado: string }) => d.estado === 'En aprobación')).toBe(true);
  });

  it('treats estado=Vencido as the vencido flag, not a status', async () => {
    const res = await request(app).get('/documents').query({ estado: 'Vencido' }).set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.every((d: { vencido: boolean }) => d.vencido === true)).toBe(true);
    expect(res.body.map((d: { code: string }) => d.code)).toContain('CHK-HAC-001');
  });

  it('filters by type', async () => {
    const res = await request(app).get('/documents').query({ type: 'Instructivo' }).set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((d: { type: string }) => d.type === 'Instructivo')).toBe(true);
  });

  it('filters by norma', async () => {
    const res = await request(app)
      .get('/documents')
      .query({ norma: 'ISO 14001:2015' })
      .set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.map((d: { code: string }) => d.code)).toEqual(['INS-AMB-002']);
  });

  it('filters by vencido', async () => {
    const res = await request(app).get('/documents').query({ vencido: 'false' }).set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.every((d: { vencido: boolean }) => d.vencido === false)).toBe(true);
    expect(res.body.map((d: { code: string }) => d.code)).not.toContain('CHK-HAC-001');
  });

  it('searches case-insensitively over code and title', async () => {
    const byCode = await request(app).get('/documents').query({ search: 'cal-009' }).set(auth('admin'));
    expect(byCode.body.map((d: { code: string }) => d.code)).toEqual(['PRO-CAL-009']);

    const byTitle = await request(app)
      .get('/documents')
      .query({ search: 'alérgenos' })
      .set(auth('admin'));
    expect(byTitle.status).toBe(200);
    expect(byTitle.body.map((d: { code: string }) => d.code)).toContain('CHK-HAC-001');
    expect(
      byTitle.body.every((d: { title: string; code: string }) =>
        `${d.title} ${d.code}`.toLowerCase().includes('alérgenos'),
      ),
    ).toBe(true);
  });

  it('combines filters', async () => {
    const res = await request(app)
      .get('/documents')
      .query({ estado: 'Aprobado', norma: 'ISO 22000:2018' })
      .set(auth('admin'));
    expect(res.status).toBe(200);
    expect(
      res.body.every(
        (d: { estado: string; norma: string }) =>
          d.estado === 'Aprobado' && d.norma === 'ISO 22000:2018',
      ),
    ).toBe(true);
  });

  it('restricts Lector to approved documents', async () => {
    const res = await request(app).get('/documents').set(auth('lector'));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((d: { estado: string }) => d.estado === 'Aprobado')).toBe(true);
  });

  it('does not let a Lector widen the estado filter', async () => {
    const res = await request(app).get('/documents').query({ estado: 'Borrador' }).set(auth('lector'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('400s on an unknown estado value', async () => {
    const res = await request(app).get('/documents').query({ estado: 'Publicado' }).set(auth('admin'));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe('GET /documents/:code', () => {
  it('serializes signatures as names oldest-first and revisiones newest-first', async () => {
    const res = await request(app).get('/documents/MAN-CAL-001').set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body.signatures).toEqual(['Erick Murillo', 'Carlos Ruiz']);
    expect(res.body.revisiones).toEqual([
      'v3.0: Adecuación a nueva estructura',
      'v2.0: Revisión bienal',
    ]);
    expect(res.body.creador).toBe('Erick Murillo');
    expect(res.body.nivel).toBeNull();
    expect(res.body.rolesRequeridos).toBeNull();
    expect(typeof res.body.contentVersion).toBe('number');
  });

  it('maps estado back to the wire literal', async () => {
    const res = await request(app).get('/documents/POL-GER-003').set(auth('admin'));
    expect(res.body.estado).toBe('En aprobación');
  });

  it('404s an unknown code', async () => {
    const res = await request(app).get('/documents/NOP-XXX-999').set(auth('admin'));
    expect(res.status).toBe(404);
  });

  it('403s a Lector reading a non-approved document', async () => {
    const res = await request(app).get('/documents/PRO-CAL-009').set(auth('lector'));
    expect(res.status).toBe(403);
  });

  it('lets a Lector read an approved document', async () => {
    const res = await request(app).get('/documents/MAN-CAL-001').set(auth('lector'));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------

describe('POST /documents', () => {
  it('creates from a template, inheriting nivel/rolesRequeridos and deriving critico', async () => {
    const res = await createDocument('elaborador', {
      templateKey: 'politica',
      title: 'Borrador — Política de Calidad',
      type: 'Política',
      area: 'GER',
      norma: 'ISO 9001:2015',
      description: 'ignorado a propósito',
      // Explicitly false: the template's dobleAprobacion must win.
      critico: false,
    });

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^POL-GER-\d{3}$/);
    expect(res.body.estado).toBe('Borrador');
    expect(res.body.version).toBe('v1.0');
    expect(res.body.creador).toBe(names.elaborador);
    expect(res.body.nivel).toBe('Política');
    expect(res.body.rolesRequeridos).toEqual({
      elaborador: 'Elaborador',
      revisor: 'Revisor',
      aprobador: 'Aprobador',
      dobleAprobacion: true,
    });
    // critico derives from the template, NOT from the request body.
    expect(res.body.critico).toBe(true);
    expect(res.body.content).toContain('Declaración de política');
    expect(res.body.signatures).toEqual([]);
    expect(res.body.revisiones).toEqual([]);
    expect(res.body.contentVersion).toBe(0);
  });

  it('honours the critico checkbox only for blank documents', async () => {
    const blank = await createDocument('elaborador', {
      title: 'Documento en blanco crítico',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
      critico: true,
    });
    expect(blank.status).toBe(201);
    expect(blank.body.critico).toBe(true);
    expect(blank.body.nivel).toBeNull();
    expect(blank.body.rolesRequeridos).toBeNull();
    expect(blank.body.content).toBe('');

    const fromTemplate = await createDocument('elaborador', {
      templateKey: 'procedimiento', // dobleAprobacion: false
      title: 'Procedimiento desde plantilla',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
      critico: true,
    });
    expect(fromTemplate.status).toBe(201);
    expect(fromTemplate.body.critico).toBe(false);
  });

  it('generates the next sequential control code', async () => {
    const first = await createDocument('elaborador', {
      title: 'Secuencia A',
      type: 'Manual',
      area: 'MTO',
      norma: 'ISO 9001:2015',
    });
    const second = await createDocument('elaborador', {
      title: 'Secuencia B',
      type: 'Manual',
      area: 'MTO',
      norma: 'ISO 9001:2015',
    });
    const n = (code: string) => Number.parseInt(code.slice('MAN-MTO-'.length), 10);
    expect(first.body.code).toMatch(/^MAN-MTO-\d{3}$/);
    expect(n(second.body.code)).toBe(n(first.body.code) + 1);
  });

  it('writes an audit entry', async () => {
    const res = await createDocument('elaborador', {
      templateKey: 'instructivo',
      title: 'Instructivo auditado',
      type: 'Instructivo',
      area: 'PRD',
      norma: 'ISO 22000:2018',
    });
    expect(res.status).toBe(201);
    const entry = await prisma.auditLogEntry.findFirst({
      where: { action: `Creó el documento ${res.body.code} desde plantilla` },
    });
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe(names.elaborador);
    expect(entry?.role).toBe('Elaborador');
  });

  it('403s a Lector', async () => {
    const res = await createDocument('lector', {
      title: 'No permitido',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
    });
    expect(res.status).toBe(403);
  });

  it('400s a missing title, a bad area, or an unknown template', async () => {
    const noTitle = await createDocument('elaborador', {
      title: '   ',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
    });
    expect(noTitle.status).toBe(400);

    const badArea = await createDocument('elaborador', {
      title: 'Área inexistente',
      type: 'Procedimiento',
      area: 'ZZZ',
      norma: 'ISO 9001:2015',
    });
    expect(badArea.status).toBe(400);

    const badTemplate = await createDocument('elaborador', {
      templateKey: 'no-existe',
      title: 'Plantilla inexistente',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
    });
    expect(badTemplate.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------

describe('PATCH /documents/:code', () => {
  it('updates the title without touching contentVersion', async () => {
    const doc = await createDocument('elaborador', {
      title: 'Título original',
      type: 'Procedimiento',
      area: 'PRD',
      norma: 'ISO 9001:2015',
    });
    const res = await request(app)
      .patch(`/documents/${doc.body.code}`)
      .set(auth('elaborador'))
      .send({ title: 'Título actualizado' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Título actualizado');
    expect(res.body.contentVersion).toBe(0);
  });

  it('bumps contentVersion on every content write', async () => {
    const doc = await createDocument('elaborador', {
      title: 'Versionado de contenido',
      type: 'Procedimiento',
      area: 'PRD',
      norma: 'ISO 9001:2015',
    });
    const code = doc.body.code as string;

    const first = await request(app)
      .patch(`/documents/${code}`)
      .set(auth('elaborador'))
      .send({ content: '<p>uno</p>' });
    expect(first.status).toBe(200);
    expect(first.body.contentVersion).toBe(1);

    const second = await request(app)
      .patch(`/documents/${code}`)
      .set(auth('elaborador'))
      .send({ content: '<p>dos</p>', contentVersion: 1 });
    expect(second.status).toBe(200);
    expect(second.body.content).toBe('<p>dos</p>');
    expect(second.body.contentVersion).toBe(2);
  });

  it('409s a stale contentVersion and returns both sides for the merge dialog', async () => {
    const doc = await createDocument('elaborador', {
      title: 'Conflicto concurrente',
      type: 'Procedimiento',
      area: 'PRD',
      norma: 'ISO 9001:2015',
    });
    const code = doc.body.code as string;

    // Session A saves; the server is now at contentVersion 1.
    await request(app)
      .patch(`/documents/${code}`)
      .set(auth('elaborador'))
      .send({ content: '<p>servidor</p>', contentVersion: 0 });

    // Session B still believes it holds version 0.
    const conflict = await request(app)
      .patch(`/documents/${code}`)
      .set(auth('aprobador'))
      .send({ content: '<p>mi borrador local</p>', contentVersion: 0 });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('CONTENT_VERSION_CONFLICT');
    expect(conflict.body.error.details).toMatchObject({
      code,
      clientContentVersion: 0,
      serverContentVersion: 1,
      clientContent: '<p>mi borrador local</p>',
      serverContent: '<p>servidor</p>',
    });
    expect(typeof conflict.body.error.details.serverUpdatedAt).toBe('string');

    // The rejected write must not have landed.
    const after = await request(app).get(`/documents/${code}`).set(auth('admin'));
    expect(after.body.content).toBe('<p>servidor</p>');
    expect(after.body.contentVersion).toBe(1);
  });

  it('freezes the content of a signed Registro', async () => {
    const doc = await createDocument('elaborador', {
      templateKey: 'checklist', // nivel: "Registro"
      title: 'Checklist congelado',
      type: 'Checklist',
      area: 'PRD',
      norma: 'ISO 22000:2018',
    });
    const code = doc.body.code as string;
    expect(doc.body.nivel).toBe('Registro');

    // Unsigned: still editable.
    const editable = await request(app)
      .patch(`/documents/${code}`)
      .set(auth('elaborador'))
      .send({ content: '<p>todavía editable</p>' });
    expect(editable.status).toBe(200);

    const signer = await prisma.user.findUniqueOrThrow({ where: { email: EMAILS.aprobador } });
    await prisma.documentSignature.create({
      data: { documentCode: code, userId: signer.id, userName: signer.name },
    });

    const frozen = await request(app)
      .patch(`/documents/${code}`)
      .set(auth('elaborador'))
      .send({ content: '<p>intento de manipulación</p>' });
    expect(frozen.status).toBe(423);

    // Metadata is still patchable — only `content` is evidence.
    const meta = await request(app)
      .patch(`/documents/${code}`)
      .set(auth('elaborador'))
      .send({ title: 'Checklist congelado (renombrado)' });
    expect(meta.status).toBe(200);
  });

  it('accepts the wire estado literal and writes an audit entry', async () => {
    const doc = await createDocument('elaborador', {
      title: 'Cambio de estado',
      type: 'Procedimiento',
      area: 'PRD',
      norma: 'ISO 9001:2015',
    });
    const code = doc.body.code as string;

    const res = await request(app)
      .patch(`/documents/${code}`)
      .set(auth('elaborador'))
      .send({ estado: 'En aprobación' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('En aprobación');

    const entry = await prisma.auditLogEntry.findFirst({
      where: { action: { startsWith: `Actualizó el documento ${code}` } },
    });
    expect(entry).not.toBeNull();
  });

  it('403s a Lector, 400s an empty body, 404s an unknown code', async () => {
    expect(
      (await request(app).patch('/documents/MAN-CAL-001').set(auth('lector')).send({ title: 'x' }))
        .status,
    ).toBe(403);
    expect(
      (await request(app).patch('/documents/MAN-CAL-001').set(auth('admin')).send({})).status,
    ).toBe(400);
    expect(
      (await request(app).patch('/documents/NOP-XXX-999').set(auth('admin')).send({ title: 'x' }))
        .status,
    ).toBe(404);
  });
});

// ---------------------------------------------------------------------------

describe('DELETE /documents/:code', () => {
  it('401s without a token', async () => {
    const res = await request(app).delete('/documents/MAN-CAL-001');
    expect(res.status).toBe(401);
  });

  it('403s a non-Administrador role', async () => {
    const doc = await createDocument('elaborador', {
      title: 'Documento a proteger',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
      critico: false,
    });
    const res = await request(app).delete(`/documents/${doc.body.code}`).set(auth('elaborador'));
    expect(res.status).toBe(403);

    // Still there afterwards.
    const still = await prisma.document.findUnique({ where: { code: doc.body.code } });
    expect(still).not.toBeNull();
  });

  it('404s an unknown code', async () => {
    const res = await request(app).delete('/documents/NOP-XXX-999').set(auth('admin'));
    expect(res.status).toBe(404);
  });

  it('an Administrador deletes the document, its signatures/comments cascade, and it writes an audit entry', async () => {
    const created = await createDocument('elaborador', {
      title: 'Documento a eliminar',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
      critico: false,
    });
    const code = created.body.code as string;

    await request(app)
      .post(`/documents/${code}/comments`)
      .set(auth('elaborador'))
      .send({ text: 'Comentario que debe desaparecer con el documento.' });

    const res = await request(app).delete(`/documents/${code}`).set(auth('admin'));
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    expect(await prisma.document.findUnique({ where: { code } })).toBeNull();
    expect(await prisma.documentComment.findMany({ where: { code } })).toEqual([]);

    const getAfter = await request(app).get(`/documents/${code}`).set(auth('admin'));
    expect(getAfter.status).toBe(404);

    const entry = await prisma.auditLogEntry.findFirst({
      where: { action: `Eliminó el documento ${code}` },
      orderBy: { id: 'desc' },
    });
    expect(entry).not.toBeNull();
    expect(entry?.user).toBe(names.admin);
  });
});

// ---------------------------------------------------------------------------

describe('comments', () => {
  it('returns the seeded thread oldest-first', async () => {
    const res = await request(app).get('/documents/PRO-CAL-009/comments').set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      code: 'PRO-CAL-009',
      author: 'Ana Torres',
      date: '2026-06-21 00:30',
    });
  });

  it('adds a comment with the "YYYY-MM-DD HH:mm" date the UI renders', async () => {
    const doc = await createDocument('elaborador', {
      title: 'Documento comentado',
      type: 'Procedimiento',
      area: 'CAL',
      norma: 'ISO 9001:2015',
    });
    const code = doc.body.code as string;

    const created = await request(app)
      .post(`/documents/${code}/comments`)
      .set(auth('aprobador'))
      .send({ text: '¿Se requiere la firma del director de planta?' });

    expect(created.status).toBe(201);
    expect(created.body.author).toBe(names.aprobador);
    expect(created.body.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    const second = await request(app)
      .post(`/documents/${code}/comments`)
      .set(auth('elaborador'))
      .send({ text: 'Confirmado, la agrego.' });
    expect(second.status).toBe(201);

    const thread = await request(app).get(`/documents/${code}/comments`).set(auth('admin'));
    expect(thread.body.map((c: { text: string }) => c.text)).toEqual([
      '¿Se requiere la firma del director de planta?',
      'Confirmado, la agrego.',
    ]);

    const entry = await prisma.auditLogEntry.findFirst({
      where: { action: `Añadió un comentario en documento ${code}` },
    });
    expect(entry).not.toBeNull();
  });

  it('rejects empty text, a Lector author, and an unknown document', async () => {
    expect(
      (await request(app).post('/documents/PRO-CAL-009/comments').set(auth('admin')).send({ text: '  ' }))
        .status,
    ).toBe(400);
    expect(
      (await request(app)
        .post('/documents/MAN-CAL-001/comments')
        .set(auth('lector'))
        .send({ text: 'hola' })).status,
    ).toBe(403);
    expect(
      (await request(app).post('/documents/NOP-XXX-999/comments').set(auth('admin')).send({ text: 'hola' }))
        .status,
    ).toBe(404);
  });
});
