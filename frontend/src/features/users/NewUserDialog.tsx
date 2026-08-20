import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppState } from "@/context/AppStateContext";
import type { RoleName } from "@/data/seed";
import { usersApi, type CreateUserInput } from "@/lib/api";
import { queryKeys, useUsers } from "@/lib/queries";
import { roleOrder } from "./roleTheme";

const statusOptions = ["Activo", "Invitado", "Inactivo"] as const;

/**
 * Port of the legacy "newUserModal" (SolinalGestiona_MVP.html) +
 * js/users.js saveNewUser(), now backed by `POST /users` (admin-only,
 * audited server-side).
 *
 * The dialog never collected a password, so none is sent: the API then mints a
 * random temporary one and returns it **once**, in the 201 body. It is never
 * stored in plaintext and never retrievable again, so it is surfaced here for
 * the administrator to hand over out of band.
 */
export function NewUserDialog({
  open,
  onOpenChange,
  defaultRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole: RoleName;
}) {
  const { state } = useAppState();
  const queryClient = useQueryClient();
  const existingUsers = useUsers().data ?? [];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>(defaultRole);
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("Activo");
  const [notes, setNotes] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  useEffect(() => {
    if (open) setRole(defaultRole);
  }, [open, defaultRole]);

  function reset() {
    setName("");
    setEmail("");
    setStatus("Activo");
    setNotes("");
    setTemporaryPassword(null);
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogsAll });
      toast.success(`Usuario ${result.user.name} registrado con rol ${result.user.role}.`);
      if (result.temporaryPassword) {
        // Shown once — the server never returns it again and never stores it
        // in plaintext, so it has to reach the admin now or not at all.
        setTemporaryPassword(result.temporaryPassword);
      } else {
        reset();
        onOpenChange(false);
      }
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el usuario.");
    },
  });

  function handleSave() {
    if (state.session.activeRole !== "Administrador") {
      toast.error("Solo un Administrador puede registrar nuevos usuarios.");
      onOpenChange(false);
      return;
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      toast.error("Por favor, ingresa el nombre y correo del usuario.");
      return;
    }
    if (existingUsers.some((u) => u.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error("Ya existe un usuario registrado con ese nombre.");
      return;
    }

    createMutation.mutate({
      name: trimmedName,
      email: trimmedEmail,
      role,
      status,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar nuevo usuario</DialogTitle>
          <DialogDescription>
            Se le asignará un rol organizacional con permisos predefinidos.
          </DialogDescription>
        </DialogHeader>

        {temporaryPassword && (
          <div className="rounded-lg border-l-4 border-secondary bg-muted p-3 text-xs">
            <strong className="block text-foreground">Contraseña temporal generada</strong>
            <p className="mt-1 text-muted-foreground">
              Entrégasela al usuario: no se almacena en texto plano y no podrá consultarse de
              nuevo.
            </p>
            <code className="mt-2 block select-all rounded bg-background px-2 py-1 font-mono text-sm font-bold text-foreground">
              {temporaryPassword}
            </code>
          </div>
        )}

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="newUserName">Nombre completo</Label>
              <Input
                id="newUserName"
                placeholder="Ej. Ana Torres"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="newUserEmail">Correo electrónico</Label>
              <Input
                id="newUserEmail"
                type="email"
                placeholder="ana@solinal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Rol asignado</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleName)}>
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOrder.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as (typeof statusOptions)[number])}
              >
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="newUserNotes">Notas / Ubicación / Normas a cargo</Label>
            <Textarea
              id="newUserNotes"
              placeholder="Planta Central, Auditor interno..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-muted"
            />
          </div>
        </div>

        <DialogFooter>
          {temporaryPassword ? (
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Listo
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={createMutation.isPending}>
                Guardar usuario
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
