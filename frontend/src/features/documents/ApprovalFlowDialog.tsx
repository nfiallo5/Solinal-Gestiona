import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleCheck, Ellipsis, FileCheck2, X } from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/context/AppStateContext";
import type { SolinalDocument } from "@/data/seed";
import { workflowApi, type WorkflowResult } from "@/lib/api";
import { invalidateAfterDocumentMutation, useUsers } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApprovalFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: SolinalDocument | null;
}

type StepTone = "done" | "active" | "pending";

function Step({
  tone,
  icon: Icon,
  title,
  subtitle,
}: {
  tone: StepTone;
  icon: typeof Check;
  title: string;
  subtitle: string;
}) {
  const dotClass =
    tone === "done"
      ? "bg-status-valid/15 text-status-valid"
      : tone === "active"
        ? "bg-tag-technical-bg text-tag-technical"
        : "bg-muted text-muted-foreground";
  return (
    <div className="flex gap-3 pb-3.5 last:pb-0">
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${dotClass}`}>
        <Icon className="size-3.5" />
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** Port of legacy #mapr "Flujo de aprobación" modal — openApprove() / approveDoc() /
 * rejectDoc() (js/documents.js). Unlike the legacy version (hardcoded to
 * POL-GER-003), this opens for whichever "En aprobación" row's Aprobar
 * button was clicked, and reuses the same critical-document double-approval
 * rule as the Editor's signature panel (see Editor.tsx handleSign). */
export function ApprovalFlowDialog({ open, onOpenChange, doc }: ApprovalFlowDialogProps) {
  const { state } = useAppState();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { activeUser, activeRole } = state.session;
  const canDecide = activeRole === "Aprobador" || activeRole === "Administrador";
  const users = useUsers().data ?? [];
  const revisor = users.find((u) => u.role === "Revisor");
  const aprobador = users.find((u) => u.role === "Aprobador");

  function close() {
    setComment("");
    onOpenChange(false);
  }

  function onDecided(result: WorkflowResult, tone: "success" | "error") {
    invalidateAfterDocumentMutation(queryClient, result.document.code);
    // `message` is the exact toast copy of the branch the server took (1/2
    // co-signature vs. full approval), so it is used verbatim.
    if (tone === "error") toast.error(result.message);
    else if (result.message.includes("1/2")) toast.warning(result.message);
    else toast.success(result.message);
    close();
  }

  function onFailed(error: unknown) {
    toast.error(error instanceof Error ? error.message : "La acción no pudo completarse.");
  }

  const approveMutation = useMutation({
    mutationFn: (input: { code: string; comment?: string }) =>
      workflowApi.approve(input.code, input.comment),
    onSuccess: (result) => onDecided(result, "success"),
    onError: onFailed,
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { code: string; comment: string }) =>
      workflowApi.reject(input.code, input.comment),
    onSuccess: (result) => onDecided(result, "error"),
    onError: onFailed,
  });

  const pending = approveMutation.isPending || rejectMutation.isPending;

  function handleApprove() {
    if (!doc) return;
    if (!canDecide) {
      toast.error("Solo un Aprobador o Administrador puede aprobar este documento.");
      return;
    }
    approveMutation.mutate({ code: doc.code, comment: comment.trim() || undefined });
  }

  function handleReject() {
    if (!doc) return;
    if (!canDecide) {
      toast.error("Solo un Aprobador o Administrador puede rechazar este documento.");
      return;
    }
    if (!comment.trim()) {
      toast.error("El comentario es obligatorio para rechazar el documento.");
      return;
    }
    rejectMutation.mutate({ code: doc.code, comment: comment.trim() });
  }

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-tag-technical" /> Flujo de aprobación
          </DialogTitle>
        </DialogHeader>

        <p className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          {doc.code} — {doc.title} · {doc.norma} · {doc.version}
        </p>

        <div>
          <Step tone="done" icon={Check} title="Elaborado" subtitle={`${doc.creador} · ${doc.version} creada`} />
          <Step
            tone="done"
            icon={Check}
            title="Revisado"
            subtitle={revisor ? `${revisor.name} · Sin observaciones` : "Sin observaciones"}
          />
          <Step
            tone="active"
            icon={Ellipsis}
            title="Aprobación pendiente"
            subtitle={
              aprobador
                ? `Asignado a: ${aprobador.name}${aprobador.name === activeUser ? " (tú)" : ""}`
                : "Pendiente de asignación"
            }
          />
          <Step
            tone="pending"
            icon={FileCheck2}
            title="Publicación automática"
            subtitle="Se ejecuta al aprobar."
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-semibold text-foreground">
            Comentario (opcional para aprobar, <span className="text-status-danger">obligatorio</span> para rechazar)
          </label>
          <Textarea
            placeholder="Ingresa un comentario o motivo de rechazo..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>

        {!canDecide && (
          <p className="text-xs text-muted-foreground">
            Solo un Aprobador o Administrador puede aprobar o rechazar. Tu rol actual es {activeRole}.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReject}
            disabled={!canDecide || pending}
          >
            <X className="size-3.5" /> Rechazar
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={!canDecide || pending}>
            <CircleCheck className="size-3.5" /> Aprobar y publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
