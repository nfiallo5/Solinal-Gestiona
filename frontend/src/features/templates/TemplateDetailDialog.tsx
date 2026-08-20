import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DocumentTemplate } from "@/data/seed";
import { useTemplates } from "@/lib/queries";

interface TemplateDetailDialogProps {
  template: DocumentTemplate | null;
  onOpenChange: (open: boolean) => void;
  /** Legacy clicking a .template-card opened the "Nuevo documento" modal
   * directly (js/templates.js → templateChanged/openModal('newDocModal')).
   * This closes the detail view and opens CreateDocumentDialog pre-loaded
   * with this template, completing that same flow. */
  onCreateDocument: (templateKey: string) => void;
}

/** Detail preview for a template card, with a "Crear documento" action that
 * hands off to CreateDocumentDialog (owned by Documentos.tsx / Plantillas.tsx). */
export function TemplateDetailDialog({ template, onOpenChange, onCreateDocument }: TemplateDetailDialogProps) {
  const templates = useTemplates().data ?? [];
  const padre = template?.documentoPadreKey
    ? templates.find((t) => t.key === template.documentoPadreKey)
    : undefined;

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {template && (
          <>
            <DialogHeader>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>{template.desc}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">
                {template.norma}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {template.type}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {template.nivel}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="mb-1 font-semibold text-muted-foreground">Cláusula ISO</div>
                <div className="font-medium">{template.clausulaIso || "No especificada"}</div>
              </div>
              <div>
                <div className="mb-1 font-semibold text-muted-foreground">Revisión</div>
                <div className="font-medium">{template.periodicidadRevision}</div>
              </div>
            </div>

            {padre && (
              <div>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Depende de
                </div>
                <Badge variant="outline" className="font-normal">
                  {padre.name}
                </Badge>
              </div>
            )}

            {template.secciones.length > 0 ? (
              <div>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Estructura de secciones
                </div>
                <div className="space-y-2">
                  {template.secciones.map((s) => (
                    <div key={s.titulo} className="rounded-md border border-border p-2">
                      <div className="flex items-center gap-1.5">
                        <Badge className="font-normal">{s.titulo}</Badge>
                        {s.obligatoria && (
                          <span className="text-[10px] uppercase text-muted-foreground">Obligatoria</span>
                        )}
                      </div>
                      {s.proposito && (
                        <p className="mt-1 text-xs text-muted-foreground">{s.proposito}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Secciones obligatorias
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {template.mandatory.map((section) => (
                    <Badge key={section} className="font-normal">
                      {section}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Estructura del contenido
              </div>
              <div
                className="rounded-md bg-muted p-3 text-xs leading-relaxed [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:py-0.5"
                dangerouslySetInnerHTML={{ __html: template.content }}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button onClick={() => onCreateDocument(template.key)}>
                Crear documento
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
