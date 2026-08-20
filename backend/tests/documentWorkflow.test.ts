/**
 * Workflow endpoints — the business rules ported out of `src/routes/Editor.tsx`
 * and `src/features/documents/ApprovalFlowDialog.tsx`.
 *
 * These build their own users and documents (all codes prefixed `WFT-`) instead
 * of leaning on the seed, so they neither depend on nor corrupt demo data and
 * can run alongside the other route agents' suites.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DoubleApproval, Prisma, type RoleName } from '@prisma/client';

import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/prisma.js';
import { signToken } from '../src/lib/jwt.js';
import { formatAuditDate } from '../src/lib/audit.js';
import { MERGE_RESOLUTION_TEXT } from '../src/lib/demoContent.js';

const app = createApp();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PREFIX = 'WFT-';
const USER_TAG = '[wf-test]';

interface TestUser {
  id: string;
  name: string;
  role: RoleName;
  token: string;
}

const users: Record<
  'admin' | 'aprobador' | 'aprobador2' | 'elaborador' | 'revisor' | 'lector',
  TestUser
> = {} as never;

async function makeUser(key: keyof typeof users, role: RoleName): Promise<void> {
  const name = `${USER_TAG} ${key}`;
  const email = `wf-test-${key}@solinal.test`;
  const row = await prisma.user.upsert({
    where: { email },
    create: { name, short: 'WT', email, passwordHash: 'x', role },
    update: { name, role, lockedAt: null, failedAttempts: 0 },
  });
  users[key] = {
    id: row.id,
    name: row.name,
    role: row.role,
    token: signToken({ sub: row.id, email: row.email, name: row.name, role: row.role }),
  };
}

let codeCounter = 0;

interface MakeDocOptions {
  estado?: 'Borrador' | 'En_aprobación' | 'Aprobado' | 'Rechazado';
  critico?: boolean;
  vencido?: boolean;
  version?: string;
  content?: string;
  norma?: string;
  creator?: TestUser;
  rolesRequeridos?: Prisma.InputJsonObject;
  revisiones?: string[];
  sectionLocked?: boolean;
  nivel?: 'Política' | 'Manual' | 'Procedimiento' | 'Instructivo' | 'Registro';
  /** Pre-existing signatures, so the "signed Registro" freeze can be tested. */
  signedBy?: TestUser[];
}

async function makeDoc(options: MakeDocOptions = {}): Promise<string> {
  const code = `${PREFIX}${Date.now()}-${codeCounter++}`;
  const creator = options.creator ?? users.elaborador;
  await prisma.document.create({
    data: {
      code,
      title: 'Documento de prueba de flujo',
      type: 'Procedimiento',
      norma: options.norma ?? 'ISO 9001:2015',
      estado: options.estado ?? 'Borrador',
      version: options.version ?? 'v1.2',
      creadorId: creator.id,
      creador: creator.name,
      vencido: options.vencido ?? false,
      critico: options.critico ?? false,
      content: options.content ?? '<p>contenido base</p>',
      sectionLocked: options.sectionLocked ?? false,
      ...(options.nivel ? { nivel: options.nivel } : {}),
      ...(options.rolesRequeridos ? { rolesRequeridos: options.rolesRequeridos } : {}),
      ...(options.signedBy?.length
        ? {
            signatures: {
              create: options.signedBy.map((u) => ({ userId: u.id, userName: u.name })),
            },
          }
        : {}),
      ...(options.revisiones?.length
        ? { revisiones: { create: options.revisiones.map((text) => ({ text })) } }
        : {}),
    },
  });
  return code;
}

/** Most recent audit row written by a test user mentioning this document. */
function lastAuditFor(code: string) {
  return prisma.auditLogEntry.findFirst({
    where: { action: { contains: code } },
    orderBy: { id: 'desc' },
  });
}

async function setDoubleApproval(value: DoubleApproval): Promise<void> {
  await prisma.orgConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      orgName: 'Solinal S.A.',
      brandColor: '#1B4F8A',
      twoFactorEnabled: false,
      passwordPolicy: 'strong',
      doubleApproval: value,
    },
    update: { doubleApproval: value },
  });
}

let originalDoubleApproval: DoubleApproval = DoubleApproval.critical;

beforeAll(async () => {
  await makeUser('admin', 'Administrador');
  await makeUser('aprobador', 'Aprobador');
  await makeUser('aprobador2', 'Administrador'); // second signer for the 2/2 branch
  await makeUser('elaborador', 'Elaborador');
  await makeUser('revisor', 'Revisor');
  await makeUser('lector', 'Lector');

  const config = await prisma.orgConfig.findUnique({ where: { id: 1 } });
  originalDoubleApproval = config?.doubleApproval ?? DoubleApproval.critical;
});

beforeEach(async () => {
  // Every test that cares about the branch sets this explicitly; default to the
  // seeded value so a stray test cannot inherit a previous test's override.
  await setDoubleApproval(DoubleApproval.critical);
});

afterAll(async () => {
  await prisma.document.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.auditLogEntry.deleteMany({ where: { user: { startsWith: USER_TAG } } });
  await prisma.user.deleteMany({ where: { name: { startsWith: USER_TAG } } });
  await setDoubleApproval(originalDoubleApproval);
  await disconnectPrisma();
});

const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });

// ---------------------------------------------------------------------------
// POST /documents/:code/sign
// ---------------------------------------------------------------------------

describe('POST /documents/:code/sign', () => {
  it('401s without a token', async () => {
    const code = await makeDoc();
    const res = await request(app).post(`/documents/${code}/sign`);
    expect(res.status).toBe(401);
  });

  it('404s for an unknown document', async () => {
    const res = await request(app).post('/documents/WFT-nope/sign').set(auth(users.admin));
    expect(res.status).toBe(404);
  });

  it('rejects a non-Aprobador/Administrador AND writes the "Intento fallido" audit entry', async () => {
    const code = await makeDoc();
    const res = await request(app).post(`/documents/${code}/sign`).set(auth(users.revisor));

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Solo los roles de Aprobador o Administrador');

    const entry = await lastAuditFor(code);
    expect(entry?.action).toBe(
      `Intento fallido de firma en ${code} por ${users.revisor.name} (Rol: Revisor)`,
    );
    expect(entry?.user).toBe(users.revisor.name);
    expect(entry?.role).toBe('Revisor');

    // The rejection must not have left a signature behind.
    const signatures = await prisma.documentSignature.count({ where: { documentCode: code } });
    expect(signatures).toBe(0);
  });

  it('enforces the rolesRequeridos snapshot and logs "Intento no autorizado"', async () => {
    // aprobador === "Revisor" here, so a real Aprobador clears gate 1 but not gate 2.
    const code = await makeDoc({
      rolesRequeridos: {
        elaborador: 'Elaborador',
        revisor: 'Revisor',
        aprobador: 'Revisor',
        dobleAprobacion: false,
      },
    });

    const res = await request(app).post(`/documents/${code}/sign`).set(auth(users.aprobador));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Este documento requiere firma de Revisor o Revisor.');

    const entry = await lastAuditFor(code);
    expect(entry?.action).toBe(
      `Intento no autorizado de firma en ${code} por ${users.aprobador.name} (Rol: Aprobador, se esperaba Revisor)`,
    );
  });

  it('lets Administrador bypass the rolesRequeridos gate', async () => {
    const code = await makeDoc({
      rolesRequeridos: {
        elaborador: 'Elaborador',
        revisor: 'Revisor',
        aprobador: 'Revisor',
        dobleAprobacion: false,
      },
    });

    const res = await request(app).post(`/documents/${code}/sign`).set(auth(users.admin));
    expect(res.status).toBe(200);
    expect(res.body.document.estado).toBe('Aprobado');
    expect(res.body.document.signatures).toEqual([users.admin.name]);
  });

  it('refuses a second signature from the same user with a clean 409', async () => {
    const code = await makeDoc();
    await request(app).post(`/documents/${code}/sign`).set(auth(users.aprobador)).expect(200);

    const res = await request(app).post(`/documents/${code}/sign`).set(auth(users.aprobador));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Ya has firmado este documento.');
    // Not the raw Prisma unique-constraint conversion.
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('non-critical: a single signature goes straight to Aprobado and clears vencido', async () => {
    const code = await makeDoc({ critico: false, vencido: true });
    const res = await request(app).post(`/documents/${code}/sign`).set(auth(users.aprobador));

    expect(res.status).toBe(200);
    expect(res.body.document.estado).toBe('Aprobado');
    expect(res.body.document.vencido).toBe(false);
    expect(res.body.message).toBe('Firma colocada. Documento aprobado de forma oficial.');
    expect((await lastAuditFor(code))?.action).toBe(`Firmó y aprobó el documento ${code}`);
  });

  it('critical + doubleApproval="critical": 1/2 → En aprobación, 2/2 → Aprobado', async () => {
    const code = await makeDoc({ critico: true, vencido: true });

    const first = await request(app).post(`/documents/${code}/sign`).set(auth(users.aprobador));
    expect(first.status).toBe(200);
    expect(first.body.document.estado).toBe('En aprobación');
    expect(first.body.document.signatures).toEqual([users.aprobador.name]);
    // The 1/2 branch deliberately does NOT touch `vencido`.
    expect(first.body.document.vencido).toBe(true);
    expect(first.body.message).toContain('Firma 1/2');
    expect((await lastAuditFor(code))?.action).toBe(
      `Añadió primera firma electrónica al documento crítico ${code}`,
    );

    const second = await request(app).post(`/documents/${code}/sign`).set(auth(users.aprobador2));
    expect(second.status).toBe(200);
    expect(second.body.document.estado).toBe('Aprobado');
    expect(second.body.document.vencido).toBe(false);
    expect(second.body.document.signatures).toEqual([users.aprobador.name, users.aprobador2.name]);
    expect((await lastAuditFor(code))?.action).toBe(
      `Documento crítico ${code} aprobado con firmas completas`,
    );
  });

  it('critical + doubleApproval="none": one signature approves outright', async () => {
    await setDoubleApproval(DoubleApproval.none);
    const code = await makeDoc({ critico: true });

    const res = await request(app).post(`/documents/${code}/sign`).set(auth(users.aprobador));
    expect(res.status).toBe(200);
    expect(res.body.document.estado).toBe('Aprobado');
    expect(res.body.document.vencido).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /documents/:code/approve  |  /reject
// ---------------------------------------------------------------------------

describe('POST /documents/:code/approve', () => {
  it('403s for a non-decider role', async () => {
    const code = await makeDoc({ estado: 'En_aprobación' });
    const res = await request(app).post(`/documents/${code}/approve`).set(auth(users.elaborador));
    expect(res.status).toBe(403);
  });

  it('approves and publishes, appending the comment to the audit entry', async () => {
    const code = await makeDoc({ estado: 'En_aprobación', vencido: true });
    const res = await request(app)
      .post(`/documents/${code}/approve`)
      .set(auth(users.aprobador))
      .send({ comment: '  Todo conforme  ' });

    expect(res.status).toBe(200);
    expect(res.body.document.estado).toBe('Aprobado');
    expect(res.body.document.vencido).toBe(false);
    expect(res.body.document.signatures).toEqual([users.aprobador.name]);
    expect((await lastAuditFor(code))?.action).toBe(
      `Aprobó y publicó el documento ${code}: "Todo conforme"`,
    );
  });

  it('omits the quoted comment when none is given', async () => {
    const code = await makeDoc({ estado: 'En_aprobación' });
    await request(app).post(`/documents/${code}/approve`).set(auth(users.aprobador)).expect(200);
    expect((await lastAuditFor(code))?.action).toBe(`Aprobó y publicó el documento ${code}`);
  });

  it('critical 1/2: records the signature but leaves estado untouched', async () => {
    const code = await makeDoc({ estado: 'En_aprobación', critico: true });
    const res = await request(app).post(`/documents/${code}/approve`).set(auth(users.aprobador));

    expect(res.status).toBe(200);
    expect(res.body.document.estado).toBe('En aprobación');
    expect(res.body.document.signatures).toEqual([users.aprobador.name]);
    expect((await lastAuditFor(code))?.action).toBe(
      `Añadió primera firma de aprobación al documento crítico ${code}`,
    );

    const second = await request(app).post(`/documents/${code}/approve`).set(auth(users.aprobador2));
    expect(second.body.document.estado).toBe('Aprobado');
  });
});

describe('POST /documents/:code/reject', () => {
  it('400s when the comment is missing', async () => {
    const code = await makeDoc({ estado: 'En_aprobación' });
    const res = await request(app).post(`/documents/${code}/reject`).set(auth(users.aprobador));
    expect(res.status).toBe(400);
  });

  it('400s when the comment is only whitespace', async () => {
    const code = await makeDoc({ estado: 'En_aprobación' });
    const res = await request(app)
      .post(`/documents/${code}/reject`)
      .set(auth(users.aprobador))
      .send({ comment: '   ' });
    expect(res.status).toBe(400);

    const row = await prisma.document.findUnique({ where: { code } });
    expect(row?.estado).toBe('En_aprobación');
  });

  it('403s for a non-decider role', async () => {
    const code = await makeDoc({ estado: 'En_aprobación' });
    const res = await request(app)
      .post(`/documents/${code}/reject`)
      .set(auth(users.revisor))
      .send({ comment: 'no' });
    expect(res.status).toBe(403);
  });

  it('rejects with the motive quoted in the audit entry', async () => {
    const code = await makeDoc({ estado: 'En_aprobación' });
    const res = await request(app)
      .post(`/documents/${code}/reject`)
      .set(auth(users.aprobador))
      .send({ comment: 'Falta el control de cambios' });

    expect(res.status).toBe(200);
    expect(res.body.document.estado).toBe('Rechazado');
    expect((await lastAuditFor(code))?.action).toBe(
      `Rechazó el documento ${code}: "Falta el control de cambios"`,
    );
  });
});

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

describe('POST /documents/:code/versions', () => {
  it('bumps the version by +0.1 and prepends the revision line', async () => {
    const code = await makeDoc({ version: 'v1.2', revisiones: ['v1.1: previa'] });
    const res = await request(app).post(`/documents/${code}/versions`).set(auth(users.elaborador));

    expect(res.status).toBe(201);
    expect(res.body.document.version).toBe('v1.3');
    expect(res.body.document.revisiones[0]).toBe(
      `v1.2 - Modificado el ${formatAuditDate(new Date())} por ${users.elaborador.name}: Documento de prueba de flujo`,
    );
    expect(res.body.document.revisiones[1]).toBe('v1.1: previa');
    expect((await lastAuditFor(code))?.action).toBe(`Creó la versión v1.3 del documento ${code}`);
  });

  it('carries the +0.1 across a decimal rollover (v1.9 → v2.0)', async () => {
    const code = await makeDoc({ version: 'v1.9' });
    const res = await request(app).post(`/documents/${code}/versions`).set(auth(users.revisor));
    expect(res.body.document.version).toBe('v2.0');
  });

  it('403s a Lector (lectorRestrictedPages "edit", enforced server-side)', async () => {
    const code = await makeDoc({ version: 'v1.2' });
    const res = await request(app).post(`/documents/${code}/versions`).set(auth(users.lector));

    expect(res.status).toBe(403);
    const row = await prisma.document.findUniqueOrThrow({ where: { code } });
    expect(row.version).toBe('v1.2');
  });
});

describe('POST /documents/:code/versions/:index/restore', () => {
  it('restores by positional index into the newest-first array', async () => {
    // Inserted oldest → newest, so the API array is ["v2.0 - …", "v1.0 - …"].
    const code = await makeDoc({
      version: 'v3.0',
      content: '<p>actual</p>',
      revisiones: ['v1.0 - Emisión inicial', 'v2.0 - Segunda emisión'],
    });

    const res = await request(app)
      .post(`/documents/${code}/versions/1/restore`)
      .set(auth(users.elaborador));

    expect(res.status).toBe(200);
    expect(res.body.document.version).toBe('v1.0');
    expect(res.body.document.content).toBe(
      '<p><em>[Versión Restaurada de v1.0]</em></p><p>actual</p>',
    );
    expect(res.body.document.contentVersion).toBe(1);
    expect((await lastAuditFor(code))?.action).toBe(`Restauró documento ${code} a la versión v1.0`);
  });

  it('takes index 0 as the newest revision', async () => {
    const code = await makeDoc({
      version: 'v3.0',
      revisiones: ['v1.0 - Emisión inicial', 'v2.0 - Segunda emisión'],
    });
    const res = await request(app)
      .post(`/documents/${code}/versions/0/restore`)
      .set(auth(users.elaborador));
    expect(res.body.document.version).toBe('v2.0');
  });

  it('400s when the index is out of range', async () => {
    const code = await makeDoc({ revisiones: ['v1.0 - Emisión inicial'] });
    const res = await request(app)
      .post(`/documents/${code}/versions/5/restore`)
      .set(auth(users.elaborador));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /documents/:code/section-lock
// ---------------------------------------------------------------------------

describe('PATCH /documents/:code/section-lock', () => {
  it('lets the creator toggle it on and back off', async () => {
    const code = await makeDoc({ creator: users.elaborador });

    const on = await request(app)
      .patch(`/documents/${code}/section-lock`)
      .set(auth(users.elaborador));
    expect(on.status).toBe(200);
    expect(on.body.document.sectionLocked).toBe(true);
    expect(on.body.message).toBe('Sección crítica bloqueada para no-propietarios.');

    const off = await request(app)
      .patch(`/documents/${code}/section-lock`)
      .set(auth(users.elaborador));
    expect(off.body.document.sectionLocked).toBe(false);
  });

  it('accepts an absolute target instead of toggling', async () => {
    const code = await makeDoc({ creator: users.elaborador, sectionLocked: true });
    const res = await request(app)
      .patch(`/documents/${code}/section-lock`)
      .set(auth(users.elaborador))
      .send({ locked: true });
    expect(res.body.document.sectionLocked).toBe(true);
  });

  it('lets an Administrador who is not the creator toggle it', async () => {
    const code = await makeDoc({ creator: users.elaborador });
    const res = await request(app).patch(`/documents/${code}/section-lock`).set(auth(users.admin));
    expect(res.status).toBe(200);
    expect(res.body.document.sectionLocked).toBe(true);
  });

  it('403s for a non-creator, non-Administrador and leaves the flag alone', async () => {
    const code = await makeDoc({ creator: users.elaborador });
    const res = await request(app).patch(`/documents/${code}/section-lock`).set(auth(users.revisor));

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Solo el dueño o creador del documento');

    const row = await prisma.document.findUnique({ where: { code } });
    expect(row?.sectionLocked).toBe(false);
    expect((await lastAuditFor(code))?.action).toBe(
      `Intento no autorizado de cambiar el bloqueo de sección en ${code} por ${users.revisor.name} (Rol: Revisor)`,
    );
  });

  it('403s a Lector even when they are the creator (role gate runs first)', async () => {
    const code = await makeDoc({ creator: users.lector });
    const res = await request(app).patch(`/documents/${code}/section-lock`).set(auth(users.lector));
    expect(res.status).toBe(403);
  });

  it('is per-document, not global (divergence #2)', async () => {
    const a = await makeDoc({ creator: users.elaborador });
    const b = await makeDoc({ creator: users.elaborador });
    await request(app).patch(`/documents/${a}/section-lock`).set(auth(users.elaborador)).expect(200);

    const other = await prisma.document.findUnique({ where: { code: b } });
    expect(other?.sectionLocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Demo flows
// ---------------------------------------------------------------------------

describe('POST /documents/:code/merge', () => {
  it('commits the resolved content and bumps contentVersion', async () => {
    const code = await makeDoc({ content: '<p>base</p>' });

    const res = await request(app)
      .post(`/documents/${code}/merge`)
      .set(auth(users.elaborador))
      .send({ content: '<p>resuelto</p>', contentVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.document.content).toBe('<p>resuelto</p>');
    expect(res.body.document.contentVersion).toBe(1);
    expect((await lastAuditFor(code))?.action).toBe(
      `Consolidó cambios concurrentes en documento ${code}`,
    );
  });

  it('409s with the same CONTENT_VERSION_CONFLICT shape PATCH uses', async () => {
    const code = await makeDoc({ content: '<p>base</p>' });
    await prisma.document.update({ where: { code }, data: { contentVersion: 4 } });

    const res = await request(app)
      .post(`/documents/${code}/merge`)
      .set(auth(users.elaborador))
      .send({ content: '<p>resuelto</p>', contentVersion: 0 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONTENT_VERSION_CONFLICT');
    expect(res.body.error.details).toMatchObject({
      code,
      clientContentVersion: 0,
      serverContentVersion: 4,
      clientContent: '<p>resuelto</p>',
      serverContent: '<p>base</p>',
    });
  });

  it('400s when no base version is supplied', async () => {
    const code = await makeDoc();
    const res = await request(app)
      .post(`/documents/${code}/merge`)
      .set(auth(users.elaborador))
      .send({ content: '<p>x</p>' });
    expect(res.status).toBe(400);
  });

  it('falls back to appending MERGE_RESOLUTION_TEXT when no content is sent', async () => {
    const code = await makeDoc({ content: '<p>base</p>' });
    const res = await request(app)
      .post(`/documents/${code}/merge`)
      .set(auth(users.elaborador))
      .send({ contentVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.document.content).toBe('<p>base</p>' + MERGE_RESOLUTION_TEXT);
  });
});

describe('POST /documents/:code/scan-import', () => {
  it('appends the rendered block, persists the ScanImport row, and audits', async () => {
    const code = await makeDoc({ content: '<p>base</p>' });

    const res = await request(app)
      .post(`/documents/${code}/scan-import`)
      .set(auth(users.elaborador))
      .send({
        inspector: 'Erick Murillo',
        resultado: 'Limpieza CIP completada de forma óptima sin alérgenos.',
        codigoRegistro: 'REG-FIS-099',
        fechaInspeccion: '2026-08-19',
      });

    expect(res.status).toBe(201);
    expect(res.body.document.content).toContain('[DATOS IMPORTADOS DE FORMATO FÍSICO ESCANEADO]');
    expect(res.body.document.content).toContain('REG-FIS-099');
    expect(res.body.document.content).toContain('2026-08-19');
    expect(res.body.document.content.startsWith('<p>base</p>')).toBe(true);
    expect(res.body.document.contentVersion).toBe(1);

    const rows = await prisma.scanImport.findMany({ where: { documentCode: code } });
    expect(rows).toHaveLength(1);
    expect((rows[0]!.payload as { inspector: string }).inspector).toBe('Erick Murillo');
    expect(rows[0]!.createdBy).toBe(users.elaborador.name);
  });

  it('HTML-escapes the submitted values', async () => {
    const code = await makeDoc({ content: '' });
    const res = await request(app)
      .post(`/documents/${code}/scan-import`)
      .set(auth(users.elaborador))
      .send({ inspector: '<script>x</script>', resultado: 'ok' });

    expect(res.body.document.content).not.toContain('<script>');
    expect(res.body.document.content).toContain('&lt;script&gt;');
  });

  it('400s on a missing inspector', async () => {
    const code = await makeDoc();
    const res = await request(app)
      .post(`/documents/${code}/scan-import`)
      .set(auth(users.elaborador))
      .send({ resultado: 'ok' });
    expect(res.status).toBe(400);
  });
});

describe('signed-Registro content freeze (agrees with PATCH /documents/:code)', () => {
  const frozen = () => makeDoc({ nivel: 'Registro', signedBy: [users.aprobador] });

  it('423s a scan-import into a signed Registro', async () => {
    const code = await frozen();
    const res = await request(app)
      .post(`/documents/${code}/scan-import`)
      .set(auth(users.elaborador))
      .send({ inspector: 'x', resultado: 'y' });
    expect(res.status).toBe(423);
  });

  it('423s a merge into a signed Registro', async () => {
    const code = await frozen();
    const res = await request(app)
      .post(`/documents/${code}/merge`)
      .set(auth(users.elaborador))
      .send({ content: '<p>x</p>', contentVersion: 0 });
    expect(res.status).toBe(423);
  });

  it('423s a version restore into a signed Registro', async () => {
    const code = await makeDoc({
      nivel: 'Registro',
      signedBy: [users.aprobador],
      revisiones: ['v1.0 - Emisión inicial'],
    });
    const res = await request(app)
      .post(`/documents/${code}/versions/0/restore`)
      .set(auth(users.elaborador));
    expect(res.status).toBe(423);
  });

  it('still allows a new version number on a signed Registro (no content write)', async () => {
    const code = await makeDoc({
      nivel: 'Registro',
      signedBy: [users.aprobador],
      version: 'v1.0',
    });
    const res = await request(app).post(`/documents/${code}/versions`).set(auth(users.elaborador));
    expect(res.status).toBe(201);
    expect(res.body.document.version).toBe('v1.1');
  });
});
