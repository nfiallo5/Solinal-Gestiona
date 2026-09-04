/**
 * Shared constants for the `DocumentSignatureFlowConfig` singleton — Control
 * Documental's "Flujo de firmas" card, inside the "Pie de página" tab
 * (`cfg.ctrl.participacionDueno` + the per-stage table in
 * `ControlDocumental.jsx`).
 *
 * The route (`src/routes/documentSignatureFlow.ts`) builds its zod schema
 * from these; `GET /document-signature-flow` falls back to
 * `DEFAULT_SIGNATURE_FLOW_CONFIG` when the row is missing, exactly like
 * `/coding-rule` does with `DEFAULT_CODING_RULE`.
 */

/** The 3 review-and-approval stages, fixed order — the rows of the "Flujo de
 * firmas" table. */
export const FLUJO_FIRMAS_ETAPAS = ['Elaboró', 'Revisó', 'Aprobó'] as const;
export type FlujoFirmasEtapa = (typeof FLUJO_FIRMAS_ETAPAS)[number];

/**
 * Role options in the "Rol que firma" `<select>`. Illustrative vocabulary
 * local to this Control Documental tab — NOT the real `RoleName` enum
 * (`Administrador` / `Elaborador` / `Revisor` / `Aprobador` / `Lector`) that
 * `requireAuth` / `requireAdmin` gate on.
 */
export const FLUJO_FIRMAS_ROLES = [
  'Dueño de proceso',
  'Coordinador de calidad',
  'Alta dirección',
  'Administrador',
] as const;
export type FlujoFirmasRol = (typeof FLUJO_FIRMAS_ROLES)[number];

export interface FlujoFirmasEtapaShape {
  etapa: FlujoFirmasEtapa;
  rol: FlujoFirmasRol;
  obligatoria: boolean;
}

export interface DocumentSignatureFlowConfigShape {
  participacionDueno: boolean;
  etapas: [FlujoFirmasEtapaShape, FlujoFirmasEtapaShape, FlujoFirmasEtapaShape];
}

/** Matches `cfg.ctrl.participacionDueno` + `cfg.flujoFirmas` (DEFAULT in
 * ControlDocumental.jsx) and the migration seed. */
export const DEFAULT_SIGNATURE_FLOW_CONFIG: DocumentSignatureFlowConfigShape = {
  participacionDueno: true,
  etapas: [
    { etapa: 'Elaboró', rol: 'Dueño de proceso', obligatoria: true },
    { etapa: 'Revisó', rol: 'Coordinador de calidad', obligatoria: true },
    { etapa: 'Aprobó', rol: 'Alta dirección', obligatoria: true },
  ],
};
