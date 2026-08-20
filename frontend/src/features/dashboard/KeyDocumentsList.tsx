import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SolinalDocument } from "@/data/seed";
import { useAppState } from "@/context/AppStateContext";

/**
 * Port of legacy "Documentos clave" timeline (#dash-key-docs). Clicking an
 * item used to call `loadDocumentToEditor(code)` + `goPage('edit')`; here
 * we dispatch SET_ACTIVE_DOC (foundation action, already in
 * AppStateContext) and navigate to /editor?doc=CODE.
 */
export function KeyDocumentsList({ docs }: { docs: SolinalDocument[] }) {
  const navigate = useNavigate();
  const { dispatch } = useAppState();

  function openInEditor(doc: SolinalDocument) {
    dispatch({ type: "SET_ACTIVE_DOC", payload: { code: doc.code } });
    navigate(`/editor?doc=${encodeURIComponent(doc.code)}`);
  }

  return (
    <Card className="animate-in fade-in duration-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-secondary" />
          Documentos clave
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {docs.map((doc) => (
          <button
            key={doc.code}
            type="button"
            onClick={() => openInEditor(doc)}
            className="rounded-lg border-l-2 border-primary/50 bg-muted/30 px-3.5 py-3 text-left transition-colors hover:bg-muted/60"
          >
            <strong className="text-sm font-bold text-foreground">
              {doc.title}
            </strong>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {doc.type} · {doc.norma} · {doc.version}
            </p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
