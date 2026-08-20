import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EyeOff, History, Loader2 } from "lucide-react";

import { useAppState } from "@/context/AppStateContext";
import { Button } from "@/components/ui/button";
import { AiToolbox } from "@/features/editor/AiToolbox";
import { ContentEditor } from "@/features/editor/ContentEditor";
import { esRegistroPorNivel } from "@/features/documents/docStyles";
import { GuidePanel } from "@/features/editor/GuidePanel";
import { MergeDialog } from "@/features/editor/MergeDialog";
import { MetadataForm } from "@/features/editor/MetadataForm";
import { RegulationBanner } from "@/features/editor/RegulationBanner";
import { ScannerDialog } from "@/features/editor/ScannerDialog";
import { SummaryDialog } from "@/features/editor/SummaryDialog";
import { VersionHistoryDialog } from "@/features/editor/VersionHistoryDialog";
import {
  ApiError,
  documentsApi,
  isContentConflict,
  workflowApi,
  type ContentConflictDetails,
  type ScanImportInput,
  type WorkflowResult,
} from "@/lib/api";
import {
  invalidateAfterDocumentMutation,
  queryKeys,
  useDocumentComments,
  useDocuments,
  useRegulationAlert,
} from "@/lib/queries";

/** Debounce for the contentEditable autosave — the toolbar already advertises
 * "Guardado automáticamente", this makes it literally true against the API. */
const AUTOSAVE_DELAY_MS = 900;

/** Port of legacy js/editor.js — "Editor & Asistente IA" page (pg-edit),
 * now backed by the real API instead of the in-memory reducer. */
export default function EditorPage() {
  const { state, dispatch } = useAppState();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const requestedCode = searchParams.get("doc");

  const { activeUser, activeRole } = state.session;
  const isLector = activeRole === "Lector";

  const documentsQuery = useDocuments({}, !isLector);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);

  const activeCode = requestedCode ?? state.session.activeDocCode;
  const doc = useMemo(
    () => documents.find((d) => d.code === activeCode) ?? documents[0],
    [documents, activeCode],
  );

  // Keep session.activeDocCode in sync with the ?doc= query param, exactly
  // like legacy loadDocumentToEditor(code) being called on navigation.
  useEffect(() => {
    if (doc && doc.code !== state.session.activeDocCode) {
      dispatch({ type: "SET_ACTIVE_DOC", payload: { code: doc.code } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.code]);

  const commentsQuery = useDocumentComments(doc?.code, !isLector);
  const regulationQuery = useRegulationAlert(doc?.code, !isLector);
  const regulationAlert = regulationQuery.data ?? null;

  const [regulationBannerDismissed, setRegulationBannerDismissed] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [conflict, setConflict] = useState<ContentConflictDetails | null>(null);
  const [busy, setBusy] = useState(false);
  /** Bumped whenever the SERVER rewrote the content, to re-seed the editor. */
  const [contentEpoch, setContentEpoch] = useState(0);

  // Optimistic-concurrency token for the autosave loop. Kept in a ref (not in
  // the query cache) so back-to-back saves always send the version the last
  // PATCH returned, instead of racing the refetch.
  const contentVersionRef = useRef(0);
  const pendingContentRef = useRef<string | null>(null);
  /** Freshest known body: the server's, or the user's unsaved keystrokes. */
  const currentContentRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!doc) return;
    contentVersionRef.current = doc.contentVersion;
    currentContentRef.current = doc.content;
    pendingContentRef.current = null;
    setRegulationBannerDismissed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.code]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  // The regulation banner predicate is now computed by the server
  // (`GET /documents/:code/regulation-alert`): the doc's norma has an active
  // alert AND its content does not already contain that alert's marker.
  const alertId = regulationAlert?.id;
  useEffect(() => {
    if (!doc || !alertId) return;
    toast.warning(
      `El documento ${doc.code} está regido por ${doc.norma}, una normativa con actualización internacional pendiente.`,
    );
    // The old code also dispatched an ADD_AUDIT_LOG here; that dispatch is
    // orphaned by design (no client-writable audit endpoint — NOTES.md A3.8)
    // and the fact itself is now server-derived, so it is simply dropped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId, doc?.code]);

  const reportError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof ApiError) toast.error(error.message);
    else toast.error(fallback);
  }, []);

  /** Refetches the document list (and audit trail) after a server-side write. */
  const refresh = useCallback(
    async (code: string, rewroteContent: boolean) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.regulationAlert(code) });
      // Awaited: the editor is re-seeded from `doc.content` right after, so the
      // fresh copy has to have landed first.
      await queryClient.refetchQueries({ queryKey: queryKeys.documentsAll });
      if (rewroteContent) setContentEpoch((epoch) => epoch + 1);
    },
    [queryClient],
  );

  if (isLector) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-24 text-center">
        <EyeOff className="size-8 text-muted-foreground" />
        <h2 className="text-lg font-bold">Acceso restringido</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Tu rol de Lector solo permite consultar documentos aprobados. El Editor &amp;
          Asistente IA está reservado a roles de edición/aprobación.
        </p>
        <Button asChild size="sm">
          <Link to="/documentos">Volver a Documentos</Link>
        </Button>
      </div>
    );
  }

  if (documentsQuery.isPending) {
    return (
      <div className="flex items-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando documento...
      </div>
    );
  }

  if (!doc) {
    return <div className="text-sm text-muted-foreground">No hay documentos disponibles.</div>;
  }

  const code = doc.code;

  // --- autosave del contenido ------------------------------------------------

  async function persistContent(content: string) {
    pendingContentRef.current = null;
    try {
      const updated = await documentsApi.patch(code, {
        content,
        contentVersion: contentVersionRef.current,
      });
      contentVersionRef.current = updated.contentVersion;
      currentContentRef.current = updated.content;
      invalidateAfterDocumentMutation(queryClient, code);
    } catch (error) {
      if (isContentConflict(error)) {
        setConflict(error.details);
        setMergeModalOpen(true);
        return;
      }
      if (error instanceof ApiError && error.status === 423) {
        // Backstop for the signed-Registro freeze; the UI is already read-only.
        toast.error(error.message);
        return;
      }
      reportError(error, "No se pudieron guardar los cambios del contenido.");
    }
  }

  function handleContentChange(content: string) {
    pendingContentRef.current = content;
    currentContentRef.current = content;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void persistContent(content), AUTOSAVE_DELAY_MS);
  }

  /** Flushes any debounced keystrokes before running another action. */
  async function flushContent() {
    clearTimeout(saveTimerRef.current);
    const pending = pendingContentRef.current;
    if (pending !== null) await persistContent(pending);
  }

  /** Appends a block to the document body through a real content write. */
  async function appendContent(text: string, successMessage?: string) {
    setBusy(true);
    try {
      await flushContent();
      const updated = await documentsApi.patch(code, {
        content: currentContentRef.current + text,
        contentVersion: contentVersionRef.current,
      });
      contentVersionRef.current = updated.contentVersion;
      currentContentRef.current = updated.content;
      await refresh(code, true);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      if (isContentConflict(error)) {
        setConflict(error.details);
        setMergeModalOpen(true);
      } else {
        reportError(error, "No se pudo actualizar el contenido del documento.");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Runs a workflow action and shows the exact toast copy the server chose. */
  async function runAction(
    action: () => Promise<WorkflowResult>,
    options: { rewritesContent?: boolean; tone?: "success" | "warning" } = {},
  ) {
    setBusy(true);
    try {
      await flushContent();
      const result = await action();
      contentVersionRef.current = result.document.contentVersion;
      currentContentRef.current = result.document.content;
      await refresh(code, options.rewritesContent ?? false);
      if (options.tone === "warning" || result.message.includes("1/2")) {
        toast.warning(result.message);
      } else {
        toast.success(result.message);
      }
    } catch (error) {
      reportError(error, "La acción no pudo completarse.");
    } finally {
      setBusy(false);
    }
  }

  // --- toggle bloqueo de sección (G03 Scenario 2) --------------------------
  // `sectionLocked` used to be ONE global boolean on the session, shared by
  // every document. It is now a per-document column toggled through
  // `PATCH /documents/:code/section-lock`, which also enforces the
  // creador-or-Administrador rule server-side.
  function handleToggleLock() {
    void runAction(() => workflowApi.toggleSectionLock(code));
  }

  // --- guardar nueva versión (G02 Scenario 1) -------------------------------
  function handleSaveVersion() {
    void runAction(() => workflowApi.saveVersion(code));
  }

  // --- comentarios (G02 Scenario 4) -----------------------------------------
  async function handleAddComment(text: string) {
    try {
      await documentsApi.addComment(code, text);
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(code) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogsAll });
      toast.success("Comentario añadido al hilo de discusión.");
    } catch (error) {
      reportError(error, "No se pudo añadir el comentario.");
    }
  }

  // --- firmas electrónicas (G03 Scenario 1 + G07 Scenario 4) ----------------
  // Role gate, rolesRequeridos gate, can't-sign-twice and the critical
  // double-approval branch all live server-side now; rejected attempts are
  // audited there too.
  function handleSign() {
    void runAction(() => workflowApi.sign(code));
  }

  // --- historial de versiones -----------------------------------------------
  function handleRestoreVersion(idx: number) {
    void runAction(() => workflowApi.restoreVersion(code, idx), { rewritesContent: true });
  }

  // --- fusión concurrente real (G02 Scenario 2) ------------------------------
  async function handleConfirmMerge() {
    if (!conflict) return;
    setBusy(true);
    try {
      const result = await workflowApi.merge(code, {
        // Keep the user's rejected draft and append the consolidation note —
        // the same thing the old fake `handleConfirmMerge()` did to the local
        // content. A re-conflict answers the identical 409 body.
        ...(conflict.clientContent !== null
          ? { content: conflict.clientContent, appendResolutionText: true }
          : {}),
        contentVersion: conflict.serverContentVersion,
      });
      contentVersionRef.current = result.document.contentVersion;
      currentContentRef.current = result.document.content;
      setConflict(null);
      setMergeModalOpen(false);
      await refresh(code, true);
      toast.success(result.message);
    } catch (error) {
      if (isContentConflict(error)) {
        setConflict(error.details);
        return;
      }
      reportError(error, "No se pudieron fusionar los cambios.");
    } finally {
      setBusy(false);
    }
  }

  // --- escaner de formato físico (G04 Scenario 4) -----------------------------
  function handleScanComplete(payload: ScanImportInput) {
    void runAction(() => workflowApi.scanImport(code, payload), { rewritesContent: true });
  }

  // --- alerta de cambio normativo (G01 Scenario 4) -----------------------------
  async function handleSimulateRegulation() {
    setRegulationBannerDismissed(false);
    const result = await regulationQuery.refetch();
    if (result.data) {
      toast.warning("Se ha recibido una alerta de actualización regulatoria internacional.");
    } else {
      toast.info(`No hay actualizaciones regulatorias pendientes para ${doc.norma}.`);
    }
  }

  function handleApplyRegulation() {
    setRegulationBannerDismissed(true);
    void runAction(() => workflowApi.applyRegulation(code), { rewritesContent: true });
  }

  function handleSummaryGenerated(_count: number) {
    toast.success("Resumen consolidado generado.");
  }

  // Lector role already receives the "Acceso restringido" early return above,
  // so any role reaching this point is implicitly allowed to comment.
  const canComment = true;

  // Un Registro firmado es evidencia congelada — su contenido ya no puede
  // editarse (ver docStyles.esRegistroPorNivel). El servidor responde 423 a
  // cualquier escritura de contenido en ese estado.
  const contenidoBloqueado = esRegistroPorNivel(doc.nivel) && doc.signatures.length > 0;
  const regulationBannerVisible = Boolean(regulationAlert) && !regulationBannerDismissed;

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Editor &amp; Asistente IA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea, edita, firma e implementa controles de calidad asistido por Inteligencia
            Artificial y cumplimiento regulatorio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setVersionModalOpen(true)}>
            <History className="size-3.5" /> Historial de versiones
          </Button>
        </div>
      </div>

      <RegulationBanner visible={regulationBannerVisible} onApply={handleApplyRegulation} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4.5">
          <MetadataForm doc={doc} />
          <ContentEditor
            doc={doc}
            activeUser={activeUser}
            activeRole={activeRole}
            isSectionLocked={doc.sectionLocked}
            comments={commentsQuery.data ?? []}
            readOnly={contenidoBloqueado}
            canComment={canComment}
            resetKey={contentEpoch}
            onContentChange={handleContentChange}
            onToggleLock={handleToggleLock}
            onSaveVersion={handleSaveVersion}
            onAddComment={handleAddComment}
            onSign={handleSign}
          />
        </div>

        <div className="flex flex-col gap-4.5">
          <GuidePanel doc={doc} />

          <AiToolbox
            onInsertText={(text) =>
              void appendContent(text, "Sugerencia de la IA insertada al borrador.")
            }
            onOpenSummary={() => setSummaryModalOpen(true)}
            onOpenScanner={() => setScannerModalOpen(true)}
            onSimulateRegulation={() => void handleSimulateRegulation()}
          />
        </div>
      </div>

      <VersionHistoryDialog
        open={versionModalOpen}
        onOpenChange={setVersionModalOpen}
        doc={doc}
        onRestore={handleRestoreVersion}
      />
      <MergeDialog
        open={mergeModalOpen}
        onOpenChange={(next) => {
          setMergeModalOpen(next);
          if (!next) setConflict(null);
        }}
        onConfirm={() => void handleConfirmMerge()}
        clientContent={conflict?.clientContent}
        serverContent={conflict?.serverContent}
        serverUpdatedAt={conflict?.serverUpdatedAt}
        pending={busy}
      />
      <ScannerDialog
        open={scannerModalOpen}
        onOpenChange={setScannerModalOpen}
        onComplete={handleScanComplete}
        inspector={activeUser}
      />
      <SummaryDialog
        open={summaryModalOpen}
        onOpenChange={setSummaryModalOpen}
        documents={documents}
        onSummaryGenerated={handleSummaryGenerated}
      />
    </div>
  );
}
