import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoleMeta, RoleName } from "@/data/seed";
import type { ApiUser } from "@/lib/api";
import { roleTheme, roleOrder, initialsOf } from "./roleTheme";

/**
 * One role "column" from the legacy Kanban board (js/users.js
 * renderKanban()), rebuilt as a card. Drag-and-drop is simplified to an
 * inline role-select per user (see Usuarios.tsx for the rationale) — which
 * now calls `PATCH /users/:id/role`. Note the callback hands back the whole
 * user, because that route keys on the **uuid**, not the display name.
 */
export function RoleCard({
  meta,
  users,
  canManage,
  onAddClick,
  onRoleChange,
}: {
  meta: RoleMeta;
  users: ApiUser[];
  canManage: boolean;
  onAddClick: () => void;
  onRoleChange: (user: ApiUser, role: RoleName) => void;
}) {
  const theme = roleTheme[meta.role];
  const Icon = theme.icon;

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${theme.badge}`}>
            <Icon className="size-4" />
            {meta.role}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {users.length} {users.length === 1 ? "persona" : "personas"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 pt-0">
        {users.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Sin usuarios asignados
          </div>
        )}

        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 p-2 transition-colors hover:bg-muted"
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className={`${theme.solid} text-[11px] font-bold`}>
                {u.short || initialsOf(u.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{u.name}</div>
              {u.notes && (
                <div className="truncate text-[11px] text-muted-foreground">{u.notes}</div>
              )}
            </div>

            {canManage ? (
              <Select value={u.role} onValueChange={(v) => onRoleChange(u, v as RoleName)}>
                <SelectTrigger className="h-7 w-[118px] shrink-0 bg-background text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOrder.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ))}

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 gap-1.5 border-dashed"
            onClick={onAddClick}
          >
            <UserPlus className="size-3.5" />
            Agregar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
