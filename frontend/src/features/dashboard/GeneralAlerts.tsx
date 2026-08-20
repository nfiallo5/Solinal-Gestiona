import { AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * "Alertas generales" card. Only shows alerts that are actually derived from
 * real document state (documents still in Borrador/En aprobación that could
 * still receive team comments) -- the legacy version also had a second,
 * permanently-on card announcing a fake "ISO 22000 regulation change" with
 * no real backing, which is gone.
 */
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
        {pendingCommentsCount > 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3.5 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" />
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
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-status-valid/30 bg-status-valid/10 px-3.5 py-3 text-sm text-status-valid">
            <ShieldCheck className="size-4 shrink-0" />
            Sin alertas activas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
