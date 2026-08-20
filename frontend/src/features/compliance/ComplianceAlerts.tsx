import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useComplianceAlerts } from "./useCompliance";

export function ComplianceAlerts() {
  const alerts = useComplianceAlerts();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-status-warning" />
          Alertas de cumplimiento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-status-valid/30 bg-status-valid/10 p-3 text-sm text-status-valid">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Sin alertas activas. La documentación aprobada cubre los requisitos mapeados.
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
              <div>
                <strong className="block text-sm">{alert.title}</strong>
                <div className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
