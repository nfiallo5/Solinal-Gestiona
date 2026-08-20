import { GitFork } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** The rejected local draft, from the 409's `details.clientContent`. */
  clientContent?: string | null;
  /** What the server has stored now, from `details.serverContent`. */
  serverContent?: string;
  /** `details.serverUpdatedAt` — the closest fact to "who edited this". */
  serverUpdatedAt?: string;
  pending?: boolean;
}

/** Strips tags so a rich-HTML body reads as plain text inside the diff panes. */
function asPlainText(html: string | null | undefined): string {
  if (!html) return "(sin contenido)";
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").trim() || "(sin contenido)";
}

function formatMoment(iso: string | undefined): string {
  if (!iso) return "hace unos momentos";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "hace unos momentos";
  return `el ${date.toLocaleDateString()} a las ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Real optimistic-concurrency conflict resolution. This used to be a scripted
 * demo with two hardcoded diffs; it now opens when `PATCH /documents/:code`
 * answers 409 `CONTENT_VERSION_CONFLICT`, and both panes come from that
 * response.
 *
 * NOTE: the copy no longer names the other editor ("Ana Torres guardó
 * cambios…") — there is no `lastEditedBy` column on `Document`, so the only
 * fact the payload can supply is `serverUpdatedAt`.
 */
export function MergeDialog({
  open,
  onOpenChange,
  onConfirm,
  clientContent,
  serverContent,
  serverUpdatedAt,
  pending = false,
}: MergeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Fusión de cambios concurrentes detectados</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-2xl border border-status-warning/40 bg-status-warning/10 p-3.5">
          <GitFork className="mt-0.5 size-4 shrink-0 text-status-warning" />
          <div>
            <strong className="text-sm">Edición simultánea</strong>
            <div className="text-xs text-muted-foreground">
              Otra sesión guardó cambios en este documento {formatMoment(serverUpdatedAt)}. Por
              favor revisa las diferencias antes de continuar.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-status-danger/5 p-3">
            <strong className="text-xs text-status-danger">Tu borrador local:</strong>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-foreground">
              {asPlainText(clientContent)}
            </pre>
          </div>
          <div className="rounded-2xl border border-border bg-status-valid/5 p-3">
            <strong className="text-xs text-status-valid">Versión guardada en el servidor:</strong>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-foreground">
              {asPlainText(serverContent)}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            Fusionar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
