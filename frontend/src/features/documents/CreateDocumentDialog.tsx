import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { documentsApi, type CreateDocumentInput } from "@/lib/api";
import {
  invalidateAfterDocumentMutation,
  useCodingRule,
  useDocuments,
  useDocumentTypes,
  useProcessAreas,
  useTemplates,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_CODING_RULE,
  documentAreas,
  nextDocumentCode,
  normaOptions,
  typeSigla,
} from "./docStyles";
import { buildDocumentTypeOptions } from "./controlConfigStore";

/** Port of legacy js/templates.js openCreateDoc / templateChanged / createDocument. */

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects a specific template on open — e.g. when arriving from the
   * "Crear documento" button on a template's detail view in Plantillas.tsx,
   * instead of leaving the user to pick again from the dropdown. */
  initialTemplateKey?: string;
}

const emptyForm = {
  templateKey: "",
  title: "",
  type: "Procedimiento" as string,
  area: "CAL",
  norma: "ISO 9001:2015" as (typeof normaOptions)[number],
  description: "",
  critical: false,
};

export function CreateDocumentDialog({
  open,
  onOpenChange,
  initialTemplateKey,
}: CreateDocumentDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const templates = useTemplates().data ?? [];
  const documents = useDocuments().data ?? [];

  // "Tipo documental" — every row of Control Documental's "Tipos de
  // información documentada" table (the real DocumentTypeCatalog backend
  // table), falling back to the 5 template types while the query loads.
  // `Document.type` is free text, so all catalog types are pickable and the
  // server validates the choice against this same table.
  const documentTypesQuery = useDocumentTypes();
  const typeOptions = buildDocumentTypeOptions(documentTypesQuery.data);

  // "Área / Departamento" comes from Control Documental's "Procesos y áreas"
  // table (the real ProcessArea backend table now, not localStorage),
  // falling back to the built-in 9 while the query is still loading. This is
  // the exact same list POST /documents validates `area` against.
  const processAreasQuery = useProcessAreas();
  const areaOptions = processAreasQuery.data
    ? processAreasQuery.data.map((a) => ({ code: a.sigla, label: a.nombre }))
    : documentAreas;

  // Control Documental's saved "Regla de codificación" — the same rule
  // POST /documents applies server-side, so this preview and the code the
  // document actually gets created with always match.
  const codingRuleQuery = useCodingRule();
  const codingRule = codingRuleQuery.data ?? DEFAULT_CODING_RULE;

  useEffect(() => {
    if (!open) return;
    const preset = initialTemplateKey
      ? templates.find((t) => t.key === initialTemplateKey)
      : undefined;
    if (preset) {
      setForm({
        ...emptyForm,
        templateKey: preset.key,
        title: `Borrador — ${preset.name}`,
        type: preset.type,
        area: areaOptions[0]?.code ?? emptyForm.area,
        norma: preset.norma as (typeof normaOptions)[number],
        description: preset.desc,
      });
    } else {
      setForm({
        ...emptyForm,
        templateKey: "",
        type: typeOptions[0]?.value ?? emptyForm.type,
        area: areaOptions[0]?.code ?? emptyForm.area,
      });
    }
    // `templates.length` is in the deps so a dialog opened before the template
    // list finished loading still picks up its preset once it arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTemplateKey, templates.length]);

  const selectedTemplate = initialTemplateKey
    ? templates.find((t) => t.key === initialTemplateKey)
    : undefined;

  // Preview only — the real control code is generated server-side by
  // `POST /documents`, using the exact same saved coding rule and the same
  // type-name -> sigla resolution (see `nextDocumentCode` / `resolveTypeSigla`
  // in backend/src/lib/documentCode.ts).
  const previewCode = nextDocumentCode(
    codingRule,
    typeSigla(form.type, documentTypesQuery.data),
    form.area,
    documents,
  );

  const createMutation = useMutation({
    mutationFn: (input: CreateDocumentInput) => documentsApi.create(input),
    onSuccess: (created) => {
      invalidateAfterDocumentMutation(queryClient, created.code);
      toast.success(`Documento ${created.code} creado exitosamente en Borrador.`);
      onOpenChange(false);
      navigate(`/editor?doc=${encodeURIComponent(created.code)}`);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el documento.");
    },
  });

  function handleCreate() {
    const title = form.title.trim();
    if (!title) {
      toast.error("El título es necesario.");
      return;
    }

    createMutation.mutate({
      templateKey: selectedTemplate?.key ?? null,
      title,
      type: form.type,
      area: form.area,
      norma: form.norma,
      // Accepted and discarded by the API — `SolinalDocument` has no such field.
      description: form.description,
      // Only honoured for blank documents: with a template, `critico` derives
      // from `template.rolesRequeridos.dobleAprobacion` server-side.
      critico: form.critical,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Crear nuevo documento</DialogTitle>
          <DialogDescription>
            Completa los datos para generar el código de control automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Tipo documental</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Área / Departamento</Label>
              <Select
                value={form.area}
                onValueChange={(v) => setForm((f) => ({ ...f, area: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {areaOptions.map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Código de control</Label>
              <Input value={previewCode} readOnly disabled className="font-mono font-bold" />
            </div>

            <div className="grid gap-1.5">
              <Label>Norma de referencia</Label>
              <Select
                value={form.norma}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, norma: v as (typeof normaOptions)[number] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {normaOptions.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 grid gap-1.5">
              <Label>Título del documento</Label>
              <Input
                placeholder="Ej. Procedimiento de Control de Plagas"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Descripción breve</Label>
            <Textarea
              placeholder="Detalle del objetivo del documento..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={form.critical}
              onCheckedChange={(v) => setForm((f) => ({ ...f, critical: v === true }))}
            />
            <span className="text-sm font-semibold">
              Marcar como documento crítico (requiere doble aprobación)
            </span>
          </label>

          {selectedTemplate && (
            <div className="rounded-2xl border border-border bg-muted/50 p-4 transition-all animate-in fade-in slide-in-from-top-1">
              <strong className="text-sm">Vista previa de plantilla</strong>
              <p className="mt-2 text-sm text-muted-foreground">
                Secciones obligatorias: {selectedTemplate.mandatory.join(", ")}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            Crear documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
