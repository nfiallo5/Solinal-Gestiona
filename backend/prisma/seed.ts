/**
 * Database seed — a verbatim port of `../../frontend/src/data/seed.ts` plus
 * the demo credentials from `../../frontend/src/features/auth/credentials.ts`.
 *
 * Goal: after `npx prisma db seed`, the app looks EXACTLY as it does today
 * with the in-memory reducer state.
 *
 *   7 documents · 4 templates · 4 audit logs · 2 comments · 5 users ·
 *   1 org config · 1 regulation alert
 *
 * IDEMPOTENCY: safe to re-run. Seed rows are upserted back to their baseline
 * (a re-run RESTORES the demo state, so local edits to seed rows are reset —
 * that is the intent). Rows created at runtime that are not part of the seed
 * are left untouched.
 *
 *   npm run prisma:seed
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  NORMA_CON_CAMBIO_PENDIENTE,
  REGULATION_UPDATE_MARKER,
  REGULATION_UPDATE_TEXT,
} from '../src/lib/demoContent.js';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// 1. Users — seedUsers (seed.ts) x demoCredentials (credentials.ts)
// ---------------------------------------------------------------------------

interface SeedUser {
  name: string;
  short: string;
  role: Prisma.UserCreateInput['role'];
  email: string;
  password: string;
}

const seedUsers: SeedUser[] = [
  { name: 'Erick Murillo', short: 'EM', role: 'Administrador', email: 'admin@solinal.com', password: 'admin2026' },
  { name: 'Nicolas Fiallo', short: 'NF', role: 'Elaborador', email: 'elaborador@solinal.com', password: 'elaborador2026' },
  { name: 'Ana Torres', short: 'AT', role: 'Revisor', email: 'revisor@solinal.com', password: 'revisor2026' },
  { name: 'Carlos Ruiz', short: 'CR', role: 'Aprobador', email: 'aprobador@solinal.com', password: 'aprobador2026' },
  { name: 'Lector Simulado', short: 'LS', role: 'Lector', email: 'lector@solinal.com', password: 'lector2026' },
];

// ---------------------------------------------------------------------------
// 2. Documents — seedDocuments
//    `nivel` and `rolesRequeridos` are intentionally absent: the seed
//    documents predate templates, so both columns stay NULL.
// ---------------------------------------------------------------------------

interface SeedDocument {
  code: string;
  title: string;
  type: Prisma.DocumentCreateInput['type'];
  norma: string;
  estado: Prisma.DocumentCreateInput['estado'];
  version: string;
  creador: string;
  vencido: boolean;
  critico: boolean;
  content: string;
  signatures: string[];
  /** Newest first, exactly as in seed.ts. */
  revisiones: string[];
}

const seedDocuments: SeedDocument[] = [
  {
    code: 'PRO-CAL-009',
    title: 'Control de Calidad Producto Terminado',
    type: 'Procedimiento',
    norma: 'ISO 9001:2015',
    estado: 'Borrador',
    version: 'v1.2',
    creador: 'Ana Torres',
    vencido: false,
    critico: false,
    content:
      '<p><strong>1. Alcance:</strong> Definir los criterios de calidad para la liberación de producto terminado en la planta de papas fritas.</p><p><strong>2. Responsabilidades:</strong> El jefe de calidad es responsable de realizar los muestreos.</p><p><strong>3. Desarrollo:</strong> Inspección organoléptica, medición de humedad (máx 2%) y control de sellado de bolsas.</p><p><strong>4. Control de registros:</strong> Formato REG-CAL-015 guardado en servidor por 3 años.</p><p><strong>5. Firmas:</strong> Elaborado por Ana Torres.</p>',
    signatures: [],
    revisiones: ['v1.1: Ajustes en límites de humedad', 'v1.0: Carga inicial de procedimiento'],
  },
  {
    code: 'POL-GER-003',
    title: 'Política de Inocuidad Alimentaria',
    type: 'Política',
    norma: 'ISO 22000:2018',
    estado: 'En_aprobación',
    version: 'v2.0',
    creador: 'Erick Murillo',
    vencido: false,
    critico: true,
    content:
      '<p><strong>1. Objetivo:</strong> Establecer el compromiso de Solinal S.A. con la inocuidad y cumplimiento normativo.</p><p><strong>2. Alcance:</strong> Aplicable a todo el personal de planta y administración.</p><p><strong>3. Declaración de Política:</strong> Elaborar alimentos seguros siguiendo los estándares HACCP e ISO 22000.</p><p><strong>4. Revisión:</strong> Anual por la gerencia.</p>',
    signatures: ['Erick Murillo'],
    revisiones: ['v1.0: Emisión inicial aprobada en 2024'],
  },
  {
    code: 'MAN-CAL-001',
    title: 'Manual del SGC',
    type: 'Manual',
    norma: 'ISO 9001:2015',
    estado: 'Aprobado',
    version: 'v3.1',
    creador: 'Erick Murillo',
    vencido: false,
    critico: true,
    content:
      '<p><strong>1. Alcance:</strong> Sistema de Gestión de Calidad para la producción de papas fritas.</p><p><strong>2. Exclusiones:</strong> Ninguna.</p><p><strong>3. Procesos Clave:</strong> Recepción de papa, pelado, corte, fritura, empacado y despacho.</p><p>4. Política de Calidad integrada.</p>',
    signatures: ['Erick Murillo', 'Carlos Ruiz'],
    revisiones: ['v3.0: Adecuación a nueva estructura', 'v2.0: Revisión bienal'],
  },
  {
    code: 'INS-PRO-012',
    title: 'Instructivo de Limpieza CIP',
    type: 'Instructivo',
    norma: 'ISO 22000:2018',
    estado: 'Rechazado',
    version: 'v1.0',
    creador: 'Ana Torres',
    vencido: false,
    critico: false,
    content:
      '<p><strong>1. Preparación:</strong> Apagar línea de fritura y purgar remanente de aceite.</p><p><strong>2. Lavado cáustico:</strong> Circular solución de NaOH al 1.5% a 75°C durante 20 minutes.</p><p><strong>3. Enjuague:</strong> Con agua potable hasta pH neutro.</p><p><strong>4. Registro:</strong> Anotar en bitácora de limpieza.</p>',
    signatures: [],
    revisiones: [],
  },
  {
    code: 'CHK-HAC-001',
    title: 'Checklist Control de Alérgenos',
    type: 'Checklist',
    norma: 'ISO 22000:2018',
    estado: 'Aprobado',
    version: 'v1.5',
    creador: 'Nicolas Fiallo',
    vencido: true,
    critico: false,
    content:
      '<p>1. Verificación de limpieza de línea tras procesar papas con sabor a queso.</p><p>2. Inspección visual de residuos de polvo sazonador.</p><p>3. Prueba rápida de flujo lateral para alérgenos de leche.</p><p>4. Liberación de línea por supervisor.</p>',
    signatures: ['Nicolas Fiallo'],
    revisiones: ['v1.4: Actualización de kit de prueba rápida'],
  },
  {
    code: 'INS-AMB-002',
    title: 'Registro de Residuos Sólidos',
    type: 'Instructivo',
    norma: 'ISO 14001:2015',
    estado: 'Aprobado',
    version: 'v1.0',
    creador: 'Nicolas Fiallo',
    vencido: true,
    critico: false,
    content:
      '<p><strong>1. Objetivo:</strong> Registrar la cantidad de residuos orgánicos e inorgánicos generados diariamente.</p><p><strong>2. Disposición:</strong> Desechos de papa a compostaje; empaques plásticos a reciclaje.</p>',
    signatures: ['Nicolas Fiallo'],
    revisiones: [],
  },
  {
    code: 'PRO-SEG-005',
    title: 'Procedimiento de Trazabilidad y Retiro',
    type: 'Procedimiento',
    norma: 'ISO 22000:2018',
    estado: 'Aprobado',
    version: 'v2.1',
    creador: 'Carlos Ruiz',
    vencido: true,
    critico: true,
    content:
      '<p><strong>1. Alcance:</strong> Trazabilidad de materia prima (papa, aceite, sazonador) hasta cliente final.</p><p><strong>2. Simulacro de retiro:</strong> Dos veces al año, meta de efectividad 98% en 4 horas.</p>',
    signatures: ['Carlos Ruiz'],
    revisiones: ['v2.0: Ajuste de tiempos de retiro'],
  },
];

// ---------------------------------------------------------------------------
// 3. Templates — seedTemplates
// ---------------------------------------------------------------------------

interface SeedTemplate {
  key: string;
  name: string;
  norma: string;
  type: Prisma.DocumentTemplateCreateInput['type'];
  desc: string;
  preview: string;
  content: string;
  mandatory: string[];
  nivel: Prisma.DocumentTemplateCreateInput['nivel'];
  clausulaIso: string;
  periodicidadRevision: Prisma.DocumentTemplateCreateInput['periodicidadRevision'];
  tiempoRetencionAnios: number;
  documentoPadreKey?: string;
  rolesRequeridos: {
    elaborador: string;
    revisor: string;
    aprobador: string;
    dobleAprobacion: boolean;
  };
  secciones: { titulo: string; proposito: string; obligatoria: boolean }[];
}

const seedTemplates: SeedTemplate[] = [
  {
    key: 'procedimiento',
    name: 'Procedimiento ISO 9001',
    norma: 'ISO 9001:2015',
    type: 'Procedimiento',
    desc: 'Estructura con alcance, responsabilidades, control de cambios y registros.',
    preview: 'Incluye alcance, responsables, registros y control de cambios.',
    content:
      '<ol><li>Alcance</li><li>Responsabilidades</li><li>Recursos y controles</li><li>Registro de calidad</li><li>Control de cambios</li></ol>',
    mandatory: ['Alcance', 'Responsabilidades'],
    nivel: 'Procedimiento',
    clausulaIso: '7.5.1',
    periodicidadRevision: 'Anual',
    tiempoRetencionAnios: 3,
    rolesRequeridos: {
      elaborador: 'Elaborador',
      revisor: 'Revisor',
      aprobador: 'Aprobador',
      dobleAprobacion: false,
    },
    secciones: [
      { titulo: 'Alcance', proposito: 'Delimitar a qué procesos, áreas o productos aplica el documento.', obligatoria: true },
      { titulo: 'Responsabilidades', proposito: 'Definir quién ejecuta, revisa y aprueba cada actividad descrita.', obligatoria: true },
      { titulo: 'Recursos y controles', proposito: 'Listar recursos necesarios y puntos de control del proceso.', obligatoria: false },
      { titulo: 'Registro de calidad', proposito: 'Indicar qué evidencia se genera y dónde se almacena.', obligatoria: true },
      { titulo: 'Control de cambios', proposito: 'Historial de versiones y motivo de cada cambio.', obligatoria: true },
    ],
  },
  {
    key: 'politica',
    name: 'Política de Calidad',
    norma: 'ISO 9001:2015',
    type: 'Política',
    desc: 'Documento maestro con firma obligatoria y revisión anual.',
    preview: 'Incluye firma obligatoria, revisión anual y autoridad responsable.',
    content:
      '<ol><li>Objetivo</li><li>Alcance</li><li>Declaración de política</li><li>Responsabilidades</li><li>Revisión y firma</li></ol>',
    mandatory: ['Declaración de política', 'Firma'],
    nivel: 'Política',
    clausulaIso: '5.2',
    periodicidadRevision: 'Anual',
    tiempoRetencionAnios: 5,
    rolesRequeridos: {
      elaborador: 'Elaborador',
      revisor: 'Revisor',
      aprobador: 'Aprobador',
      dobleAprobacion: true,
    },
    secciones: [
      { titulo: 'Objetivo', proposito: 'Explicar el propósito general de la política.', obligatoria: false },
      { titulo: 'Alcance', proposito: 'Delimitar a qué áreas y personal aplica.', obligatoria: false },
      { titulo: 'Declaración de política', proposito: 'Enunciar el compromiso formal de la dirección.', obligatoria: true },
      { titulo: 'Responsabilidades', proposito: 'Definir quién difunde y sostiene el cumplimiento de la política.', obligatoria: false },
      { titulo: 'Revisión y firma', proposito: 'Registrar la aprobación de la dirección y la periodicidad de revisión.', obligatoria: true },
    ],
  },
  {
    key: 'checklist',
    name: 'Checklist HACCP',
    norma: 'ISO 22000:2018',
    type: 'Checklist',
    desc: 'Formato verificable con alérgenos y responsables.',
    preview: 'Incluye puntos de control, evidencia y responsables de verificación.',
    content:
      '<ol><li>Inspección de calidad</li><li>Verificación de temperatura</li><li>Confirmación de proveedores</li><li>Registro de no conformidades</li></ol>',
    mandatory: ['Puntos de control'],
    nivel: 'Registro',
    clausulaIso: '8.5.1',
    periodicidadRevision: 'Semestral',
    tiempoRetencionAnios: 2,
    rolesRequeridos: {
      elaborador: 'Elaborador',
      revisor: 'Revisor',
      aprobador: 'Aprobador',
      dobleAprobacion: false,
    },
    secciones: [
      { titulo: 'Inspección de calidad', proposito: 'Punto de control verificable con evidencia de cumplimiento.', obligatoria: true },
      { titulo: 'Verificación de temperatura', proposito: 'Punto de control verificable con evidencia de cumplimiento.', obligatoria: true },
      { titulo: 'Confirmación de proveedores', proposito: 'Punto de control verificable con evidencia de cumplimiento.', obligatoria: true },
      { titulo: 'Registro de no conformidades', proposito: 'Evidencia de desvíos detectados y su seguimiento.', obligatoria: true },
    ],
  },
  {
    key: 'instructivo',
    name: 'Instructivo de Limpieza',
    norma: 'ISO 22000:2018',
    type: 'Instructivo',
    desc: 'Guía paso a paso para control de higiene y actividades operativas.',
    preview: 'Incluye pasos, herramientas necesarias y evidencia de control.',
    content:
      '<ol><li>Preparación</li><li>Enjuague inicial</li><li>Aplicación de detergente</li><li>Enjuague final</li><li>Verificación de limpieza</li></ol>',
    mandatory: ['Pasos de limpieza'],
    nivel: 'Instructivo',
    clausulaIso: '8.5.1',
    periodicidadRevision: 'Anual',
    tiempoRetencionAnios: 3,
    documentoPadreKey: 'procedimiento',
    rolesRequeridos: {
      elaborador: 'Elaborador',
      revisor: 'Revisor',
      aprobador: 'Aprobador',
      dobleAprobacion: false,
    },
    secciones: [
      { titulo: 'Preparación', proposito: 'Condiciones y equipo necesarios antes de iniciar la limpieza.', obligatoria: true },
      { titulo: 'Enjuague inicial', proposito: 'Paso operativo de la secuencia de limpieza.', obligatoria: true },
      { titulo: 'Aplicación de detergente', proposito: 'Paso operativo de la secuencia de limpieza.', obligatoria: true },
      { titulo: 'Enjuague final', proposito: 'Paso operativo de la secuencia de limpieza.', obligatoria: true },
      { titulo: 'Verificación de limpieza', proposito: 'Evidencia de que la limpieza cumplió el estándar esperado.', obligatoria: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// 4. Audit logs — seedAuditLogs. Explicit ids, so `#{l.id}` in AuditLogTable
//    renders exactly as today. The sequence is bumped past them afterwards.
// ---------------------------------------------------------------------------

const seedAuditLogs = [
  { id: 1, action: 'Documento POL-GER-003 aprobado', user: 'Carlos Ruiz', role: 'Aprobador' as const, date: '2026-06-20', time: '09:14', ip: '190.45.23.10' },
  { id: 2, action: 'Documento INS-PRO-012 rechazado', user: 'Ana Torres', role: 'Revisor' as const, date: '2026-06-19', time: '16:08', ip: '190.45.23.82' },
  { id: 3, action: 'Usuario añadido al sistema (Ana Torres)', user: 'Erick Murillo', role: 'Administrador' as const, date: '2026-06-17', time: '11:42', ip: '190.45.23.66' },
  { id: 4, action: 'Documento MAN-CAL-001 restaurado a v3.1', user: 'Erick Murillo', role: 'Administrador' as const, date: '2026-06-17', time: '10:05', ip: '190.45.23.66' },
];

// ---------------------------------------------------------------------------
// 5. Comments — seedComments
// ---------------------------------------------------------------------------

const seedComments = [
  {
    code: 'PRO-CAL-009',
    author: 'Ana Torres',
    date: '2026-06-21 00:30',
    text: '¿Se requiere agregar la firma del director de planta aquí?',
  },
  {
    code: 'POL-GER-003',
    author: 'Carlos Ruiz',
    date: '2026-06-20 18:45',
    text: 'Esta política debe ser difundida a todos los colaboradores antes de fin de mes.',
  },
];

// ---------------------------------------------------------------------------
// 6. Org config — seedConfig (singleton, id = 1)
// ---------------------------------------------------------------------------

const seedConfig = {
  orgName: 'Solinal S.A.',
  brandColor: '#1B4F8A',
  twoFactorEnabled: false,
  passwordPolicy: 'strong' as const,
  doubleApproval: 'critical' as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" + "HH:mm" -> a local Date, for sortable `createdAt` values. */
function parseLocalDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Seeding Solinal Gestiona…');

  // --- Users --------------------------------------------------------------
  const userIdByName = new Map<string, string>();
  for (const u of seedUsers) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    const row = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        short: u.short,
        email: u.email,
        role: u.role,
        passwordHash,
      },
      update: {
        name: u.name,
        short: u.short,
        role: u.role,
        passwordHash,
        // Re-seeding clears any lockout left over from testing.
        failedAttempts: 0,
        lockedAt: null,
      },
    });
    userIdByName.set(row.name, row.id);
  }
  console.log(`  users:            ${seedUsers.length}`);

  const requireUserId = (name: string): string => {
    const id = userIdByName.get(name);
    if (!id) throw new Error(`Seed error: no user named "${name}".`);
    return id;
  };

  // --- Templates ----------------------------------------------------------
  // Two passes so `documentoPadreKey` self-references resolve regardless of
  // declaration order.
  for (const t of seedTemplates) {
    const base = {
      name: t.name,
      norma: t.norma,
      type: t.type,
      desc: t.desc,
      preview: t.preview,
      content: t.content,
      mandatory: t.mandatory,
      nivel: t.nivel,
      clausulaIso: t.clausulaIso,
      secciones: t.secciones as unknown as Prisma.InputJsonValue,
      periodicidadRevision: t.periodicidadRevision,
      tiempoRetencionAnios: t.tiempoRetencionAnios,
      rolesRequeridos: t.rolesRequeridos as unknown as Prisma.InputJsonValue,
    };
    await prisma.documentTemplate.upsert({
      where: { key: t.key },
      create: { key: t.key, ...base },
      update: base,
    });
  }
  for (const t of seedTemplates) {
    await prisma.documentTemplate.update({
      where: { key: t.key },
      data: { documentoPadreKey: t.documentoPadreKey ?? null },
    });
  }
  console.log(`  templates:        ${seedTemplates.length}`);

  // --- Documents (+ signatures, + revisiones) -----------------------------
  for (const d of seedDocuments) {
    const creadorId = requireUserId(d.creador);
    const base = {
      title: d.title,
      type: d.type,
      norma: d.norma,
      estado: d.estado,
      version: d.version,
      creadorId,
      creador: d.creador,
      vencido: d.vencido,
      critico: d.critico,
      content: d.content,
      // Seed documents predate templates: both columns stay NULL on purpose.
      nivel: null,
      rolesRequeridos: Prisma.DbNull,
      sectionLocked: false,
    };

    await prisma.document.upsert({
      where: { code: d.code },
      create: { code: d.code, ...base, contentVersion: 0 },
      update: base,
    });

    // Rebuild the two join tables from scratch so the seed is idempotent.
    await prisma.documentSignature.deleteMany({ where: { documentCode: d.code } });
    for (const [i, name] of d.signatures.entries()) {
      await prisma.documentSignature.create({
        data: {
          documentCode: d.code,
          userId: requireUserId(name),
          userName: name,
          // Ascending timestamps so `orderBy signedAt asc` reproduces the
          // original array order.
          signedAt: new Date(Date.UTC(2026, 5, 15, 12, i, 0)),
        },
      });
    }

    await prisma.documentRevision.deleteMany({ where: { documentCode: d.code } });
    // seed.ts stores revisiones NEWEST FIRST and the API serializes by
    // `id desc`, so insert in reverse to give the newest entry the highest id.
    for (const [i, text] of [...d.revisiones].reverse().entries()) {
      await prisma.documentRevision.create({
        data: {
          documentCode: d.code,
          text,
          createdAt: new Date(Date.UTC(2026, 5, 10, 12, i, 0)),
        },
      });
    }
  }
  console.log(`  documents:        ${seedDocuments.length}`);

  // --- Comments -----------------------------------------------------------
  for (const c of seedComments) {
    const existing = await prisma.documentComment.findFirst({
      where: { code: c.code, author: c.author, date: c.date, text: c.text },
    });
    if (existing) continue;
    await prisma.documentComment.create({
      data: {
        code: c.code,
        authorId: requireUserId(c.author),
        author: c.author,
        date: c.date,
        text: c.text,
        createdAt: parseLocalDateTime(c.date.slice(0, 10), c.date.slice(11)),
      },
    });
  }
  console.log(`  comments:         ${seedComments.length}`);

  // --- Audit logs ---------------------------------------------------------
  for (const l of seedAuditLogs) {
    const createdAt = parseLocalDateTime(l.date, l.time);
    const base = {
      action: l.action,
      user: l.user,
      role: l.role,
      date: l.date,
      time: l.time,
      ip: l.ip,
      createdAt,
    };
    await prisma.auditLogEntry.upsert({
      where: { id: l.id },
      create: { id: l.id, ...base },
      update: base,
    });
  }
  // Explicit ids do not advance the sequence — realign it or the first
  // runtime insert collides with id 1.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"AuditLogEntry"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "AuditLogEntry"), 1))`,
  );
  console.log(`  audit logs:       ${seedAuditLogs.length}`);

  // --- Org config (singleton) ---------------------------------------------
  await prisma.orgConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...seedConfig },
    update: seedConfig,
  });
  console.log('  org config:       1');

  // --- Coding rule ---------------------------------------------------------
  // Matches today's actual TIPO-AREA-NNN document codes exactly, so seeding
  // this row changes nothing until an Administrador edits the rule from
  // Control Documental's "Tipos y codificación" tab.
  const seedCodingRule = {
    tokens: ['TIPO', 'PROCESO', 'CORRELATIVO'],
    separador: '-',
    digitos: 3,
    prefijoVer: 'V',
    formatoAnio: '26',
    empresaSigla: 'SOL',
    unico: true,
    hereda: true,
  };
  await prisma.codingRule.upsert({
    where: { id: 1 },
    create: { id: 1, ...seedCodingRule },
    update: seedCodingRule,
  });
  console.log('  coding rule:      1');

  // --- Document header config --------------------------------------------
  // Matches DEFAULT.header in ControlDocumental.jsx, so seeding this row
  // changes nothing until an Administrador edits the "Encabezado" tab.
  const seedHeaderConfig = {
    tpl: 'tripartito',
    bordes: 'completo',
    repetir: true,
    campos: {
      titulo: true, codigo: true, version: true, fechaElaboracion: true,
      fechaRevision: true, fechaAprobacion: false, autor: true, responsable: true,
      proceso: true, tipoDoc: true, objetivo: false, logo: true, razonSocial: true,
      estado: true, vigencia: true, pagina: true,
    },
  };
  await prisma.documentHeaderConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...seedHeaderConfig },
    update: seedHeaderConfig,
  });
  console.log('  header config:    1');

  // --- Document footer config --------------------------------------------
  // Matches DEFAULT.footer in ControlDocumental.jsx, so seeding this row
  // changes nothing until an Administrador edits the "Pie de página" tab.
  const seedFooterConfig = {
    tpl: 'firmasTabla',
    clasificacion: 'Documento de uso interno',
    leyenda:
      '“COPIA NO CONTROLADA”: el departamento de Calidad no garantiza que esta impresión sea la última versión del documento.',
    qr: true,
    hash: false,
    impresion: true,
    mostrarCargo: true,
    mostrarFecha: true,
  };
  await prisma.documentFooterConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...seedFooterConfig },
    update: seedFooterConfig,
  });
  console.log('  footer config:    1');

  // --- Document signature-flow config -------------------------------------
  // Matches cfg.ctrl.participacionDueno + the Elaboró/Revisó/Aprobó table in
  // ControlDocumental.jsx, so seeding this row changes nothing until an
  // Administrador edits the "Flujo de firmas" card.
  const seedSignatureFlowConfig = {
    participacionDueno: true,
    etapas: [
      { etapa: 'Elaboró', rol: 'Dueño de proceso', obligatoria: true },
      { etapa: 'Revisó', rol: 'Coordinador de calidad', obligatoria: true },
      { etapa: 'Aprobó', rol: 'Alta dirección', obligatoria: true },
    ],
  };
  await prisma.documentSignatureFlowConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...seedSignatureFlowConfig },
    update: seedSignatureFlowConfig,
  });
  console.log('  signature flow:   1');

  // --- Regulation alert ---------------------------------------------------
  // Replaces the hardcoded consts in src/features/editor/aiEngine.ts.
  await prisma.regulationAlert.upsert({
    where: {
      norma_marker: {
        norma: NORMA_CON_CAMBIO_PENDIENTE,
        marker: REGULATION_UPDATE_MARKER,
      },
    },
    create: {
      norma: NORMA_CON_CAMBIO_PENDIENTE,
      marker: REGULATION_UPDATE_MARKER,
      bodyHtml: REGULATION_UPDATE_TEXT,
      active: true,
    },
    update: { bodyHtml: REGULATION_UPDATE_TEXT, active: true },
  });
  console.log('  regulation alert: 1');

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
