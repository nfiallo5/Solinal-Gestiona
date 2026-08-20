import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

/** Port of legacy #vencidos-alert-banner (G05 Scenario 2). */
export function VencidosAlertBanner({ count }: { count: number }) {
  const navigate = useNavigate();
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/documentos?estado=vencido")}
      className="mt-4 flex w-full items-start gap-3 rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3.5 text-left transition-colors hover:bg-status-danger/15 animate-in fade-in duration-500"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-danger" />
      <div>
        <strong className="text-sm font-bold text-status-danger">
          Alerta de riesgos de cumplimiento: Documentos vencidos
        </strong>
        <p className="mt-0.5 text-xs text-status-danger/90">
          Existen {count} documento{count === 1 ? "" : "s"} vigente
          {count === 1 ? "" : "s"} vencido{count === 1 ? "" : "s"}. Requieren
          actualización de firmas e ISO de forma prioritaria.
        </p>
      </div>
    </button>
  );
}
