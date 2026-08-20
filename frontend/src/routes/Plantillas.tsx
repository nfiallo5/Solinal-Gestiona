import { useState } from "react";
import { FilePlus, LayoutGrid, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/context/AppStateContext";
import type { DocumentTemplate } from "@/data/seed";
import { useTemplates } from "@/lib/queries";
import { TemplateCard } from "@/features/templates/TemplateCard";
import { TemplateDetailDialog } from "@/features/templates/TemplateDetailDialog";
import { NewTemplateDialog } from "@/features/templates/NewTemplateDialog";
import { AIGeneratorPanel } from "@/features/templates/AIGeneratorPanel";
import { CreateDocumentDialog } from "@/features/documents/CreateDocumentDialog";
import type { AITemplateProposal } from "@/features/templates/aiSimulator";

export default function Plantillas() {
  const { state } = useAppState();
  const templatesQuery = useTemplates();
  const templates = templatesQuery.data ?? [];
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<AITemplateProposal | null>(null);
  const [createDocOpen, setCreateDocOpen] = useState(false);
  const [createDocTemplateKey, setCreateDocTemplateKey] = useState<string | undefined>();

  function handleCreateDocument(templateKey: string) {
    setSelectedTemplate(null);
    setCreateDocTemplateKey(templateKey);
    setCreateDocOpen(true);
  }

  // Lector no tiene acceso a Plantillas en el legacy (js/navigation.js
  // lectorRestricted = ['edit', 'templates', 'audit', 'config']). El
  // Sidebar ya oculta el link, pero esto cubre navegación directa /
  // cambio de rol estando ya en la página, igual que en
  // Auditoria.tsx/Configuracion.tsx/Editor.tsx.
  const isRestricted = state.session.activeRole === "Lector";

  function openNewTemplateDialog() {
    setAiPrefill(null);
    setDialogOpen(true);
  }

  function handleAcceptAIProposal(proposal: AITemplateProposal) {
    setAiPrefill(proposal);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plantillas Estructuradas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creación y administración de estructuras documentales. Los cambios aplican a
            documentos futuros.
          </p>
        </div>
        {!isRestricted && (
          <Button onClick={openNewTemplateDialog}>
            <FilePlus className="h-4 w-4" />
            Nueva plantilla
          </Button>
        )}
      </div>

      {isRestricted ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Acceso restringido</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              El rol Lector no tiene permisos para crear ni administrar plantillas
              documentales. Esta vista está reservada a roles con permisos de gestión.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutGrid className="h-4 w-4 text-secondary" />
                  Plantillas disponibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {templates.map((template) => (
                    <TemplateCard
                      key={template.key}
                      template={template}
                      onSelect={setSelectedTemplate}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <AIGeneratorPanel onAccept={handleAcceptAIProposal} />
          </div>

          <TemplateDetailDialog
            template={selectedTemplate}
            onOpenChange={(open) => !open && setSelectedTemplate(null)}
            onCreateDocument={handleCreateDocument}
          />
          <NewTemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} prefill={aiPrefill} />
          <CreateDocumentDialog
            open={createDocOpen}
            onOpenChange={setCreateDocOpen}
            initialMode="template"
            initialTemplateKey={createDocTemplateKey}
          />
        </>
      )}
    </div>
  );
}
