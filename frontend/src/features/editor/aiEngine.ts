/**
 * Simulated AI logic — direct port of reference/legacy_vanilla/js/ai.js.
 * No real LLM call: every "response" is static/deterministic, exactly like
 * the legacy prototype. Callers are responsible for the setTimeout-based
 * "thinking" delay (kept in the UI components so loading state stays local
 * to each interaction).
 */
import type { SolinalDocument } from "@/data/seed";

export interface ChatReply {
  text: string;
  actionLabel: string;
  insertText: string;
}

/** Port of sendPromptToAI's branching + insertProposedTextToEditor.
 * `insertText` is HTML, appended directly into the contentEditable
 * document body (see ContentEditor.tsx). */
export function getChatReply(prompt: string): ChatReply {
  const lower = prompt.toLowerCase();
  if (lower.includes("inocuidad") || lower.includes("haccp")) {
    return {
      text: "He redactado una propuesta de control crítico HACCP adaptada a Solinal. Secciones: 1. Puntos Críticos de Control (PCC), 2. Límites Críticos y 3. Sistema de Vigilancia.",
      actionLabel: "Insertar propuesta",
      insertText:
        "<p><strong>[PROPUESTA IA - PLAN HACCP]</strong></p><ul>" +
        "<li><strong>Puntos Críticos (PCC):</strong> Fritura de papas.</li>" +
        "<li><strong>Límites Críticos:</strong> Humedad &lt; 2%, Temperatura &gt; 175°C.</li>" +
        "<li><strong>Vigilancia:</strong> Sensor digital calibrado y registro de bitácora por hora.</li></ul>",
    };
  }
  return {
    text: "Basado en el contexto de tu consulta, he generado la sección solicitada conforme a los estándares de auditoría de la norma ISO.",
    actionLabel: "Insertar texto",
    insertText:
      "<p><strong>[SECCIÓN GENERADA CON IA]</strong></p><p>Definición del procedimiento operativo: Todos los controles de muestreo deben registrarse en tiempo real usando firmas electrónicas del elaborador a cargo.</p>",
  };
}

/** Port of triggerRiskAnalysis. */
export const riskAnalysisText =
  'Inconsistencia detectada: La frecuencia de verificación en la sección de control de registros es vaga ("de forma regular"). Recomiendo cambiar por "Diario al cierre de turno".\n\nAlerta: No se ha definido el procedimiento de acciones correctivas ante desvíos de límites de fritura.';

/** Port of runAISummary. */
export function multiDocSummaryText(selectedCodes: string[]): string {
  return (
    `Resumen IA consolidado (${selectedCodes.length} documentos):\n\n` +
    "• Objetivos unificados: Asegurar la calidad organoléptica y de inocuidad en el proceso de fritura de papas fritas.\n" +
    "• Límites regulatorios: Se identificaron concordancias en el control de temperatura y retención de registros.\n" +
    "• Recomendación: Homologar los códigos y firmas del flujo para que no existan desvíos en auditorías de ISO 22000."
  );
}

/** Port of triggerScanner's injected text block (HTML, appended to the
 * contentEditable document body). */
export const scannerImportText =
  "<p><strong>[DATOS IMPORTADOS DE FORMATO FÍSICO ESCANEADO]</strong></p><ul>" +
  "<li><strong>Código de Registro:</strong> REG-FIS-099</li>" +
  `<li><strong>Fecha de Inspección:</strong> ${new Date().toISOString().slice(0, 10)}</li>` +
  "<li><strong>Inspector:</strong> Erick Murillo</li>" +
  "<li><strong>Resultado del Control:</strong> Limpieza CIP completada de forma óptima sin alérgenos.</li></ul>";

/** Norma with a pending international update — any document filed under it triggers
 * the regulatory-change alert automatically when opened in the Editor. */
export const NORMA_CON_CAMBIO_PENDIENTE = "ISO 22000:2018";

/** Marker text used to detect whether a document's content already has the
 * regulatory update applied, so the alert doesn't reappear after "Aplicar cambios". */
export const REGULATION_UPDATE_MARKER = "[ACTUALIZACIÓN REGULATORIA AUTOMÁTICA ISO 22000:2026]";

/** Port of applyNormativeUpdateInEditor's injected text block (HTML,
 * appended to the contentEditable document body). */
export const regulationUpdateText =
  `<p><strong>${REGULATION_UPDATE_MARKER}</strong></p><ul><li>Se incorpora la enmienda de mitigación del cambio climático y controles ambientales en el plan de inocuidad.</li></ul>`;

/** Port of confirmMergeSimulated's injected text block. */
export const mergeResolutionText =
  "<ul><li>Medición con termómetro infrarrojo calibrado. (Fusión consolidada)</li></ul>";

/** Port of rebuildEditorLeftGuide — left column guide/template panel copy. */
export interface GuideCard {
  tone: "info" | "blue" | "green" | "amber";
  title: string;
  body: string;
}

export function buildEditorGuide(doc: SolinalDocument): GuideCard[] {
  const isBlank = doc.content.trim() === "";
  if (isBlank) {
    return [
      {
        tone: "info",
        title: "Documento vacío",
        body: "Estás redactando desde cero. Sigue estos pasos clave: 1. Definir Alcance — establece con exactitud qué procesos de la planta abarca. 2. Responsables — lista las áreas involucradas (Calidad, Fritura). 3. Requisitos ISO — asocia este borrador con la norma reguladora.",
      },
    ];
  }
  return [
    {
      tone: "blue",
      title: "Estructura recomendada",
      body: `Se recomienda enlazar este ${doc.type} bajo la norma ${doc.norma} en el capítulo de procesos operativos.`,
    },
    {
      tone: "green",
      title: "Integración ISO",
      body: "Mantener un tiempo de retención de firma digital de al menos 3 años para sustentar auditorías de inocuidad.",
    },
    {
      tone: "amber",
      title: "Tip de auditor",
      body: "Recuerda colocar límites claros en las temperaturas y bitácora de limpieza CIP para cumplir ISO 22000.",
    },
  ];
}
