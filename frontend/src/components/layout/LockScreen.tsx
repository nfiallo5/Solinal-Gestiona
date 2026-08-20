import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-screen lock overlay. It used to be driven by a client-side counter
 * (`session.failedAttempts`, reset by a page reload) and "unlocked" by a fake
 * button. The lockout is now enforced by the API: three consecutive failed
 * logins set `User.lockedAt`, every affected request answers **423**, and the
 * lock lifts by itself after the server's window or when an administrator
 * calls `POST /users/:id/unlock`. This component only reports that state.
 */
export function LockScreen({
  retryAfterSeconds,
  onDismiss,
}: {
  /** From the 423 body (`details.retryAfterSeconds`), when the server sent it. */
  retryAfterSeconds?: number | null;
  onDismiss?: () => void;
}) {
  const minutes =
    typeof retryAfterSeconds === "number" && retryAfterSeconds > 0
      ? Math.ceil(retryAfterSeconds / 60)
      : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-navy/95 px-6 text-center text-navy-foreground backdrop-blur-sm">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/20">
        <Lock className="size-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Cuenta bloqueada</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-navy-foreground/70">
          Se superó el número máximo de intentos de inicio de sesión. El acceso ha sido
          bloqueado por seguridad según las políticas del sistema.
          {minutes !== null
            ? ` Se desbloquea automáticamente en ${minutes} min, o antes si un administrador lo libera.`
            : " Contacta a un administrador para desbloquear la cuenta."}
        </p>
      </div>
      {onDismiss && (
        <Button onClick={onDismiss} className="mt-2">
          Volver al inicio de sesión
        </Button>
      )}
    </div>
  );
}
