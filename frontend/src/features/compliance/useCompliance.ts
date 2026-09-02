import { useMemo } from "react";
import type { SolinalDocument } from "@/data/seed";
import { useDocuments, useTemplates } from "@/lib/queries";

export type ComplianceStatus = "valid" | "warning" | "danger";

export interface IsoScore {
  norma: string;
  label: string;
  sub: string;
  score: number;
  status: ComplianceStatus;
}

export interface RequirementRow {
  key: string;
  norma: string;
  /** A catalog type name — free text, like `SolinalDocument.type`. */
  type: string;
  label: string;
  status: ComplianceStatus;
  detail: string;
}

const NORMS = [
  {
    norma: "ISO 9001:2015",
    label: "ISO 9001:2015 (Calidad)",
    sub: "Requisitos cubiertos con documentación aprobada.",
    step: 15,
  },
  {
    norma: "ISO 14001:2015",
    label: "ISO 14001:2015 (Ambiente)",
    sub: "Control ambiental y registros asociados.",
    step: 16,
  },
  {
    norma: "ISO 22000:2018",
    label: "ISO 22000:2018 (Inocuidad)",
    sub: "Planes de inocuidad y verificación HACCP.",
    step: 13,
  },
] as const;

export function scoreStatus(score: number): ComplianceStatus {
  if (score >= 80) return "valid";
  if (score >= 50) return "warning";
  return "danger";
}

export function useComplianceScores(): IsoScore[] {
  const documents = useDocuments().data ?? [];
  return useMemo(() => {
    const approved = documents.filter((d) => d.estado === "Aprobado");
    return NORMS.map(({ norma, label, sub, step }) => {
      const count = approved.filter((d) => d.norma === norma).length;
      const score = Math.min(100, count * step);
      return { norma, label, sub, score, status: scoreStatus(score) };
    });
  }, [documents]);
}

function statusForDocs(docs: SolinalDocument[]): {
  status: ComplianceStatus;
  detail: string;
} {
  if (docs.length === 0) {
    return { status: "danger", detail: "Sin documentos asociados vigentes." };
  }
  const validDoc = docs.find((d) => d.estado === "Aprobado" && !d.vencido);
  if (validDoc) {
    return {
      status: "valid",
      detail: `Cubierto por ${validDoc.code} (${validDoc.version}, aprobado).`,
    };
  }
  const expiredDoc = docs.find((d) => d.estado === "Aprobado" && d.vencido);
  if (expiredDoc) {
    return {
      status: "warning",
      detail: `${expiredDoc.code} está vencido — requiere renovación de firmas.`,
    };
  }
  const inFlight = docs[0];
  return {
    status: "warning",
    detail: `${inFlight.code} en estado "${inFlight.estado}" — aún sin aprobación.`,
  };
}

export function useRequirementMapping(): RequirementRow[] {
  const documents = useDocuments().data ?? [];
  const templates = useTemplates().data ?? [];
  return useMemo(() => {
    const pairs = new Map<string, { norma: string; type: string }>();
    templates.forEach((t) =>
      pairs.set(`${t.norma}|${t.type}`, { norma: t.norma, type: t.type }),
    );
    documents.forEach((d) =>
      pairs.set(`${d.norma}|${d.type}`, { norma: d.norma, type: d.type }),
    );

    return Array.from(pairs.entries())
      .map(([key, { norma, type }]) => {
        const matchingTemplate = templates.find(
          (t) => t.norma === norma && t.type === type,
        );
        const matchingDocs = documents.filter(
          (d) => d.norma === norma && d.type === type,
        );
        const { status, detail } = statusForDocs(matchingDocs);
        return {
          key,
          norma,
          type,
          label: matchingTemplate ? matchingTemplate.name : `${type} — ${norma}`,
          status,
          detail,
        };
      })
      .sort(
        (a, b) => a.norma.localeCompare(b.norma) || a.type.localeCompare(b.type),
      );
  }, [documents, templates]);
}

export function useOrphanTemplates() {
  const documents = useDocuments().data ?? [];
  const templates = useTemplates().data ?? [];
  return useMemo(() => {
    return templates.filter((t) => {
      if (!t.documentoPadreKey) return false;
      const padre = templates.find((p) => p.key === t.documentoPadreKey);
      if (!padre) return true; // padre eliminado o mal referenciado
      const padreTieneDocAprobado = documents.some(
        (d) => d.norma === padre.norma && d.type === padre.type && d.estado === "Aprobado" && !d.vencido,
      );
      return !padreTieneDocAprobado;
    });
  }, [templates, documents]);
}
