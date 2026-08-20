import { useNavigate } from "react-router-dom";
import { ChartNoAxesCombined } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ComplianceScores } from "./useDashboardMetrics";

// Plain metric numbers, not a status -- one consistent color for all three
// instead of a per-row rainbow (color is reserved for actual estado).
const isoBreakdown: Array<{
  key: keyof ComplianceScores;
  label: string;
}> = [
  { key: "iso9001", label: "ISO 9001" },
  { key: "iso14001", label: "ISO 14001" },
  { key: "iso22000", label: "ISO 22000" },
];

/** Port of legacy "Cumplimiento rápido" card (id="dash-iso-progress-inner" + per-norma stat cards). */
export function ComplianceQuickView({
  compliance,
  avgCompliance,
}: {
  compliance: ComplianceScores;
  avgCompliance: number;
}) {
  const navigate = useNavigate();

  return (
    <Card className="animate-in fade-in duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ChartNoAxesCombined className="size-4 text-secondary" />
          Cumplimiento rápido
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3">
          <strong className="text-2xl font-extrabold text-foreground">
            {avgCompliance}%
          </strong>
          <span className="text-xs text-muted-foreground">
            Avance promedio en cumplimiento ISO
          </span>
        </div>
        <Progress value={avgCompliance} className="mt-4 h-2.5" />

        <div className="mt-5 grid grid-cols-3 gap-3">
          {isoBreakdown.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate("/cumplimiento")}
              className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <span className="text-xl font-extrabold text-foreground">
                {compliance[key]}%
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
