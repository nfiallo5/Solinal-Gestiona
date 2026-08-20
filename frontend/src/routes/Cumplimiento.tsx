import { useComplianceScores } from "@/features/compliance/useCompliance";
import { IsoScoreCard } from "@/features/compliance/IsoScoreCard";
import { ComplianceAlerts } from "@/features/compliance/ComplianceAlerts";
import { RequirementsGrid } from "@/features/compliance/RequirementsGrid";

export default function Cumplimiento() {
  const scores = useComplianceScores();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cumplimiento normativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Muestra cobertura de normas ISO y requisitos asociados a documentos aprobados.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {scores.map((score) => (
          <IsoScoreCard key={score.norma} {...score} />
        ))}
      </div>

      <ComplianceAlerts />
      <RequirementsGrid />
    </div>
  );
}
