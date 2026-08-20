import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  NotebookText,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Globe2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getChatReply, riskAnalysisText } from "./aiEngine";

interface ChatMessage {
  id: number;
  role: "user" | "system" | "suggestion";
  text: string;
  action?: { label: string; insertText: string };
}

interface AiToolboxProps {
  onInsertText: (text: string) => void;
  onOpenSummary: () => void;
  onOpenScanner: () => void;
  onSimulateRegulation: () => void;
}

let msgId = 1;

/** Port of legacy js/ai.js — Copilot chat + AI toolbox buttons (right column). */
export function AiToolbox({
  onInsertText,
  onOpenSummary,
  onOpenScanner,
  onSimulateRegulation,
}: AiToolboxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "system",
      text: "Hola. Estoy analizando este documento bajo la norma seleccionada. ¿En qué sección te asisto hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function pushMessage(msg: Omit<ChatMessage, "id">) {
    setMessages((prev) => [...prev, { ...msg, id: msgId++ }]);
  }

  function sendPrompt() {
    const text = input.trim();
    if (!text) return;
    pushMessage({ role: "user", text });
    setInput("");
    setThinking(true);

    timerRef.current = setTimeout(() => {
      setThinking(false);
      const reply = getChatReply(text);
      pushMessage({
        role: "system",
        text: reply.text,
        action: { label: reply.actionLabel, insertText: reply.insertText },
      });
      // NOTE: this used to dispatch ADD_AUDIT_LOG client-side. The audit trail
      // is now server-owned and there is deliberately no client-writable POST,
      // so a purely local UI interaction leaves no entry. See NOTES.md A3.8.
    }, 1400);
  }

  function runRiskAnalysis() {
    setThinking(true);
    timerRef.current = setTimeout(() => {
      setThinking(false);
      pushMessage({ role: "suggestion", text: riskAnalysisText });
    }, 1000);
  }

  return (
    <div className="flex min-h-[500px] flex-col gap-3.5 rounded-2xl border border-border bg-card p-4">
      <div>
        <h4 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-status-warning">
          Caja de herramientas IA
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Acciones de IA para optimizar la documentación.
        </p>
      </div>

      <div className="grid gap-2">
        <Button variant="outline" size="sm" className="justify-start" onClick={runRiskAnalysis}>
          <ShieldAlert className="size-4 text-status-danger" /> Análisis de riesgos IA
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
              className={`rounded-2xl p-3 text-[13px] leading-relaxed transition-all animate-in fade-in slide-in-from-bottom-1 ${
                m.role === "system"
                  ? "border-l-4 border-l-tag-technical bg-tag-technical-bg text-tag-technical"
                  : m.role === "suggestion"
                    ? "border-l-4 border-l-status-warning bg-status-warning/10 text-foreground"
                    : "ml-auto w-[85%] bg-muted text-foreground"
              }`}
            >
              {m.role === "user" && <strong>Tú: </strong>}
              {m.role === "system" && <strong>IA: </strong>}
              {m.role === "suggestion" && <strong>Análisis de riesgos IA: </strong>}
              {m.text}
              {m.action && (
                <Button
                  size="sm"
                  className="mt-2 block"
                  onClick={() => onInsertText(m.action!.insertText)}
                >
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
            onKeyDown={(e) => e.key === "Enter" && sendPrompt()}
            className="text-xs"
          />
          <Button size="icon" onClick={sendPrompt}>
            <Sparkles className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
