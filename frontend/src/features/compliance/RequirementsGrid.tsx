import { useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDocumentTypes } from "@/lib/queries";
import { buildDocumentTypeOptions } from "@/features/documents/controlConfigStore";
import { useRequirementMapping } from "./useCompliance";
import { statusLabel, statusSoftBg, statusText } from "./statusStyles";

export function RequirementsGrid() {
  const requirements = useRequirementMapping();

  // Same "Tipos de información documentada" catalog Crear Documento reads —
  // rename a type in Control Documental and this grid's type badges follow.
  const documentTypesQuery = useDocumentTypes();
  const typeLabel = useMemo(() => {
    const options = buildDocumentTypeOptions(documentTypesQuery.data);
    return new Map(options.map((o) => [o.value, o.label]));
  }, [documentTypesQuery.data]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-secondary" />
          Requisitos ISO Mapeados en la Organización
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {requirements.map((req) => (
            <div
              key={req.key}
              className="rounded-lg border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <strong className="text-sm">{req.label}</strong>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusSoftBg[req.status]} ${statusText[req.status]}`}
                >
                  {statusLabel[req.status]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="font-normal">
                  {req.norma}
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {typeLabel.get(req.type) ?? req.type}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{req.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
