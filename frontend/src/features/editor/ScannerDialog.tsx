import { useEffect } from "react";
import { Camera } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ScanImportInput } from "@/lib/api";

interface ScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the structured payload posted to `POST /documents/:code/scan-import`. */
  onComplete: (payload: ScanImportInput) => void;
  /** Who is running the scan — becomes the "Inspector" line of the imported block. */
  inspector: string;
}

/** Default values of the digitised form, matching the block the legacy
 * `triggerScanner` used to inject verbatim. There is no real OCR: the endpoint
 * takes this structured payload and renders the same HTML server-side. */
const SCAN_DEFAULTS = {
  codigoRegistro: "REG-FIS-099",
  resultado: "Limpieza CIP completada de forma óptima sin alérgenos.",
};

/** Port of legacy js/editor.js triggerScanner (G04 Scenario 4) — auto-closes after a
 * simulated 2.2s scan and imports the digitised data into the document. */
export function ScannerDialog({ open, onOpenChange, onComplete, inspector }: ScannerDialogProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      onOpenChange(false);
      onComplete({
        inspector,
        resultado: SCAN_DEFAULTS.resultado,
        codigoRegistro: SCAN_DEFAULTS.codigoRegistro,
        fechaInspeccion: new Date().toISOString().slice(0, 10),
      });
    }, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear formato físico</DialogTitle>
        </DialogHeader>

        <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-2xl bg-navy">
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-primary/80 shadow-[0_0_12px_2px] shadow-primary/60" />
          <Camera className="size-12 text-white/40" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Digitalizando documento físico de control de inocuidad e importando a bloques
          editables...
        </p>
      </DialogContent>
    </Dialog>
  );
}
