import { useMemo } from "react";
import type { SolinalDocument } from "@/data/seed";

export interface ComplianceScores {
  iso9001: number;
  iso14001: number;
  iso22000: number;
}

export interface DashboardMetrics {
  activeCount: number;
  publishedCount: number;
  inFlowCount: number;
  pendingApprovalsCount: number;
  borradorCount: number;
  vencidosCount: number;
  compliance: ComplianceScores;
  avgCompliance: number;
  keyDocs: SolinalDocument[];
  pendingCommentsCount: number;
}

/**
 * Direct port of window.calculateComplianceScores() from
 * reference/legacy_vanilla/js/dashboard.js — same base scores + per-doc
 * increments, capped at 100.
 */
export function calculateComplianceScores(
  documents: SolinalDocument[],
): ComplianceScores {
  const approved = documents.filter((d) => d.estado === "Aprobado");

  const iso9001 =
    40 + approved.filter((d) => d.norma === "ISO 9001:2015").length * 15;
  const iso14001 =
    50 + approved.filter((d) => d.norma === "ISO 14001:2015").length * 16;
  const iso22000 =
    35 + approved.filter((d) => d.norma === "ISO 22000:2018").length * 13;

  return {
    iso9001: Math.min(100, iso9001),
    iso14001: Math.min(100, iso14001),
    iso22000: Math.min(100, iso22000),
  };
}

/**
 * Derives the same dashboard stats as legacy `window.rebuildDashboard()`,
 * adapted to the seed data's DocumentStatus shape.
 *
 * NOTE (simplification vs legacy): the legacy prototype had a distinct
 * "En Revisión" document status feeding the "aprobaciones pendientes" sub
 * label. `src/data/seed.ts` only models
 * Borrador | "En aprobación" | Aprobado | Rechazado (no separate
 * "En Revisión" state), so the sub label below is derived from
 * "Borrador" instead — see Dashboard.tsx report notes.
 */
export function useDashboardMetrics(documents: SolinalDocument[]): DashboardMetrics {
  return useMemo(() => {
    const docs = documents;
    const publishedCount = docs.filter((d) => d.estado === "Aprobado").length;
    const activeCount = docs.length;
    const pendingApprovalsCount = docs.filter(
      (d) => d.estado === "En aprobación",
    ).length;
    const borradorCount = docs.filter((d) => d.estado === "Borrador").length;
    const vencidosCount = docs.filter((d) => d.vencido).length;
    const compliance = calculateComplianceScores(docs);
    const avgCompliance = Math.round(
      (compliance.iso9001 + compliance.iso14001 + compliance.iso22000) / 3,
    );

    // Legacy "alert-revisions-count" text was static in the HTML. We
    // derive a real figure from seed data instead: documents still in
    // an editable/reviewable flow (not yet Aprobado/Rechazado) are the
    // ones that could still receive team comments.
    const pendingCommentsCount = docs.filter(
      (d) => d.estado === "Borrador" || d.estado === "En aprobación",
    ).length;

    return {
      activeCount,
      publishedCount,
      inFlowCount: activeCount - publishedCount,
      pendingApprovalsCount,
      borradorCount,
      vencidosCount,
      compliance,
      avgCompliance,
      keyDocs: docs.slice(0, 3),
      pendingCommentsCount,
    };
  }, [documents]);
}
