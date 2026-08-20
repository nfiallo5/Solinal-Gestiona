import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { SolinalDocument } from "@/data/seed";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { multiDocSummaryText } from "./aiEngine";

interface SummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: SolinalDocument[];
  onSummaryGenerated: (count: number) => void;
}

/** Port of legacy js/editor.js + ai.js triggerMultiDocSummary / runAISummary (G04 Scenario 3). */
export function SummaryDialog({ open, onOpenChange, documents, onSummaryGenerated }: SummaryDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setOutput(null);
      setLoading(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [open]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function runSummary() {
    if (selected.size === 0) {
      toast.error("Selecciona al menos un documento.");
      return;
    }
    setLoading(true);
    setOutput(null);
    timerRef.current = setTimeout(() => {
      setLoading(false);
      setOutput(multiDocSummaryText(Array.from(selected)));
      onSummaryGenerated(selected.size);
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Resumen multidocumento IA</DialogTitle>
        </DialogHeader>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Selecciona los documentos para resumir con IA</label>
          <div className="grid max-h-[160px] gap-2 overflow-y-auto rounded-xl border border-border p-2.5">
            {documents.map((d) => (
              <label key={d.code} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={selected.has(d.code)} onCheckedChange={() => toggle(d.code)} />
                <strong>{d.code}</strong> - {d.title}
              </label>
            ))}
          </div>
        </div>

        <div className="min-h-[120px] rounded-2xl border border-border bg-muted/50 p-4 text-sm transition-colors">
          {loading ? (
            <em className="text-muted-foreground">
              Consolidando contenidos e identificando hallazgos regulatorios...
            </em>
          ) : output ? (
            <p className="whitespace-pre-line leading-relaxed animate-in fade-in">{output}</p>
          ) : (
            <em className="text-muted-foreground">
              Presiona el botón de abajo para que la IA realice la consolidación documental.
            </em>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={runSummary} disabled={loading}>
            <Sparkles className="size-4" /> Generar resumen consolidado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
