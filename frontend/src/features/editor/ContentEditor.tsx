import { useEffect, useRef } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  Bold,
  CircleCheck,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Lock,
  LockOpen,
  PenSquare,
  Redo2,
  Save,
  Table as TableIcon,
  Underline,
  Undo2,
} from "lucide-react";

import type { DocumentComment, RoleName, SolinalDocument } from "@/data/seed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { documentTypeAbbr, statusLabel } from "@/features/documents/docStyles";
import { CommentsThread } from "./CommentsThread";
import { LockedSection } from "./LockedSection";
import { SignaturesPanel } from "./SignaturesPanel";

interface ContentEditorProps {
  doc: SolinalDocument;
  activeUser: string;
  activeRole: RoleName;
  isSectionLocked: boolean;
  comments: DocumentComment[];
  canComment: boolean;
  onContentChange: (content: string) => void;
  onToggleLock: () => void;
  onSaveVersion: () => void;
  onAddComment: (text: string) => void;
  onSign: () => void;
  /** true when this is a signed Registro — content is frozen evidence and
   * can no longer be edited (ver docStyles.esRegistroPorNivel). */
  readOnly?: boolean;
  /**
   * Bump this to force the uncontrolled contentEditable to re-seed itself from
   * `doc.content`. Needed now that content can be rewritten by the SERVER
   * (merge / scan-import / apply-regulation / restore / AI insert) rather than
   * only by the user's own keystrokes.
   */
  resetKey?: number;
}

const TABLE_HTML =
  "<table><thead><tr><th>Columna 1</th><th>Columna 2</th></tr></thead>" +
  "<tbody><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>";

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
  disabled,
}: {
  icon: typeof Bold;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      // Prevent the button from stealing focus so the editor's text
      // selection survives the click — required for execCommand to act
      // on the right range.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="size-[15px]" />
    </button>
  );
}

/** Port of legacy js/editor.js "Editor de Contenido" card — a real rich-text
 * contentEditable surface with a formatting toolbar (bold/italic/underline,
 * headings, lists, alignment, table insert, undo/redo — mirroring legacy
 * `.etb` / `ed()`), plus the lock toggle, locked section, comments thread
 * and signatures panel. */
export function ContentEditor({
  doc,
  activeUser,
  activeRole,
  isSectionLocked,
  comments,
  canComment,
  onContentChange,
  onToggleLock,
  onSaveVersion,
  onAddComment,
  onSign,
  readOnly = false,
  resetKey = 0,
}: ContentEditorProps) {
  const isOwner = activeUser === doc.creador || activeRole === "Administrador";
  const bodyRef = useRef<HTMLDivElement>(null);

  // Uncontrolled contentEditable: only re-seed the DOM when switching to a
  // different document — or when `resetKey` changes because the server
  // rewrote the content — never on every keystroke (that would fight the
  // browser's own cursor/selection handling).
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.innerHTML = doc.content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.code, resetKey]);

  function handleInput() {
    if (bodyRef.current) onContentChange(bodyRef.current.innerHTML);
  }

  function runCommand(cmd: string, value?: string) {
    bodyRef.current?.focus();
    exec(cmd, value);
    handleInput();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <PenSquare className="size-4 text-primary" /> Editor de contenido
        </h3>
        <div className="flex items-center gap-2">
          {isSectionLocked && (
            <Badge variant="outline" className="border-status-danger/30 bg-status-danger/10 text-status-danger">
              Sección crítica bloqueada
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={onToggleLock}>
            {isSectionLocked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            Bloquear sección
          </Button>
          <Button size="sm" onClick={onSaveVersion}>
            <Save className="size-3.5" /> Guardar versión
          </Button>
        </div>
      </div>

      <LockedSection doc={doc} activeUser={activeUser} activeRole={activeRole} />

      {readOnly && (
        <div className="mb-3 rounded-md border-l-4 border-secondary bg-muted p-3 text-xs text-muted-foreground">
          Este documento es un <strong>Registro</strong> y ya cuenta con firma(s). Su contenido
          queda protegido como evidencia y no puede modificarse.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-2 py-1.5">
          <ToolbarButton icon={Bold} title="Negrita" onClick={() => runCommand("bold")} disabled={readOnly} />
          <ToolbarButton icon={Italic} title="Cursiva" onClick={() => runCommand("italic")} disabled={readOnly} />
          <ToolbarButton icon={Underline} title="Subrayado" onClick={() => runCommand("underline")} disabled={readOnly} />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={Heading1} title="Título 1" onClick={() => runCommand("formatBlock", "H1")} disabled={readOnly} />
          <ToolbarButton icon={Heading2} title="Título 2" onClick={() => runCommand("formatBlock", "H2")} disabled={readOnly} />
          <ToolbarButton icon={Heading3} title="Título 3" onClick={() => runCommand("formatBlock", "H3")} disabled={readOnly} />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={List} title="Lista" onClick={() => runCommand("insertUnorderedList")} disabled={readOnly} />
          <ToolbarButton icon={ListOrdered} title="Lista numerada" onClick={() => runCommand("insertOrderedList")} disabled={readOnly} />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={AlignLeft} title="Izquierda" onClick={() => runCommand("justifyLeft")} disabled={readOnly} />
          <ToolbarButton icon={AlignCenter} title="Centro" onClick={() => runCommand("justifyCenter")} disabled={readOnly} />
          <ToolbarButton icon={AlignJustify} title="Justificar" onClick={() => runCommand("justifyFull")} disabled={readOnly} />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={TableIcon} title="Insertar tabla" onClick={() => runCommand("insertHTML", TABLE_HTML)} disabled={readOnly} />
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton icon={Undo2} title="Deshacer" onClick={() => runCommand("undo")} disabled={readOnly} />
          <ToolbarButton icon={Redo2} title="Rehacer" onClick={() => runCommand("redo")} disabled={readOnly} />

          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-status-valid">
            <CircleCheck className="size-3.5" /> Guardado automáticamente
          </span>
        </div>

        {/* Page backdrop + sheet — same header/body/footer structure as the
            "Documento de ejemplo" preview in Control Documental (Encabezado
            / cuerpo / PieDocumento), populated with this document's real
            fields instead of the preview's placeholder data. Fills the tab
            instead of being a small fixed-height box. */}
        <div className="bg-muted/40 p-4 sm:p-8">
          <div className="mx-auto w-full max-w-[850px] bg-white shadow-lg">
            {/* Letterhead — mirrors ControlDocumental's default "tripartito" Encabezado. */}
            <table className="w-full border-collapse text-[11px] text-neutral-900">
              <tbody>
                <tr>
                  <td
                    rowSpan={2}
                    className="w-[92px] border border-neutral-800 p-2 text-center align-middle"
                  >
                    <div className="mx-auto flex size-11 items-center justify-center rounded-md bg-navy text-xs font-bold text-navy-foreground">
                      {documentTypeAbbr[doc.type]}
                    </div>
                  </td>
                  <td rowSpan={2} className="border border-neutral-800 p-2.5 align-middle">
                    <div className="font-mono text-[10.5px] text-neutral-600">{doc.code}</div>
                    <div className="mt-1 text-[13px] font-bold">{doc.title.toUpperCase()}</div>
                    <div className="mt-1 text-[10px] font-normal text-neutral-600">
                      {doc.type} · {doc.norma}
                    </div>
                  </td>
                  <td className="w-[150px] border border-neutral-800 p-2 align-middle">
                    <span className="font-bold">Versión:</span> {doc.version}
                  </td>
                </tr>
                <tr>
                  <td className="border border-neutral-800 p-2 align-middle">
                    <span className="font-bold">Estado:</span> {statusLabel(doc.estado, doc.vencido)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              ref={bodyRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              spellCheck={false}
              onInput={handleInput}
              className="min-h-[65vh] bg-white p-8 leading-relaxed focus:outline-none sm:p-12
                [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:first:mt-0
                [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold
                [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-bold
                [&_p]:mb-2.5 [&_p]:last:mb-0
                [&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5
                [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:mb-1
                [&_strong]:font-bold
                [&_table]:my-2.5 [&_table]:w-full [&_table]:border-collapse
                [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1.5 [&_th]:text-left [&_th]:text-xs
                [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_td]:text-xs"
            />

            {/* Firma strip — mirrors ControlDocumental's default "firmasTabla"
                PieDocumento, with real elaborador/estado/firmas instead of
                the preview's fixed sample names. */}
            <table className="w-full border-collapse text-[11px] text-neutral-900">
              <tbody>
                <tr>
                  <td className="w-1/3 border border-neutral-800 p-2 font-bold">Elaboró</td>
                  <td className="w-1/3 border border-neutral-800 p-2 font-bold">Estado</td>
                  <td className="w-1/3 border border-neutral-800 p-2 font-bold">Firmas registradas</td>
                </tr>
                <tr>
                  <td className="border border-neutral-800 p-2">{doc.creador}</td>
                  <td className="border border-neutral-800 p-2">{statusLabel(doc.estado, doc.vencido)}</td>
                  <td className="border border-neutral-800 p-2">
                    {doc.signatures.length > 0 ? doc.signatures.join(", ") : "Pendiente"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CommentsThread comments={comments} canComment={canComment} onAddComment={onAddComment} />

      <SignaturesPanel signatures={doc.signatures} onSign={onSign} />

      {!isOwner && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Eres colaborador de este documento. Algunos controles críticos permanecen
          restringidos al creador ({doc.creador}) o a un Administrador.
        </p>
      )}
    </div>
  );
}
