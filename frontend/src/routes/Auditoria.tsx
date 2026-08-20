import { useMemo, useState } from "react";
import { Download, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppState } from "@/context/AppStateContext";
import { useAuditLogs, useDocuments } from "@/lib/queries";
import { AuditFilters, defaultAuditFilters, type AuditFilterState } from "@/features/audit/AuditFilters";
import { AuditLogTable } from "@/features/audit/AuditLogTable";
import { exportAuditCsv } from "@/features/audit/exportCsv";

/**
 * Port of legacy pg-audit (Audit Trail inmutable).
 *
 * Filtering now happens on the server (`GET /audit-logs?user=&doc=&role=`,
 * where the literal "all" means "no filter" — the same sentinel the selects
 * already hold). The CSV export stays client-side over whatever the current
 * filter returned.
 *
 * There is deliberately NO `POST /audit-logs`: the server writes every entry
 * itself as a side effect of the action being audited. The two dispatches this
 * page used to make (the CSV export and the "Intentar borrar historial" demo)
 * therefore have no endpoint and are gone — see backend/NOTES.md A3.8.
 */
export default function Auditoria() {
  const { state } = useAppState();
  const [filters, setFilters] = useState<AuditFilterState>(defaultAuditFilters);

  const isRestricted = state.session.activeRole === "Lector";

  // Unfiltered pass, only to populate the "Usuario" dropdown with every actor
  // that appears in the trail. With no filters applied both queries share a
  // key and react-query dedupes them into one request.
  const allLogsQuery = useAuditLogs({}, !isRestricted);
  const filteredQuery = useAuditLogs(filters, !isRestricted);
  const documentsQuery = useDocuments({}, !isRestricted);

  const users = useMemo(
    () => [...new Set((allLogsQuery.data ?? []).map((l) => l.user))],
    [allLogsQuery.data],
  );
  const docCodes = useMemo(
    () => (documentsQuery.data ?? []).map((d) => d.code),
    [documentsQuery.data],
  );
  const filteredLogs = useMemo(() => filteredQuery.data ?? [], [filteredQuery.data]);

  function handleExport() {
    exportAuditCsv(filteredLogs);
    toast.success("CSV de auditoría descargado exitosamente.");
  }

  function handleUnauthorizedEdit() {
    toast.error("Registro inmutable: las regulaciones ISO prohíben la modificación del Audit Trail.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Audit Trail (Historial de Auditoría Inmutable)
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Registro trazable de acciones del sistema bajo normas ISO: creación, edición,
            aprobación e intentos no autorizados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleUnauthorizedEdit}>
            <Trash2 className="size-3.5" />
            Intentar borrar historial
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="size-3.5" />
            Exportar CSV completo
          </Button>
        </div>
      </div>

      {isRestricted ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Acceso restringido</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              El rol Lector solo puede consultar documentos aprobados. El historial de
              auditoría está reservado a roles con permisos de gestión.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="py-4">
              <AuditFilters
                users={users}
                docCodes={docCodes}
                value={filters}
                onChange={setFilters}
                onClear={() => setFilters(defaultAuditFilters)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <AuditLogTable logs={filteredLogs} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
