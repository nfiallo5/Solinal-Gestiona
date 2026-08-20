import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppState } from "@/context/AppStateContext";
import type { OrgConfig } from "@/data/seed";
import { configApi } from "@/lib/api";
import { queryKeys, useConfig } from "@/lib/queries";
import { IdentitySection } from "@/features/config/IdentitySection";
import { SecuritySection } from "@/features/config/SecuritySection";

/**
 * Port of legacy pg-config. Form fields are edited as a local draft (like
 * the legacy form, which only read the DOM inputs on
 * saveConfigurationSettings()) and committed with `PATCH /config` — which is
 * admin-only and audited server-side — on "Guardar cambios".
 */
export default function Configuracion() {
  const { state } = useAppState();
  const queryClient = useQueryClient();
  const isRestricted = state.session.activeRole === "Lector";

  const configQuery = useConfig();
  const [draft, setDraft] = useState<OrgConfig | null>(null);

  // Keep the draft in sync with whatever the server currently holds.
  useEffect(() => {
    if (configQuery.data) setDraft(configQuery.data);
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (changes: Partial<OrgConfig>) => configApi.patch(changes),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.config, updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogsAll });
      toast.success("Configuraciones guardadas y aplicadas al sistema.");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la configuración.",
      );
    },
  });

  function handleChange(changes: Partial<OrgConfig>) {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev));
  }

  function handleSave() {
    if (!draft) return;
    saveMutation.mutate(draft);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuración del sistema</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajustes globales del tenant, personalización visual y políticas de seguridad.
          </p>
        </div>
        {!isRestricted && (
          <Button className="gap-2" onClick={handleSave} disabled={!draft || saveMutation.isPending}>
            <Save className="size-4" />
            Guardar cambios
          </Button>
        )}
      </div>

      {isRestricted ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Acceso restringido</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              El rol Lector no tiene permisos para modificar la configuración del sistema.
            </p>
          </CardContent>
        </Card>
      ) : (
        draft && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <IdentitySection draft={draft} onChange={handleChange} />
            <SecuritySection draft={draft} onChange={handleChange} />
          </div>
        )
      )}
    </div>
  );
}
