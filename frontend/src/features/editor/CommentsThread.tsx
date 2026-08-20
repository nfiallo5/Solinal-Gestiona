import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import type { DocumentComment } from "@/data/seed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CommentsThreadProps {
  comments: DocumentComment[];
  canComment: boolean;
  onAddComment: (text: string) => void;
}

/** Port of legacy js/editor.js rebuildCommentsList / addCommentToDocument (G02 Scenario 4). */
export function CommentsThread({ comments, canComment, onAddComment }: CommentsThreadProps) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setText("");
  }

  return (
    <div className="mt-3.5 grid gap-2">
      <strong className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MessageSquare className="size-3.5" /> Hilo de discusión en el documento
      </strong>

      {comments.length === 0 ? (
        <span className="text-xs italic text-muted-foreground">
          No hay comentarios en este documento.
        </span>
      ) : (
        <div className="grid gap-2">
          {comments.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-muted/50 p-2.5 text-xs transition-colors animate-in fade-in"
            >
              <header className="mb-1 flex justify-between font-bold text-muted-foreground">
                <span>{c.author}</span>
                <small>{c.date}</small>
              </header>
              <p className="leading-relaxed text-foreground">{c.text}</p>
            </div>
          ))}
        </div>
      )}

      {canComment && (
        <div className="flex gap-2">
          <Input
            placeholder="Deja un comentario en esta sección..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="text-xs"
          />
          <Button size="sm" variant="outline" onClick={submit}>
            <Send className="size-3.5" /> Comentar
          </Button>
        </div>
      )}
    </div>
  );
}
