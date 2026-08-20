import type { DocumentType, TemplateLevel } from "@/data/seed";

export interface AITemplateProposal {
  name: string;
  norma: string;
  type: DocumentType;
  mandatory: string[];
  desc: string;
  nivel: TemplateLevel;
  clausulaIso: string;
  periodicidadRevision: "Anual" | "Bienal" | "Semestral" | "No aplica";
}

/** `type` (clasificación operativa) y `nivel` (pirámide documental) casi
 * siempre coinciden salvo Checklist, que documenta evidencia y por lo
 * tanto se ubica como Registro en la pirámide. */
const NIVEL_POR_TYPE: Record<DocumentType, TemplateLevel> = {
  Procedimiento: "Procedimiento",
  Política: "Política",
  Manual: "Manual",
  Instructivo: "Instructivo",
  Checklist: "Registro",
};

const NORMA_KEYWORDS: Array<{ match: RegExp; norma: string }> = [
  { match: /22000|inocuidad|haccp|al[eé]rgen|plaga/i, norma: "ISO 22000:2018" },
  { match: /14001|ambient|residuo|emisi[oó]n/i, norma: "ISO 14001:2015" },
  { match: /9001|calidad/i, norma: "ISO 9001:2015" },
];

const TYPE_KEYWORDS: Array<{ match: RegExp; type: DocumentType }> = [
  { match: /pol[ií]tica/i, type: "Política" },
  { match: /manual/i, type: "Manual" },
  { match: /checklist|lista de verificaci[oó]n/i, type: "Checklist" },
  { match: /instructivo|limpieza/i, type: "Instructivo" },
  { match: /procedimiento/i, type: "Procedimiento" },
];

function titleCase(text: string) {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Simulated AI draft — no real model call, just prompt keyword heuristics.
 * Mirrors the intent of the legacy generateTemplateByAI() canned response
 * (reference/legacy_vanilla/js/templates.js), but the suggestion is derived
 * from the user's actual prompt text instead of always returning the same
 * fixed "Control de Plagas" copy.
 */
export function simulateAIProposal(prompt: string): AITemplateProposal {
  const norma = NORMA_KEYWORDS.find((k) => k.match.test(prompt))?.norma ?? "ISO 9001:2015";
  const type = TYPE_KEYWORDS.find((k) => k.match.test(prompt))?.type ?? "Procedimiento";
  const cleanPrompt = prompt.trim().replace(/\.$/, "");
  const name = `Plantilla de ${titleCase(cleanPrompt.slice(0, 60))}`;

  return {
    name,
    norma,
    type,
    mandatory: ["Alcance", "Responsabilidades", "Registros y evidencia", "Acciones correctivas"],
    desc: `Estructura sugerida por Copilot IA para "${cleanPrompt}" bajo ${norma}.`,
    nivel: NIVEL_POR_TYPE[type],
    clausulaIso: "",
    periodicidadRevision: "Anual",
  };
}
