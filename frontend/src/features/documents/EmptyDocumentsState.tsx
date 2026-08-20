import { FilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyDocumentsStateProps {
  title?: string;
  description?: string;
  /** Omit to hide the create button entirely (e.g. for the Lector role). */
  onCreate?: () => void;
  createLabel?: string;
  className?: string;
}

/**
 * Shared "no documents yet" welcome state — used by Dashboard, Documentos
 * and Editor whenever the account has zero documents, instead of each page
 * showing its own empty widgets/tables with nothing in them.
 */
export function EmptyDocumentsState({
  title = "Aún no tienes documentos",
  description = "Crea tu primer documento del catálogo. Solinal genera el código, la estructura y el flujo de aprobación correctos automáticamente.",
  onCreate,
  createLabel = "Crear documento",
  className,
}: EmptyDocumentsStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl bg-accent px-6 py-20 text-center",
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {onCreate && (
        <Button className="mt-3" onClick={onCreate}>
          <FilePlus className="size-4" />
          {createLabel}
        </Button>
      )}
    </div>
  );
}
