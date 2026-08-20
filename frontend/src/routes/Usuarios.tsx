import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/context/AppStateContext";
import type { RoleName } from "@/data/seed";
import { roleMeta } from "@/data/seed";
import { usersApi, type ApiUser } from "@/lib/api";
import { queryKeys, useUsers } from "@/lib/queries";
import { RoleCard } from "@/features/users/RoleCard";
import { NewUserDialog } from "@/features/users/NewUserDialog";

/**
 * Port of legacy pg-users: role summary cards + Kanban board
 * (reference/legacy_vanilla/js/users.js renderKanban()), merged into a
 * single grid of role cards — each card already lists its description,
 * assigned people, and an "+Agregar" action, so the separate static
 * info-card row from the legacy markup is folded into this same grid.
 */
export default function Usuarios() {
  const { state, dispatch } = useAppState();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultRole, setDefaultRole] = useState<RoleName>("Elaborador");

  const users = useUsers().data ?? [];

  // Only Administrador may reassign roles or register new users — creating a
  // user also assigns its initial role (see NewUserDialog), so both actions
  // share the same gate.
  const canManage = state.session.activeRole === "Administrador";

  function openDialogFor(role: RoleName) {
    if (!canManage) return;
    setDefaultRole(role);
    setDialogOpen(true);
  }

  // `PATCH /users/:id/role` keys on the **uuid** (the old reducer keyed on the
  // display name) and answers `isSelf`, which replaces the name comparison the
  // reducer used to do when the edited user was the logged-in one.
  const roleMutation = useMutation({
    mutationFn: (input: { user: ApiUser; role: RoleName }) =>
      usersApi.updateRole(input.user.id, input.role),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogsAll });
      if (result.isSelf) {
        dispatch({ type: "SET_ACTIVE_ROLE", payload: { role: result.user.role } });
      }
      toast.success(`Usuario ${result.user.name} movido a ${result.user.role}`);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el rol.");
    },
  });

  function handleRoleChange(user: ApiUser, role: RoleName) {
    if (!canManage) {
      // The server also refuses (and audits) the attempt; this keeps the
      // immediate feedback the UI already gave.
      toast.error("Solo un Administrador puede reasignar roles.");
      return;
    }
    roleMutation.mutate({ user, role });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Usuarios y Roles Organizacionales
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Control de accesos y flujo documental. Reasigna el rol de cada persona desde su tarjeta para aplicar el cambio de inmediato."
              : "Control de accesos y flujo documental. Solo un Administrador puede reasignar roles o registrar nuevos usuarios."}
          </p>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={() => openDialogFor("Elaborador")}>
            <UserPlus className="size-4" />
            Nuevo usuario
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roleMeta.map((meta) => (
          <RoleCard
            key={meta.role}
            meta={meta}
            users={users.filter((u) => u.role === meta.role)}
            canManage={canManage}
            onAddClick={() => openDialogFor(meta.role)}
            onRoleChange={handleRoleChange}
          />
        ))}
      </div>

      <NewUserDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultRole={defaultRole} />
    </div>
  );
}
