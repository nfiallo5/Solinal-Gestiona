import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RegulationBannerProps {
  visible: boolean;
  onApply: () => void;
}

/** Port of legacy js/ai.js simulateRegulationChange / applyNormativeUpdateInEditor (G01 Scenario 4). */
export function RegulationBanner({ visible, onApply }: RegulationBannerProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-status-warning/40 bg-status-warning/10 p-4 transition-all animate-in fade-in slide-in-from-top-2">
      <RefreshCw className="size-5 shrink-0 text-status-warning" />
      <div className="flex-1">
        <strong className="text-sm">Normativa actualizada internacionalmente</strong>
        <p className="text-xs text-muted-foreground">
          La regulación ISO 22000 ha cambiado. El sistema ha adaptado automáticamente la
          plantilla para esta sesión.
        </p>
      </div>
      <Button size="sm" onClick={onApply}>
        Aplicar cambios al borrador
      </Button>
    </div>
  );
}
