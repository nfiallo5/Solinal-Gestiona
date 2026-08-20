import { Lock, LockOpen } from "lucide-react";

import type { RoleName, SolinalDocument } from "@/data/seed";

/** Port of legacy js/editor.js locked-section-container (G03 Scenario 2).
 * Hardcoded to PRO-CAL-009 / Ana Torres exactly like the legacy prototype —
 * a single scripted demo scenario, not a general per-document field (the
 * seed data model has no "locked section text" field). */
const LOCKED_DOC_CODE = "PRO-CAL-009";
const LOCKED_OWNER = "Ana Torres";
const LOCKED_SECTION_TEXT =
  "Límites críticos: Temperatura de fritura 175°C ± 5°C. Humedad final máxima 2.0%.";

export function LockedSection({
  doc,
  activeUser,
  activeRole,
}: {
  doc: SolinalDocument;
  activeUser: string;
  activeRole: RoleName;
}) {
  if (doc.code !== LOCKED_DOC_CODE) return null;

  const isOwner = activeUser === doc.creador || activeRole === "Administrador";

  return (
    <div
      className={`relative my-3.5 rounded-2xl border-2 border-dashed p-3.5 transition-colors ${
        isOwner ? "border-status-valid bg-status-valid/5" : "border-status-danger bg-status-danger/5"
      }`}
    >
      <span
        className={`absolute -top-2.5 right-3.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white ${
          isOwner ? "bg-status-valid" : "bg-status-danger"
        }`}
      >
        {isOwner ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
        {isOwner ? "Editable por ti" : `Bloqueado (Solo Propietario: ${LOCKED_OWNER})`}
      </span>
      <strong className="mb-1.5 block text-xs text-foreground">
        Sección de Control Crítico y Límites
      </strong>
      <textarea
        readOnly={!isOwner}
        defaultValue={LOCKED_SECTION_TEXT}
        rows={2}
        className="w-full rounded-lg border border-border bg-muted/60 p-2 text-sm"
      />
    </div>
  );
}
