import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CircleCheck, FileDown, FilePlus, FileText, LayoutGrid, ListFilter, Plus, SearchX } from "lucide-react";

import { useAppState } from "@/context/AppStateContext";
import type { DocumentStatus, DocumentType } from "@/data/seed";
import { useDocuments } from "@/lib/queries";
import type { DocumentFilters } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApprovalFlowDialog } from "@/features/documents/ApprovalFlowDialog";
import { CreateDocumentDialog } from "@/features/documents/CreateDocumentDialog";
import { docTypeBadgeClass, documentTypeOptions, normaOptions, statusBadgeClass, statusLabel } from "@/features/documents/docStyles";

type EstadoFilter = "all" | DocumentStatus | "Vencido";
type TypeFilter = "all" | DocumentType;
type NormaFilter = "all" | (typeof normaOptions)[number];

/** Port of legacy js/documents.js renderDocumentList/applyFilters/clearFilters. */
export default function Documentos() {
  const { state, dispatch } = useAppState();
  const navigate = useNavigate();

  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [normaFilter, setNormaFilter] = useState<NormaFilter>("all");
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "template">("blank");

  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalCode, setApprovalCode] = useState<string | null>(null);

  const isLector = state.session.activeRole === "Lector";

  // The four filters are now server-side query params (`GET /documents`), which
  // also scopes a Lector to `estado=Aprobado` on the API rather than trusting
  // the client to hide the rest. `search` is debounced so typing does not fire
  // one request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = useMemo<DocumentFilters>(
    () => ({
      ...(estadoFilter !== "all" ? { estado: estadoFilter } : {}),
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(normaFilter !== "all" ? { norma: normaFilter } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [estadoFilter, typeFilter, normaFilter, debouncedSearch],
  );

  const documentsQuery = useDocuments(filters);
  const docList = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const approvalDoc = docList.find((d) => d.code === approvalCode) ?? null;

  function clearFilters() {
    setEstadoFilter("all");
    setTypeFilter("all");
    setNormaFilter("all");
    setSearch("");
  }

  function openInEditor(code: string) {
    dispatch({ type: "SET_ACTIVE_DOC", payload: { code } });
    navigate(`/editor?doc=${encodeURIComponent(code)}`);
    toast.success(`Documento ${code} cargado en el editor.`);
  }

  function openCreateDoc(mode: "blank" | "template") {
    setCreateMode(mode);
    setCreateOpen(true);
  }

  function openApprovalFlow(code: string) {
    setApprovalCode(code);
    setApprovalOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listado de documentos con estados, versiones, adjuntos y flujo de aprobación.
          </p>
        </div>
        {!isLector && (
          <Button onClick={() => openCreateDoc("blank")}>
            <Plus className="size-4" />
            Crear documento
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-wrap gap-3">
            <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="Borrador">Borrador</SelectItem>
                <SelectItem value="En aprobación">En aprobación</SelectItem>
                <SelectItem value="Aprobado">Aprobado / Vigente</SelectItem>
                <SelectItem value="Rechazado">Rechazado</SelectItem>
                <SelectItem value="Vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {documentTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={normaFilter} onValueChange={(v) => setNormaFilter(v as NormaFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Norma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las normas</SelectItem>
                {normaOptions.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Buscar por código o título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[220px]"
            />

            <Button variant="outline" size="sm" onClick={clearFilters}>
              <ListFilter className="size-4" />
              Limpiar filtros
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="cursor-pointer gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-accent"
              onClick={() => toast.success("Exportación PDF simulada realizada")}
            >
              <FileDown className="size-3.5" /> Exportar PDF
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-accent"
              onClick={() => toast.success("Exportación DOCX simulada realizada")}
            >
              <FileDown className="size-3.5" /> Exportar DOCX
            </Badge>
          </div>
        </div>

      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Norma</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Versión</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docList.map((d) => (
              <TableRow
                key={d.code}
                onClick={() => openInEditor(d.code)}
                className="cursor-pointer transition-colors"
              >
                <TableCell className="font-semibold">{d.code}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2">
                    {d.title}
                    {d.critico && (
                      <Badge variant="outline" className="border-status-danger/30 bg-status-danger/10 text-status-danger">
                        Crítico
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={docTypeBadgeClass[d.type]}>
                    {d.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.norma}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass(d.estado, d.vencido)}>
                    {statusLabel(d.estado, d.vencido)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.version}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Exportar a PDF"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success(`Exportando ${d.code}.pdf...`);
                      }}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <FileText className="size-[15px]" />
                    </button>
                    {d.estado === "En aprobación" && (
                      <button
                        type="button"
                        title="Aprobar"
                        onClick={(e) => {
                          e.stopPropagation();
                          openApprovalFlow(d.code);
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-status-valid transition-colors hover:bg-status-valid/10"
                      >
                        <CircleCheck className="size-[15px]" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {docList.length === 0 && !documentsQuery.isPending && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <h4 className="font-semibold text-foreground">Sin resultados</h4>
            <p className="max-w-sm text-sm text-muted-foreground">
              No encontramos ningún documento que coincida con la búsqueda o filtros aplicados.
            </p>
            <Button size="sm" onClick={clearFilters}>
              Restablecer filtros
            </Button>
          </div>
        )}
      </div>

      <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} initialMode={createMode} />
      <ApprovalFlowDialog open={approvalOpen} onOpenChange={setApprovalOpen} doc={approvalDoc} />
    </div>
  );
}
