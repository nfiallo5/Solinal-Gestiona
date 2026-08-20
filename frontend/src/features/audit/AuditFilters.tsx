import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoleName } from "@/data/seed";
import { roleOrder } from "@/features/users/roleTheme";

export interface AuditFilterState {
  user: string;
  doc: string;
  role: string;
}

export const defaultAuditFilters: AuditFilterState = { user: "all", doc: "all", role: "all" };

/**
 * Port of js/audit.js populateAuditFilters()/applyAuditFilters()/
 * clearAuditFilters(). Adds a role filter on top of the legacy
 * user/document filters — a small enhancement enabled by the new
 * role-color badges (see roleTheme.ts).
 */
export function AuditFilters({
  users,
  docCodes,
  value,
  onChange,
  onClear,
}: {
  users: string[];
  docCodes: string[];
  value: AuditFilterState;
  onChange: (next: AuditFilterState) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={value.user} onValueChange={(v) => onChange({ ...value, user: v })}>
        <SelectTrigger className="w-[190px] bg-muted">
          <SelectValue placeholder="Usuario" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los usuarios</SelectItem>
          {users.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.doc} onValueChange={(v) => onChange({ ...value, doc: v })}>
        <SelectTrigger className="w-[190px] bg-muted">
          <SelectValue placeholder="Documento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los documentos</SelectItem>
          {docCodes.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.role} onValueChange={(v) => onChange({ ...value, role: v })}>
        <SelectTrigger className="w-[170px] bg-muted">
          <SelectValue placeholder="Rol" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los roles</SelectItem>
          {roleOrder.map((r: RoleName) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={onClear}>
        <FilterX className="size-3.5" />
        Limpiar filtros
      </Button>
    </div>
  );
}
