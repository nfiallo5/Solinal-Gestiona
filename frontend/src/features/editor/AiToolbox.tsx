import { useEffect, useRef, useState } from "react";
import {
  ClipboardCheck,
  FileEdit,
  Loader2,
  NotebookText,
  ScanLine,
  Sparkles,
  Globe2,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiChatReply, AiChatTurn, AiFinding } from "@/lib/api";

interface ChatMessage {
  id: number;
  role: "user" | "system" | "suggestion";
  text: string;
  action?: { label: string; insertText: string };
}

interface AiToolboxProps {
  onOpenSummary: () => void;
  onOpenScanner: () => void;
  onSimulateRegulation: () => void;
  /** Generates a base draft from the doc's norma/tipo and appends it. */
  onGenerateDraft: () => Promise<void>;
  /** Runs the compliance check and returns the findings to render here. */
  onComplianceCheck: () => Promise<AiFinding[]>;
  /** Captures the current selection, sends it to Claude, applies the result. */
  onImproveSelection: () => Promise<void>;
  /** Scoped Q&A — full turn history is this component's own `messages` state. */
  onChat: (question: string, history: AiChatTurn[]) => Promise<AiChatReply>;
  /** Appends a chat suggestion's HTML to the end of the document. */
  onInsertText: (html: string) => void;
  /** Signed-Registro lock: content-writing actions (draft/improve/insert) are
   * disabled — the eventual PATCH would 423 anyway, this just avoids the
   * wasted round trip and confusing error. */
  writeDisabled?: boolean;
}

let msgId = 1;

const severityLabel: Record<AiFinding["severity"], string> = {
  gap: "🔴 Falta",
  weak: "🟡 Insuficiente",
  ok: "🟢 Cumple",
};

function formatFindings(findings: AiFinding[]): string {
  if (findings.length === 0) return "No se detectaron observaciones — el documento luce alineado a la norma.";
  return findings
    .map((f) => `${severityLabel[f.severity]} — ${f.title}: ${f.detail}`)
    .join("\n\n");
}

/** Port of legacy js/ai.js's layout — Copilot chat + AI toolbox buttons (right
 * column) — now backed by a real Claude assistant scoped to this document
 * (see backend/src/routes/ai.ts), instead of the old canned responses. */
export function AiToolbox({
  onOpenSummary,
  onOpenScanner,
  onSimulateRegulation,
  onGenerateDraft,
  onComplianceCheck,
  onImproveSelection,
  onChat,
  onInsertText,
  writeDisabled = false,
}: AiToolboxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "system",
      text: "Hola. Estoy enfocado en este documento y su normativa. ¿En qué sección te asisto hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [toolboxBusy, setToolboxBusy] = useState<"draft" | "compliance" | "improve" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function pushMessage(msg: Omit<ChatMessage, "id">) {
    setMessages((prev) => [...prev, { ...msg, id: msgId++ }]);
  }

  async function sendPrompt() {
    const text = input.trim();
    if (!text) return;
    const history: AiChatTurn[] = messages
      .filter((m) => m.role === "user" || m.role === "system")
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));

    pushMessage({ role: "user", text });
    setInput("");
    setThinking(true);
    try {
      const reply = await onChat(text, history);
      pushMessage({
        role: "system",
        text: reply.answer,
        action: reply.suggestionHtml
          ? { label: "Insertar sugerencia", insertText: reply.suggestionHtml }
          : undefined,
      });
    } catch {
      pushMessage({
        role: "system",
        text: "No pude responder en este momento. Intenta de nuevo en unos segundos.",
      });
    } finally {
      setThinking(false);
    }
  }

  async function runComplianceCheck() {
    setToolboxBusy("compliance");
    try {
      const findings = await onComplianceCheck();
      pushMessage({ role: "suggestion", text: formatFindings(findings) });
    } finally {
      setToolboxBusy(null);
    }
  }

  async function runGenerateDraft() {
    setToolboxBusy("draft");
    try {
      await onGenerateDraft();
    } finally {
      setToolboxBusy(null);
    }
  }

  async function runImproveSelection() {
    setToolboxBusy("improve");
    try {
      await onImproveSelection();
    } finally {
      setToolboxBusy(null);
    }
  }

  return (
    <div className="flex min-h-[500px] flex-col gap-3.5 rounded-2xl border border-border bg-card p-4">
      <div>
        <h4 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-status-warning">
          Caja de herramientas IA
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Asistente Claude enfocado en este documento y su normativa.
        </p>
      </div>

      <div className="grid gap-2">
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          onClick={() => void runGenerateDraft()}
          disabled={writeDisabled || toolboxBusy !== null}
        >
          {toolboxBusy === "draft" ? (
            <Loader2 className="size-4 animate-spin text-tag-technical" />
          ) : (
            <FileEdit className="size-4 text-tag-technical" />
          )}
          Generar documento base (IA)
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          onClick={() => void runComplianceCheck()}
          disabled={toolboxBusy !== null}
        >
          {toolboxBusy === "compliance" ? (
            <Loader2 className="size-4 animate-spin text-status-danger" />
          ) : (
            <ClipboardCheck className="size-4 text-status-danger" />
          )}
          Análisis de cumplimiento (IA)
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          onClick={() => void runImproveSelection()}
          disabled={writeDisabled || toolboxBusy !== null}
          title="Selecciona texto en el documento antes de usar esta acción"
        >
          {toolboxBusy === "improve" ? (
            <Loader2 className="size-4 animate-spin text-tag-lab" />
          ) : (
            <Wand2 className="size-4 text-tag-lab" />
          )}
          Mejorar texto seleccionado (IA)
        </Button>
        <Button variant="outline" size="sm" className="justify-start" onClick={onOpenSummary}>
          <NotebookText className="size-4 text-tag-technical" /> Resumen IA multidocumento
        </Button>
        <Button variant="outline" size="sm" className="justify-start" onClick={onOpenScanner}>
          <ScanLine className="size-4 text-status-valid" /> Escanear formato físico
        </Button>
        <Button variant="outline" size="sm" className="justify-start" onClick={onSimulateRegulation}>
          <Globe2 className="size-4 text-status-warning" /> Simular cambio de ley
        </Button>
      </div>

      <div className="mt-1 flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className="flex items-center justify-between bg-linear-to-br from-navy to-tag-technical px-4 py-3.5 text-navy-foreground">
          <strong className="text-xs tracking-wide">Asistente Copilot IA</strong>
          {thinking && (
            <span className="flex items-center gap-1 text-[11px] opacity-90">
              <Loader2 className="size-3.5 animate-spin" /> Pensando...
            </span>
          )}
        </header>

        <div ref={scrollRef} className="flex max-h-[360px] flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`whitespace-pre-line rounded-2xl p-3 text-[13px] leading-relaxed transition-all animate-in fade-in slide-in-from-bottom-1 ${
                m.role === "system"
                  ? "border-l-4 border-l-tag-technical bg-tag-technical-bg text-tag-technical"
                  : m.role === "suggestion"
                    ? "border-l-4 border-l-status-warning bg-status-warning/10 text-foreground"
                    : "ml-auto w-[85%] bg-muted text-foreground"
              }`}
            >
              {m.role === "user" && <strong>Tú: </strong>}
              {m.role === "system" && <strong>IA: </strong>}
              {m.role === "suggestion" && <strong>Análisis de cumplimiento IA: </strong>}
              {m.text}
              {m.action && !writeDisabled && (
                <Button size="sm" className="mt-2 block" onClick={() => onInsertText(m.action!.insertText)}>
                  {m.action.label}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-border p-2.5">
          <Input
            placeholder="Escribe al asistente..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void sendPrompt()}
            className="text-xs"
            disabled={thinking}
          />
          <Button size="icon" onClick={() => void sendPrompt()} disabled={thinking}>
            <Sparkles className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
