/**
 * Shared constants for the `DocumentFooterConfig` singleton — Control
 * Documental's "Pie de página" tab (`cfg.footer` in `ControlDocumental.jsx`).
 *
 * The route (`src/routes/documentFooter.ts`) builds its zod schema from
 * these; `GET /document-footer` falls back to `DEFAULT_FOOTER_CONFIG` when
 * the row is missing, exactly like `/coding-rule` does with
 * `DEFAULT_CODING_RULE`.
 */

/** Footer layout options — `FOOTER_TPLS` ids in `ControlDocumental.jsx`. */
export const FOOTER_TEMPLATES = [
  'firmasTabla',
  'firmasManuscritas',
  'clasificacion',
  'barra',
  'vigor',
] as const;
export type FooterTemplate = (typeof FOOTER_TEMPLATES)[number];

/** Confidentiality label options — the "Clasificación de confidencialidad"
 * `<select>` in the "Pie de página" tab. */
export const FOOTER_CLASIFICACIONES = [
  'Documento de uso interno',
  'Documento público',
  'Confidencial',
  'Restringido',
] as const;
export type FooterClasificacion = (typeof FOOTER_CLASIFICACIONES)[number];

export interface DocumentFooterConfigShape {
  tpl: FooterTemplate;
  clasificacion: FooterClasificacion;
  leyenda: string;
  qr: boolean;
  hash: boolean;
  impresion: boolean;
  mostrarCargo: boolean;
  mostrarFecha: boolean;
}

/** Matches `DEFAULT.footer` in `ControlDocumental.jsx` and the migration seed. */
export const DEFAULT_FOOTER_CONFIG: DocumentFooterConfigShape = {
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
