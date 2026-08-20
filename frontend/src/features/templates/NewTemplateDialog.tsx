import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DocumentType, TemplateLevel, TemplateSection } from "@/data/seed";
import { templatesApi, type CreateTemplateInput } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import type { AITemplateProposal } from "./aiSimulator";

const NORMAS = ["ISO 9001:2015", "ISO 14001:2015", "ISO 22000:2018"];
const TYPES: DocumentType[] = ["Procedimiento", "Política", "Instructivo", "Manual", "Checklist"];
const NIVELES: TemplateLevel[] = ["Política", "Manual", "Procedimiento", "Instructivo", "Registro"];
const PERIODICIDADES = ["Anual", "Bienal", "Semestral", "No aplica"] as const;

interface NewTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the form when accepting an AI-generated proposal. */
  prefill?: AITemplateProposal | null;
}

const emptyForm = {
  name: "",
  norma: NORMAS[0],
  type: TYPES[0],
  nivel: "Procedimiento" as TemplateLevel,
  clausulaIso: "",
  periodicidadRevision: "Anual" as (typeof PERIODICIDADES)[number],
  secciones: [] as TemplateSection[],
  desc: "",
};

/** Editor dinámico de secciones — reemplaza el input de texto separado por
 * comas por una lista donde cada sección tiene título + propósito propios,
 * en vez de solo un nombre (ver DocumentTemplate.secciones en seed.ts). */
function SeccionesEditor({
  secciones,
  onChange,
}: {
  secciones: TemplateSection[];
  onChange: (s: TemplateSection[]) => void;
}) {
  function addSeccion() {
    onChange([...secciones, { titulo: "", proposito: "", obligatoria: true }]);
  }
  function updateSeccion(i: number, changes: Partial<TemplateSection>) {
    onChange(secciones.map((s, idx) => (idx === i ? { ...s, ...changes } : s)));
  }
  function removeSeccion(i: number) {
    onChange(secciones.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {secciones.map((s, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-2">
          <div className="grid flex-1 gap-1.5">
            <Input
              placeholder="Título de sección"
              value={s.titulo}
              onChange={(e) => updateSeccion(i, { titulo: e.target.value })}
            />
            <Input
              placeholder="Propósito de la sección"
              value={s.proposito}
              onChange={(e) => updateSeccion(i, { proposito: e.target.value })}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox
                checked={s.obligatoria}
                onCheckedChange={(v) => updateSeccion(i, { obligatoria: v === true })}
              />
              Obligatoria
            </label>
          </div>
          <Button variant="outline" size="icon" onClick={() => removeSeccion(i)} title="Quitar sección">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addSeccion}>
        + Agregar sección
      </Button>
    </div>
  );
}

/** Ported from js/templates.js saveNewTemplate() (G06 Scenario 4: mandatory
 * section required to comply with ISO guidelines). */
export function NewTemplateDialog({ open, onOpenChange, prefill }: NewTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: (input: CreateTemplateInput) => templatesApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogsAll });
      toast.success("Plantilla guardada y disponible en el catálogo.");
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la plantilla.");
    },
  });

  useEffect(() => {
    if (open) {
      setForm(
        prefill
          ? {
              name: prefill.name,
              norma: prefill.norma,
              type: prefill.type,
              nivel: prefill.nivel,
              clausulaIso: prefill.clausulaIso,
              periodicidadRevision: prefill.periodicidadRevision,
              secciones: prefill.mandatory.map((titulo) => ({
                titulo,
                proposito: "",
                obligatoria: true,
              })),
              desc: prefill.desc,
            }
          : emptyForm,
      );
    }
  }, [open, prefill]);

  function handleSave() {
    const name = form.name.trim();
    const secciones = form.secciones
      .map((s) => ({ ...s, titulo: s.titulo.trim(), proposito: s.proposito.trim() }))
      .filter((s) => s.titulo);

    if (!name) {
      toast.error("El nombre de la plantilla es obligatorio.");
      return;
    }
    if (secciones.length === 0) {
      toast.error(
        "Debe especificar al menos una sección obligatoria para cumplir con las directrices ISO.",
      );
      return;
    }

    // `key`, `desc`, `preview`, `content`, `mandatory`, `tiempoRetencionAnios`
    // and `rolesRequeridos` are all derived server-side from exactly these
    // fields (POST /templates recomputes the same expressions), so only the
    // form's own values travel.
    createMutation.mutate({
      name,
      norma: form.norma,
      type: form.type,
      nivel: form.nivel,
      clausulaIso: form.clausulaIso.trim(),
      periodicidadRevision: form.periodicidadRevision,
      secciones,
      ...(form.desc.trim() ? { desc: form.desc.trim() } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear nueva plantilla</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-temp-name">Nombre de la plantilla</Label>
            <Input
              id="new-temp-name"
              placeholder="Ej. Procedimiento Control de Plagas"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Norma base</Label>
              <Select
                value={form.norma}
                onValueChange={(v) => setForm((f) => ({ ...f, norma: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NORMAS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo documental</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as DocumentType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Nivel documental</Label>
              <Select
                value={form.nivel}
                onValueChange={(v) => setForm((f) => ({ ...f, nivel: v as TemplateLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVELES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-temp-clausula">Cláusula ISO</Label>
              <Input
                id="new-temp-clausula"
                placeholder="Ej. 7.5.3"
                value={form.clausulaIso}
                onChange={(e) => setForm((f) => ({ ...f, clausulaIso: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Periodicidad</Label>
              <Select
                value={form.periodicidadRevision}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, periodicidadRevision: v as (typeof PERIODICIDADES)[number] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODICIDADES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Estructura de secciones</Label>
            <SeccionesEditor
              secciones={form.secciones}
              onChange={(secciones) => setForm((f) => ({ ...f, secciones }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-temp-desc">Descripción</Label>
            <Textarea
              id="new-temp-desc"
              placeholder="Detalles de la estructura..."
              value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={createMutation.isPending}>
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
