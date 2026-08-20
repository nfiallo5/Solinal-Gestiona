import { AlertCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Port of legacy "Alertas Generales" card (static content in the HTML). */
export function GeneralAlerts({ pendingCommentsCount }: { pendingCommentsCount: number }) {
  return (
    <Card className="animate-in fade-in duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="size-4 text-status-danger" />
          Alertas generales
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div>
            <strong className="text-sm font-bold text-foreground">
              Revisión pendiente
            </strong>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pendingCommentsCount} documento
              {pendingCommentsCount === 1 ? "" : "s"} esperan comentarios del
              equipo.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-secondary" />
          <div>
            <strong className="text-sm font-bold text-foreground">
              Normativa cambiada
            </strong>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Se detectó actualización internacional de la norma ISO 22000.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
