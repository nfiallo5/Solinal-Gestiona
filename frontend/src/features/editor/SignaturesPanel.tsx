import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SignaturesPanelProps {
  signatures: string[];
  onSign: () => void;
}

/** Port of legacy js/editor.js rebuildSignaturesList / signActiveDocument (G03 Scenario 1). */
export function SignaturesPanel({ signatures, onSign }: SignaturesPanelProps) {
  return (
    <div className="mt-4.5 grid gap-3 border-t border-border pt-4.5">
      <strong className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <PenLine className="size-3.5" /> Firmas electrónicas digitales
        </span>
        <Button size="sm" onClick={onSign}>
          <PenLine className="size-3.5" /> Colocar mi firma
        </Button>
      </strong>

      <div className="grid gap-2">
        {signatures.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            Documento pendiente de firma y validación.
          </span>
        ) : (
          signatures.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border-l-4 border-l-status-valid border-y border-r border-border bg-muted/50 p-3 text-xs transition-colors animate-in fade-in"
            >
              <div>
                <strong className="block text-[13px] text-foreground">
                  Firmado digitalmente por {s}
                </strong>
                <small className="text-muted-foreground">
                  Fecha: {new Date().toISOString().slice(0, 10)} - Autorización completa
                </small>
              </div>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ISO-CERT-SHA256
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
