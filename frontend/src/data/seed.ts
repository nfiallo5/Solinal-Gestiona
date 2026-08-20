/**
 * Seed / mock data — direct port of reference/legacy_vanilla/js/state.js
 * (plus the static role metadata found in js/users.js and the config
 * fields read/written by js/config.js).
 *
 * DO NOT invent new records here. If a Phase 1 feature needs more mock
 * data than what exists in the legacy app, add it in your own
 * feature/route file, not here — this file is the shared contract.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The 5 legacy document types (see SolinalGestiona_MVP.html template selects). */
export type DocumentType =
  | "Procedimiento"
  | "Política"
  | "Manual"
  | "Instructivo"
  | "Checklist";

export type DocumentStatus =
  | "Borrador"
  | "En aprobación"
  | "Aprobado"
  | "Rechazado";

export interface SolinalDocument {
  code: string;
  title: string;
  type: DocumentType;
  norma: string;
  estado: DocumentStatus;
  version: string;
  creador: string;
  /** true if the document is past its review/expiry date */
  vencido: boolean;
  /** true if the document is flagged as critical (may require double approval) */
  critico: boolean;
  /** Rich HTML, edited via the contentEditable surface in ContentEditor.tsx (execCommand-style toolbar, mirroring legacy `#ebody`). */
  content: string;
  signatures: string[];
  revisiones: string[];
  /** Copiado desde `template.nivel` al crear el documento desde una plantilla. Determina si el contenido se bloquea tras la primera firma (ver docStyles.esRegistroPorNivel). */
  nivel?: TemplateLevel;
  /** Copiado desde la plantilla de origen al crear el documento; guía a Editor.tsx sobre quién debe firmar. */
  rolesRequeridos?: {
    elaborador: RoleName;
    revisor: RoleName;
    aprobador: RoleName;
    dobleAprobacion: boolean;
  };
}

/** Nivel jerárquico dentro de la pirámide documental del SGC (ISO 9001:2015 cláusula 7.5). */
export type TemplateLevel =
  | "Política"
  | "Manual"
  | "Procedimiento"
  | "Instructivo"
  | "Registro";

export interface TemplateSection {
  titulo: string;
  /** Qué debe contener/lograr esta sección — no solo su nombre. */
  proposito: string;
  obligatoria: boolean;
}

export interface DocumentTemplate {
  key: string;
  name: string;
  norma: string;
  type: DocumentType;
  desc: string;
  preview: string;
  /** Rich HTML, seeded into a new document's `content` on creation. */
  content: string;

  /** @deprecated usar `secciones`. Se mantiene por compatibilidad con seed data y componentes existentes. */
  mandatory: string[];

  /** Nivel en la pirámide documental. Distinto de `type`, que es la clasificación operativa. */
  nivel: TemplateLevel;
  /** Cláusula específica de la norma que este documento cubre, ej. "7.5.3", "8.5.1". */
  clausulaIso: string;
  /** Estructura real de secciones, con propósito de cada una. */
  secciones: TemplateSection[];
  /** Cada cuánto debe revisarse el documento creado desde esta plantilla. */
  periodicidadRevision: "Anual" | "Bienal" | "Semestral" | "No aplica";
  /** Tiempo mínimo de conservación del documento/registro, en años. */
  tiempoRetencionAnios: number;
  /** `key` de la plantilla superior en la pirámide documental. Ausente si es de nivel raíz (Política o Manual). */
  documentoPadreKey?: string;
  /** Roles que deben participar en el ciclo de vida de un documento creado desde esta plantilla. */
  rolesRequeridos: {
    elaborador: RoleName;
    revisor: RoleName;
    aprobador: RoleName;
    /** Si true, replica la regla de doble firma que ya existe para `critico` en SolinalDocument. */
    dobleAprobacion: boolean;
  };
}

export interface AuditLogEntry {
  id: number;
  action: string;
  user: string;
  role: RoleName;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  ip: string;
}

export interface DocumentComment {
  code: string;
  author: string;
  date: string; // "YYYY-MM-DD HH:mm"
  text: string;
}

/** The 5 legacy roles, in Kanban column order (js/users.js). */
export type RoleName =
  | "Administrador"
  | "Elaborador"
  | "Revisor"
  | "Aprobador"
  | "Lector";

export interface AppUser {
  name: string;
  short: string;
  role: RoleName;
  /** Only present on users created via the "Nuevo usuario" modal (js/users.js). */
  status?: string;
  notes?: string;
}

export interface RoleMeta {
  role: RoleName;
  description: string;
  /** Legacy Tabler icon name, kept for reference — see Sidebar/Kanban for the lucide-react mapping. */
  legacyIcon: string;
}

/** Org-wide settings, ported from window.state config fields + js/config.js. */
export interface OrgConfig {
  orgName: string;
  brandColor: string;
  twoFactorEnabled: boolean;
  passwordPolicy: "weak" | "medium" | "strong";
  doubleApproval: "none" | "critical" | "all";
}

// ---------------------------------------------------------------------------
// Seed data (verbatim from legacy_vanilla/js/state.js)
//
// HISTORICAL / REFERENCE ONLY since the API landed. The running app reads all
// of this from PostgreSQL via `src/lib/api.ts`; the canonical copy of these
// rows now lives in `backend/prisma/seed.ts`, which was ported from here
// verbatim. Nothing under `src/` imports the `seed*` arrays any more — the
// still-live exports of this file are the TYPES plus `roleMeta`,
// `legacyPageOrder` and `lectorRestrictedPages`.
// ---------------------------------------------------------------------------

export const seedDocuments: SolinalDocument[] = [
  {
    code: "PRO-CAL-009",
    title: "Control de Calidad Producto Terminado",
    type: "Procedimiento",
    norma: "ISO 9001:2015",
    estado: "Borrador",
    version: "v1.2",
    creador: "Ana Torres",
    vencido: false,
    critico: false,
    content: "<p><strong>1. Alcance:</strong> Definir los criterios de calidad para la liberación de producto terminado en la planta de papas fritas.</p><p><strong>2. Responsabilidades:</strong> El jefe de calidad es responsable de realizar los muestreos.</p><p><strong>3. Desarrollo:</strong> Inspección organoléptica, medición de humedad (máx 2%) y control de sellado de bolsas.</p><p><strong>4. Control de registros:</strong> Formato REG-CAL-015 guardado en servidor por 3 años.</p><p><strong>5. Firmas:</strong> Elaborado por Ana Torres.</p>",
    signatures: [],
    revisiones: [
      "v1.1: Ajustes en límites de humedad",
      "v1.0: Carga inicial de procedimiento",
    ],
  },
  {
    code: "POL-GER-003",
    title: "Política de Inocuidad Alimentaria",
    type: "Política",
    norma: "ISO 22000:2018",
    estado: "En aprobación",
    version: "v2.0",
    creador: "Erick Murillo",
    vencido: false,
    critico: true,
    content: "<p><strong>1. Objetivo:</strong> Establecer el compromiso de Solinal S.A. con la inocuidad y cumplimiento normativo.</p><p><strong>2. Alcance:</strong> Aplicable a todo el personal de planta y administración.</p><p><strong>3. Declaración de Política:</strong> Elaborar alimentos seguros siguiendo los estándares HACCP e ISO 22000.</p><p><strong>4. Revisión:</strong> Anual por la gerencia.</p>",
    signatures: ["Erick Murillo"],
    revisiones: ["v1.0: Emisión inicial aprobada en 2024"],
  },
  {
    code: "MAN-CAL-001",
    title: "Manual del SGC",
    type: "Manual",
    norma: "ISO 9001:2015",
    estado: "Aprobado",
    version: "v3.1",
    creador: "Erick Murillo",
    vencido: false,
    critico: true,
    content: "<p><strong>1. Alcance:</strong> Sistema de Gestión de Calidad para la producción de papas fritas.</p><p><strong>2. Exclusiones:</strong> Ninguna.</p><p><strong>3. Procesos Clave:</strong> Recepción de papa, pelado, corte, fritura, empacado y despacho.</p><p>4. Política de Calidad integrada.</p>",
    signatures: ["Erick Murillo", "Carlos Ruiz"],
    revisiones: [
      "v3.0: Adecuación a nueva estructura",
      "v2.0: Revisión bienal",
    ],
  },
  {
    code: "INS-PRO-012",
    title: "Instructivo de Limpieza CIP",
    type: "Instructivo",
    norma: "ISO 22000:2018",
    estado: "Rechazado",
    version: "v1.0",
    creador: "Ana Torres",
    vencido: false,
    critico: false,
    content: "<p><strong>1. Preparación:</strong> Apagar línea de fritura y purgar remanente de aceite.</p><p><strong>2. Lavado cáustico:</strong> Circular solución de NaOH al 1.5% a 75°C durante 20 minutes.</p><p><strong>3. Enjuague:</strong> Con agua potable hasta pH neutro.</p><p><strong>4. Registro:</strong> Anotar en bitácora de limpieza.</p>",
    signatures: [],
    revisiones: [],
  },
  {
    code: "CHK-HAC-001",
    title: "Checklist Control de Alérgenos",
    type: "Checklist",
    norma: "ISO 22000:2018",
    estado: "Aprobado",
    version: "v1.5",
    creador: "Nicolas Fiallo",
    vencido: true,
    critico: false,
    content: "<p>1. Verificación de limpieza de línea tras procesar papas con sabor a queso.</p><p>2. Inspección visual de residuos de polvo sazonador.</p><p>3. Prueba rápida de flujo lateral para alérgenos de leche.</p><p>4. Liberación de línea por supervisor.</p>",
    signatures: ["Nicolas Fiallo"],
    revisiones: ["v1.4: Actualización de kit de prueba rápida"],
  },
  {
    code: "INS-AMB-002",
    title: "Registro de Residuos Sólidos",
    type: "Instructivo",
    norma: "ISO 14001:2015",
    estado: "Aprobado",
    version: "v1.0",
    creador: "Nicolas Fiallo",
    vencido: true,
    critico: false,
    content: "<p><strong>1. Objetivo:</strong> Registrar la cantidad de residuos orgánicos e inorgánicos generados diariamente.</p><p><strong>2. Disposición:</strong> Desechos de papa a compostaje; empaques plásticos a reciclaje.</p>",
    signatures: ["Nicolas Fiallo"],
    revisiones: [],
  },
  {
    code: "PRO-SEG-005",
    title: "Procedimiento de Trazabilidad y Retiro",
    type: "Procedimiento",
    norma: "ISO 22000:2018",
    estado: "Aprobado",
    version: "v2.1",
    creador: "Carlos Ruiz",
    vencido: true,
    critico: true,
    content: "<p><strong>1. Alcance:</strong> Trazabilidad de materia prima (papa, aceite, sazonador) hasta cliente final.</p><p><strong>2. Simulacro de retiro:</strong> Dos veces al año, meta de efectividad 98% en 4 horas.</p>",
    signatures: ["Carlos Ruiz"],
    revisiones: ["v2.0: Ajuste de tiempos de retiro"],
  },
];

export const seedTemplates: DocumentTemplate[] = [
  {
    key: "procedimiento",
    name: "Procedimiento ISO 9001",
    norma: "ISO 9001:2015",
    type: "Procedimiento",
    desc: "Estructura con alcance, responsabilidades, control de cambios y registros.",
    preview: "Incluye alcance, responsables, registros y control de cambios.",
    content: "<ol><li>Alcance</li><li>Responsabilidades</li><li>Recursos y controles</li><li>Registro de calidad</li><li>Control de cambios</li></ol>",
    mandatory: ["Alcance", "Responsabilidades"],
    nivel: "Procedimiento",
    clausulaIso: "7.5.1",
    periodicidadRevision: "Anual",
    tiempoRetencionAnios: 3,
    rolesRequeridos: {
      elaborador: "Elaborador",
      revisor: "Revisor",
      aprobador: "Aprobador",
      dobleAprobacion: false,
    },
    secciones: [
      { titulo: "Alcance", proposito: "Delimitar a qué procesos, áreas o productos aplica el documento.", obligatoria: true },
      { titulo: "Responsabilidades", proposito: "Definir quién ejecuta, revisa y aprueba cada actividad descrita.", obligatoria: true },
      { titulo: "Recursos y controles", proposito: "Listar recursos necesarios y puntos de control del proceso.", obligatoria: false },
      { titulo: "Registro de calidad", proposito: "Indicar qué evidencia se genera y dónde se almacena.", obligatoria: true },
      { titulo: "Control de cambios", proposito: "Historial de versiones y motivo de cada cambio.", obligatoria: true },
    ],
  },
  {
    key: "politica",
    name: "Política de Calidad",
    norma: "ISO 9001:2015",
    type: "Política",
    desc: "Documento maestro con firma obligatoria y revisión anual.",
    preview: "Incluye firma obligatoria, revisión anual y autoridad responsable.",
    content: "<ol><li>Objetivo</li><li>Alcance</li><li>Declaración de política</li><li>Responsabilidades</li><li>Revisión y firma</li></ol>",
    mandatory: ["Declaración de política", "Firma"],
    nivel: "Política",
    clausulaIso: "5.2",
    periodicidadRevision: "Anual",
    tiempoRetencionAnios: 5,
    rolesRequeridos: {
      elaborador: "Elaborador",
      revisor: "Revisor",
      aprobador: "Aprobador",
      dobleAprobacion: true,
    },
    secciones: [
      { titulo: "Objetivo", proposito: "Explicar el propósito general de la política.", obligatoria: false },
      { titulo: "Alcance", proposito: "Delimitar a qué áreas y personal aplica.", obligatoria: false },
      { titulo: "Declaración de política", proposito: "Enunciar el compromiso formal de la dirección.", obligatoria: true },
      { titulo: "Responsabilidades", proposito: "Definir quién difunde y sostiene el cumplimiento de la política.", obligatoria: false },
      { titulo: "Revisión y firma", proposito: "Registrar la aprobación de la dirección y la periodicidad de revisión.", obligatoria: true },
    ],
  },
  {
    key: "checklist",
    name: "Checklist HACCP",
    norma: "ISO 22000:2018",
    type: "Checklist",
    desc: "Formato verificable con alérgenos y responsables.",
    preview: "Incluye puntos de control, evidencia y responsables de verificación.",
    content: "<ol><li>Inspección de calidad</li><li>Verificación de temperatura</li><li>Confirmación de proveedores</li><li>Registro de no conformidades</li></ol>",
    mandatory: ["Puntos de control"],
    nivel: "Registro",
    clausulaIso: "8.5.1",
    periodicidadRevision: "Semestral",
    tiempoRetencionAnios: 2,
    rolesRequeridos: {
      elaborador: "Elaborador",
      revisor: "Revisor",
      aprobador: "Aprobador",
      dobleAprobacion: false,
    },
    secciones: [
      { titulo: "Inspección de calidad", proposito: "Punto de control verificable con evidencia de cumplimiento.", obligatoria: true },
      { titulo: "Verificación de temperatura", proposito: "Punto de control verificable con evidencia de cumplimiento.", obligatoria: true },
      { titulo: "Confirmación de proveedores", proposito: "Punto de control verificable con evidencia de cumplimiento.", obligatoria: true },
      { titulo: "Registro de no conformidades", proposito: "Evidencia de desvíos detectados y su seguimiento.", obligatoria: true },
    ],
  },
  {
    key: "instructivo",
    name: "Instructivo de Limpieza",
    norma: "ISO 22000:2018",
    type: "Instructivo",
    desc: "Guía paso a paso para control de higiene y actividades operativas.",
    preview: "Incluye pasos, herramientas necesarias y evidencia de control.",
    content: "<ol><li>Preparación</li><li>Enjuague inicial</li><li>Aplicación de detergente</li><li>Enjuague final</li><li>Verificación de limpieza</li></ol>",
    mandatory: ["Pasos de limpieza"],
    nivel: "Instructivo",
    clausulaIso: "8.5.1",
    periodicidadRevision: "Anual",
    tiempoRetencionAnios: 3,
    documentoPadreKey: "procedimiento",
    rolesRequeridos: {
      elaborador: "Elaborador",
      revisor: "Revisor",
      aprobador: "Aprobador",
      dobleAprobacion: false,
    },
    secciones: [
      { titulo: "Preparación", proposito: "Condiciones y equipo necesarios antes de iniciar la limpieza.", obligatoria: true },
      { titulo: "Enjuague inicial", proposito: "Paso operativo de la secuencia de limpieza.", obligatoria: true },
      { titulo: "Aplicación de detergente", proposito: "Paso operativo de la secuencia de limpieza.", obligatoria: true },
      { titulo: "Enjuague final", proposito: "Paso operativo de la secuencia de limpieza.", obligatoria: true },
      { titulo: "Verificación de limpieza", proposito: "Evidencia de que la limpieza cumplió el estándar esperado.", obligatoria: true },
    ],
  },
];

export const seedAuditLogs: AuditLogEntry[] = [
  {
    id: 1,
    action: "Documento POL-GER-003 aprobado",
    user: "Carlos Ruiz",
    role: "Aprobador",
    date: "2026-06-20",
    time: "09:14",
    ip: "190.45.23.10",
  },
  {
    id: 2,
    action: "Documento INS-PRO-012 rechazado",
    user: "Ana Torres",
    role: "Revisor",
    date: "2026-06-19",
    time: "16:08",
    ip: "190.45.23.82",
  },
  {
    id: 3,
    action: "Usuario añadido al sistema (Ana Torres)",
    user: "Erick Murillo",
    role: "Administrador",
    date: "2026-06-17",
    time: "11:42",
    ip: "190.45.23.66",
  },
  {
    id: 4,
    action: "Documento MAN-CAL-001 restaurado a v3.1",
    user: "Erick Murillo",
    role: "Administrador",
    date: "2026-06-17",
    time: "10:05",
    ip: "190.45.23.66",
  },
];

export const seedComments: DocumentComment[] = [
  {
    code: "PRO-CAL-009",
    author: "Ana Torres",
    date: "2026-06-21 00:30",
    text: "¿Se requiere agregar la firma del director de planta aquí?",
  },
  {
    code: "POL-GER-003",
    author: "Carlos Ruiz",
    date: "2026-06-20 18:45",
    text: "Esta política debe ser difundida a todos los colaboradores antes de fin de mes.",
  },
];

export const seedUsers: AppUser[] = [
  { name: "Erick Murillo", short: "EM", role: "Administrador" },
  { name: "Nicolas Fiallo", short: "NF", role: "Elaborador" },
  { name: "Ana Torres", short: "AT", role: "Revisor" },
  { name: "Carlos Ruiz", short: "CR", role: "Aprobador" },
  { name: "Lector Simulado", short: "LS", role: "Lector" },
];

/** Role list + description + legacy icon, ported from js/users.js renderKanban(). */
export const roleMeta: RoleMeta[] = [
  {
    role: "Administrador",
    description: "Acceso total y control global",
    legacyIcon: "ti-crown",
  },
  {
    role: "Elaborador",
    description: "Creación de borradores",
    legacyIcon: "ti-pencil",
  },
  {
    role: "Revisor",
    description: "Comentarios técnicos",
    legacyIcon: "ti-search",
  },
  {
    role: "Aprobador",
    description: "Firma y doble validación",
    legacyIcon: "ti-shield-check",
  },
  {
    role: "Lector",
    description: "Consulta de aprobados",
    legacyIcon: "ti-eye",
  },
];

/** Legacy `window.pages` order, used to build the sidebar / router 1:1. */
export const legacyPageOrder = [
  "dash",
  "docs",
  "edit",
  "comp",
  "templates",
  "audit",
  "users",
  "config",
] as const;

/** Pages the "Lector" role cannot access (js/navigation.js goPage / applyRoleRestrictiveness). */
export const lectorRestrictedPages: Array<(typeof legacyPageOrder)[number]> = [
  "edit",
  "templates",
  "audit",
  "config",
];

export const seedConfig: OrgConfig = {
  orgName: "Solinal S.A.",
  brandColor: "#1B4F8A",
  twoFactorEnabled: false,
  passwordPolicy: "strong",
  doubleApproval: "critical",
};

/** Initial active session values (window.state.activeRole / activeUser / etc). */
export const initialSession = {
  isAuthenticated: false,
  activeRole: "Administrador" as RoleName,
  activeUser: "Erick Murillo",
  isLocked: false,
  failedAttempts: 0,
  activeDocCode: "PRO-CAL-009",
  isSectionLocked: false,
};
