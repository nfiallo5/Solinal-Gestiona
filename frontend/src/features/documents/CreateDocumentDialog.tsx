import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { DocumentType } from "@/data/seed";
import { documentsApi, type CreateDocumentInput } from "@/lib/api";
import { invalidateAfterDocumentMutation, useDocuments, useTemplates } from "@/lib/queries";
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
import { documentAreas, documentTypeOptions, nextDocumentCode, normaOptions } from "./docStyles";

/** Port of legacy js/templates.js openCreateDoc / templateChanged / createDocument. */

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "blank" | "template" — mirrors legacy openCreateDoc(mode) initial focus. */
  initialMode: "blank" | "template";
  /** Pre-selects a specific template on open — e.g. when arriving from the
   * "Crear documento" button on a template's detail view in Plantillas.tsx,
   * instead of leaving the user to pick again from the dropdown. */
  initialTemplateKey?: string;
}

const emptyForm = {
  templateKey: "",
  title: "",
  type: "Procedimiento" as DocumentType,
  area: documentAreas[0].code,
  norma: "ISO 9001:2015" as (typeof normaOptions)[number],
  description: "",
  critical: false,
};

export function CreateDocumentDialog({
  open,
  onOpenChange,
  initialMode,
  initialTemplateKey,
}: CreateDocumentDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const templates = useTemplates().data ?? [];
  const documents = useDocuments().data ?? [];

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
        norma: preset.norma as (typeof normaOptions)[number],
        description: preset.desc,
      });
    } else {
      setForm({ ...emptyForm, templateKey: initialMode === "template" ? "__pick__" : "" });
    }
    // `templates.length` is in the deps so a dialog opened before the template
    // list finished loading still picks up its preset once it arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode, initialTemplateKey, templates.length]);

  const selectedTemplate =
    form.templateKey && form.templateKey !== "__pick__"
      ? templates.find((t) => t.key === form.templateKey)
      : undefined;

  function handleTemplateChange(key: string) {
    if (!key || key === "__blank__") {
      setForm((f) => ({ ...f, templateKey: "" }));
      return;
    }
    const template = templates.find((t) => t.key === key);
    if (!template) return;
    setForm((f) => ({
      ...f,
      templateKey: key,
      title: `Borrador — ${template.name}`,
      type: template.type,
      norma: template.norma as (typeof normaOptions)[number],
      description: template.desc,
    }));
  }

  // Preview only — the real control code is generated server-side by
  // `POST /documents` (same TIPO-AREA-NNN rule, ported to backend/src/lib).
  const previewCode = nextDocumentCode(form.type, form.area, documents);

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
            Empieza desde cero o parte de una plantilla estructurada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid gap-1.5">
              <Label>Plantilla base</Label>
              <Select
                value={form.templateKey === "__pick__" ? "" : form.templateKey || "__blank__"}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Crear en blanco (sin plantilla) --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__blank__">
                    -- Crear en blanco (sin plantilla) --
                  </SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Tipo documental</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as DocumentType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
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
                  {documentAreas.map((a) => (
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
