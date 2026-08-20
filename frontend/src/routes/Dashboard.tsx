import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus, Files, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppState } from "@/context/AppStateContext";
import { StatCard } from "@/features/dashboard/StatCard";
import { ComplianceQuickView } from "@/features/dashboard/ComplianceQuickView";
import { RoleTasksTimeline } from "@/features/dashboard/RoleTasksTimeline";
import { KeyDocumentsList } from "@/features/dashboard/KeyDocumentsList";
import { GeneralAlerts } from "@/features/dashboard/GeneralAlerts";
import { VencidosAlertBanner } from "@/features/dashboard/VencidosAlertBanner";
import { useDashboardMetrics } from "@/features/dashboard/useDashboardMetrics";
import { useDocuments } from "@/lib/queries";

export default function Dashboard() {
  const { state } = useAppState();
  const navigate = useNavigate();
  const documentsQuery = useDocuments();
  const metrics = useDashboardMetrics(documentsQuery.data ?? []);
  const [tasksCleared, setTasksCleared] = useState(false);

  return (
    <div className="flex flex-col gap-5 pb-10 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bienvenido a Solinal Gestiona
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Muestra del MVP SaaS para gestión documental ISO. Dashboard
            diseñado para auditores, coordinadores y aprobadores.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Visión general
              </p>
              <CardTitle className="mt-1 text-xl leading-tight">
                Flujo documental y prioridades del equipo
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate("/documentos")}>
                <Files className="size-3.5" /> Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                label="Documentos activos"
                value={metrics.activeCount}
                valueClassName="text-secondary"
                meta={`${metrics.publishedCount} publicados, ${metrics.inFlowCount} en flujo/borradores`}
                onClick={() => navigate("/documentos")}
              />
              <StatCard
                label="Aprobaciones pendientes"
                value={metrics.pendingApprovalsCount}
                valueClassName="text-status-warning"
                meta={`${metrics.borradorCount} en borrador, ${metrics.pendingApprovalsCount} en aprobación final`}
                onClick={() =>
                  navigate(`/documentos?estado=${encodeURIComponent("En aprobación")}`)
                }
              />
              <StatCard
                label="Cumplimiento ISO"
                value={`${metrics.avgCompliance}%`}
                valueClassName="text-status-valid"
                meta="Promedio de cumplimiento normativo"
                onClick={() => navigate("/cumplimiento")}
              />
              <StatCard
                label="Riesgos abiertos"
                value={metrics.vencidosCount}
                valueClassName="text-status-danger"
                meta="Documentos vencidos pendientes de actualización"
                onClick={() => navigate("/documentos?estado=vencido")}
              />
            </div>
          </CardContent>
        </Card>

        <ComplianceQuickView
          compliance={metrics.compliance}
          avgCompliance={metrics.avgCompliance}
        />
      </div>

      <VencidosAlertBanner count={metrics.vencidosCount} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <RoleTasksTimeline
          role={state.session.activeRole}
          cleared={tasksCleared}
          onToggleCleared={() => setTasksCleared((c) => !c)}
        />
        <KeyDocumentsList docs={metrics.keyDocs} />
        <GeneralAlerts pendingCommentsCount={metrics.pendingCommentsCount} />
      </div>
    </div>
  );
}
