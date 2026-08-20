import type { SolinalDocument } from "@/data/seed";
import { Badge } from "@/components/ui/badge";
import { areaFromCode, statusLabel } from "@/features/documents/docStyles";

interface MetadataFormProps {
  doc: SolinalDocument;
}

/** Port of legacy js/editor.js's `.ebar` — a read-only strip showing the
 * document's fixed identity (código/tipo/área/norma/versión/estado). Unlike
 * the legacy prototype's metadata form, these fields are set once at
 * creation (see CreateDocumentDialog) and are not editable afterwards —
 * only the content body below is. */
export function MetadataForm({ doc }: MetadataFormProps) {
  const area = areaFromCode(doc.code);

  const fields: Array<{ label: string; value: string }> = [
    { label: "Código", value: doc.code },
    { label: "Tipo", value: doc.type },
    { label: "Área", value: area?.label ?? "—" },
    { label: "Norma", value: doc.norma },
    { label: "Versión", value: doc.version },
    { label: "Estado", value: statusLabel(doc.estado, doc.vencido) },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4.5 py-4">
        <strong className="text-sm font-extrabold">{doc.title}</strong>
        <Badge>{doc.code}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4.5 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {f.label}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
