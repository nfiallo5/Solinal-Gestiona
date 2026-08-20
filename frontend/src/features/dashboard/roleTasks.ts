import type { RoleName } from "@/data/seed";

export type TaskTone = "borrador" | "revision" | "aprobacion" | "vigente" | "rechazado";

export interface RoleTask {
  title: string;
  desc: string;
  badge: string;
  tone: TaskTone;
}

/**
 * Direct port of the per-role task lists hard-coded in
 * reference/legacy_vanilla/js/dashboard.js `window.rebuildDashboard()`.
 * Legacy badge `type` classes (s-aprobacion, s-rechazado, s-borrador,
 * s-revision, s-vigente) map to the `tone` field, rendered via
 * `TaskBadge` (see StatusPill.tsx).
 */
export const roleTasksByRole: Record<RoleName, RoleTask[]> = {
  Administrador: [
    {
      title: "Doble aprobación obligatoria",
      desc: "Validar co-firma de documento crítico POL-GER-003.",
      badge: "Aprobación Doble",
      tone: "aprobacion",
    },
    {
      title: "Auditar 3 documentos vencidos",
      desc: "Renovar firmas digitales obsoletas de checklist HACCP y Residuos.",
      badge: "Crítico",
      tone: "rechazado",
    },
    {
      title: "Habilitar políticas 2FA",
      desc: "Configurar token de inicio obligatorio en panel de Configuración.",
      badge: "Seguridad",
      tone: "borrador",
    },
  ],
  Elaborador: [
    {
      title: "Corregir Instructivo CIP rechazado",
      desc: "El revisor denegó INS-PRO-012 por falta de parámetros de temperatura.",
      badge: "Rechazado",
      tone: "rechazado",
    },
    {
      title: "Redactar documento en blanco",
      desc: "Generar el nuevo Instructivo de Fritura asistido por Asistente Copilot IA.",
      badge: "Borrador",
      tone: "borrador",
    },
  ],
  Revisor: [
    {
      title: "Evaluar Control de Calidad",
      desc: "Realizar revisión técnica y dejar comentarios en PRO-CAL-009 v1.2.",
      badge: "En revisión",
      tone: "revision",
    },
    {
      title: "Auditoría de Requisitos ISO 9001",
      desc: "Validar si la sección 8.4 cuenta con evidencia suficiente en los registros.",
      badge: "Norma",
      tone: "revision",
    },
  ],
  Aprobador: [
    {
      title: "Firmar Política de Inocuidad",
      desc: "Revisar declaración final y colocar firma digital en POL-GER-003.",
      badge: "Aprobación",
      tone: "aprobacion",
    },
    {
      title: "Validar Co-Firma Crítica",
      desc: "El documento PRO-SEG-005 requiere doble aprobación organizacional.",
      badge: "Firma 2/2",
      tone: "aprobacion",
    },
  ],
  Lector: [
    {
      title: "Leer Manual del SGC vigente",
      desc: "Consultar el alcance v3.1 de la planta de producción.",
      badge: "Lectura",
      tone: "vigente",
    },
    {
      title: "Verificar alérgenos en recepción",
      desc: "Revisar checklist vigente CHK-HAC-001.",
      badge: "Consulta",
      tone: "vigente",
    },
  ],
};
