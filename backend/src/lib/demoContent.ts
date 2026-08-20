/**
 * Canonical server-side copies of the static HTML blocks that
 * `src/features/editor/aiEngine.ts` injects into document content.
 *
 * The three "simulated" Editor flows (merge / scanner / regulation alert) are
 * becoming real endpoints, so the injected markup has to be produced by the
 * server. These strings are byte-identical to the frontend's so the UI keeps
 * looking exactly the same.
 *
 * Owned by the foundation layer only so the merge/scanner/regulation route
 * agents share one copy instead of each re-deriving it. Do not edit the markup
 * without editing `aiEngine.ts` to match.
 */

// ---------------------------------------------------------------------------
// Regulation alert — aiEngine.ts NORMA_CON_CAMBIO_PENDIENTE /
// REGULATION_UPDATE_MARKER / regulationUpdateText
// ---------------------------------------------------------------------------

/** The one norm that currently has a pending international update. */
export const NORMA_CON_CAMBIO_PENDIENTE = 'ISO 22000:2018';

/**
 * Idempotency marker. The banner hides once a document's content contains it,
 * so `POST /documents/:code/apply-regulation` must not append twice.
 */
export const REGULATION_UPDATE_MARKER = '[ACTUALIZACIÓN REGULATORIA AUTOMÁTICA ISO 22000:2026]';

/** HTML appended by the "Aplicar cambios" action. */
export const REGULATION_UPDATE_TEXT =
  `<p><strong>${REGULATION_UPDATE_MARKER}</strong></p><ul><li>Se incorpora la enmienda de mitigación del cambio climático y controles ambientales en el plan de inocuidad.</li></ul>`;

// ---------------------------------------------------------------------------
// Merge — aiEngine.ts mergeResolutionText
// ---------------------------------------------------------------------------

/** Default resolution snippet offered by MergeDialog.tsx. */
export const MERGE_RESOLUTION_TEXT =
  '<ul><li>Medición con termómetro infrarrojo calibrado. (Fusión consolidada)</li></ul>';

// ---------------------------------------------------------------------------
// Scanner — aiEngine.ts scannerImportText
// ---------------------------------------------------------------------------

export interface ScanImportPayload {
  /** Name of the person who performed the physical inspection. */
  inspector: string;
  /** Free-text outcome of the control. */
  resultado: string;
  /** Physical form code, e.g. "REG-FIS-099". Defaults to that value. */
  codigoRegistro?: string;
  /** "YYYY-MM-DD". Defaults to today. */
  fechaInspeccion?: string;
}

/**
 * Renders the block appended by `POST /documents/:code/scan-import`.
 * Same markup and field order as `aiEngine.ts#scannerImportText`, but with the
 * submitted values substituted in instead of hardcoded ones.
 */
export function renderScanImportHtml(payload: ScanImportPayload): string {
  const codigo = payload.codigoRegistro?.trim() || 'REG-FIS-099';
  const fecha = payload.fechaInspeccion?.trim() || new Date().toISOString().slice(0, 10);
  return (
    '<p><strong>[DATOS IMPORTADOS DE FORMATO FÍSICO ESCANEADO]</strong></p><ul>' +
    `<li><strong>Código de Registro:</strong> ${escapeHtml(codigo)}</li>` +
    `<li><strong>Fecha de Inspección:</strong> ${escapeHtml(fecha)}</li>` +
    `<li><strong>Inspector:</strong> ${escapeHtml(payload.inspector)}</li>` +
    `<li><strong>Resultado del Control:</strong> ${escapeHtml(payload.resultado)}</li></ul>`
  );
}

/** Minimal HTML escaping for user-supplied values interpolated into content. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
