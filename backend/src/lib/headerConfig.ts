/**
 * Shared constants for the `DocumentHeaderConfig` singleton — Control
 * Documental's "Encabezado" tab (`cfg.header` in `ControlDocumental.jsx`).
 *
 * The route (`src/routes/documentHeader.ts`) builds its zod schema from these;
 * `GET /document-header` falls back to `DEFAULT_HEADER_CONFIG` when the row is
 * missing, exactly like `/coding-rule` does with `DEFAULT_CODING_RULE`.
 */

/** Header layout options — `HEADER_TPLS` ids in `ControlDocumental.jsx`. */
export const HEADER_TEMPLATES = [
  'tripartito',
  'proceso',
  'institucional',
  'manual',
  'linea',
] as const;
export type HeaderTemplate = (typeof HEADER_TEMPLATES)[number];

/** Table border styling for the header. */
export const HEADER_BORDES = ['completo', 'suave'] as const;
export type HeaderBordes = (typeof HEADER_BORDES)[number];

/**
 * Every toggleable header field, in the order the "Encabezado" tab lists them
 * ("Identificación y descripción", then "Formato y medio", then "Estado y
 * vigencia"). The set is fixed: adding a checkbox in the UI means adding a key
 * here and in the migration's seed JSON.
 */
export const HEADER_CAMPO_KEYS = [
  'titulo',
  'codigo',
  'version',
  'fechaElaboracion',
  'fechaRevision',
  'fechaAprobacion',
  'autor',
  'responsable',
  'proceso',
  'tipoDoc',
  'idioma',
  'medio',
  'clasificacion',
  'objetivo',
  'logo',
  'razonSocial',
  'estado',
  'vigencia',
  'proximaRevision',
  'pagina',
] as const;
export type HeaderCampoKey = (typeof HEADER_CAMPO_KEYS)[number];

export type HeaderCampos = Record<HeaderCampoKey, boolean>;

export interface DocumentHeaderConfigShape {
  tpl: HeaderTemplate;
  campos: HeaderCampos;
  bordes: HeaderBordes;
  repetir: boolean;
}

/** Matches `DEFAULT.header` in `ControlDocumental.jsx` and the migration seed. */
export const DEFAULT_HEADER_CONFIG: DocumentHeaderConfigShape = {
  tpl: 'tripartito',
  bordes: 'completo',
  repetir: true,
  campos: {
    titulo: true,
    codigo: true,
    version: true,
    fechaElaboracion: true,
    fechaRevision: true,
    fechaAprobacion: false,
    autor: true,
    responsable: true,
    proceso: true,
    tipoDoc: true,
    idioma: false,
    medio: false,
    clasificacion: false,
    objetivo: false,
    logo: true,
    razonSocial: true,
    estado: true,
    vigencia: true,
    proximaRevision: false,
    pagina: true,
  },
};
