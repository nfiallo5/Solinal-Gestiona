import { useEffect, useState } from "react";
import { History } from "lucide-react";

import type { SolinalDocument } from "@/data/seed";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: SolinalDocument;
  onRestore: (index: number) => void;
}

/** Port of legacy js/editor.js openVersionModal / selectVersionToRestore / restoreSelectedVersion (G02 Scenario 3). */
export function VersionHistoryDialog({ open, onOpenChange, doc, onRestore }: VersionHistoryDialogProps) {
  const [selectedIdx, setSelectedIdx] = useState(-1);

  useEffect(() => {
    if (open) setSelectedIdx(-1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historial de versiones</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[320px] gap-2 overflow-y-auto">
          {doc.revisiones.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No hay registros históricos de versiones para restaurar.
            </span>
          ) : (
            doc.revisiones.map((r, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  selectedIdx === idx
                    ? "border-primary bg-accent"
                    : "border-border hover:bg-muted/60"
                }`}
              >
                <strong className="flex items-center gap-1.5 text-xs text-foreground">
                  <History className="size-3.5" /> Versión histórica
                </strong>
                <div className="mt-1 text-xs text-muted-foreground">{r}</div>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={selectedIdx === -1}
            onClick={() => {
              onRestore(selectedIdx);
              onOpenChange(false);
            }}
          >
            Restaurar versión seleccionada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
