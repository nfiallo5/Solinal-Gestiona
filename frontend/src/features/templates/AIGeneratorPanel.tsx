import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { simulateAIProposal, type AITemplateProposal } from "./aiSimulator";

interface AIGeneratorPanelProps {
  onAccept: (proposal: AITemplateProposal) => void;
}

type PanelState = "idle" | "loading" | "ready";

/**
 * Ported from js/templates.js generateTemplateByAI() / acceptAITemplate()
 * — the "Generador IA de Plantillas" side panel. The legacy version always
 * returned a fixed canned "Control de Plagas" proposal; here the mock
 * proposal is derived from the prompt text (see aiSimulator.ts) but the
 * interaction shape (typing indicator → proposal → aceptar/editar or
 * descartar) is the same.
 */
export function AIGeneratorPanel({ onAccept }: AIGeneratorPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [proposal, setProposal] = useState<AITemplateProposal | null>(null);

  function handleGenerate() {
    if (!prompt.trim() || panelState === "loading") return;
    setPanelState("loading");
    setProposal(null);

    window.setTimeout(() => {
      const result = simulateAIProposal(prompt);
      setProposal(result);
      setPanelState("ready");
      // The audit trail is server-owned and has no client-writable POST
      // (NOTES.md A3.8); generating a local mock proposal writes no entry.
      // The real entry is written by POST /templates when it is saved.
    }, 1200);
  }

  function handleDiscard() {
    setProposal(null);
    setPanelState("idle");
    setPrompt("");
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="bg-navy px-5 py-4 text-navy-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-mint" />
          <strong className="text-sm">Generador IA de Plantillas</strong>
        </div>
        <p className="mt-1 text-xs text-navy-foreground/80">
          Crea borradores sectoriales por descripción.
        </p>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {panelState === "idle" && !proposal && (
          <div className="rounded-lg border-l-4 border-secondary bg-muted p-3 text-sm">
            <strong>IA:</strong> Escribe qué tipo de plantilla necesitas y bajo qué norma ISO
            para redactarla.
          </div>
        )}

        {panelState === "loading" && (
          <div className="rounded-lg border-l-4 border-secondary bg-muted p-3 text-sm italic text-muted-foreground">
            IA construyendo borrador de estructura y secciones obligatorias...
          </div>
        )}

        {panelState === "ready" && proposal && (
          <div className="space-y-3 rounded-lg border-l-4 border-primary bg-accent p-3 text-sm">
            <strong>Propuesta IA de plantilla:</strong>
            <div>
              <div className="text-xs text-muted-foreground">Nombre sugerido</div>
              <div className="font-medium">{proposal.name}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">
                {proposal.norma}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {proposal.type}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Secciones recomendadas</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {proposal.mandatory.map((section) => (
                  <Badge key={section} className="font-normal">
                    {section}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => onAccept(proposal)}>
                Aceptar e integrar como plantilla
              </Button>
              <Button size="sm" variant="outline" onClick={handleDiscard}>
                Descartar
              </Button>
            </div>
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <Textarea
            placeholder="Ej. Procedimiento de Control de Plagas para ISO 22000..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[42px] resize-none"
            rows={1}
          />
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || panelState === "loading"}
            className="shrink-0"
          >
            <Wand2 className="h-4 w-4" />
            Generar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
