import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

/**
 * 2FA PIN challenge — a **cosmetic simulation only**, by explicit product
 * decision: the backend has no TOTP secret and login is a single
 * email+password step. It used to gate the login flow on
 * `config.twoFactorEnabled`, but `GET /config` requires a token, so that value
 * cannot be read before authenticating; the gate was removed rather than
 * faked. Valid demo tokens remain "123456" / "654321" and the whole attempt
 * counter is local to this component — the REAL lockout lives on the server
 * (three failed logins → HTTP 423, see LockScreen.tsx).
 */
interface TwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  /** Called after the 3rd invalid token, mirroring the old lock behaviour. */
  onExhausted?: () => void;
}

const VALID_PINS = ["123456", "654321"];
const MAX_ATTEMPTS = 3;

export function TwoFactorDialog({
  open,
  onOpenChange,
  onVerified,
  onExhausted,
}: TwoFactorDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);

  function reset() {
    setPin("");
    setError("");
    setAttempts(0);
  }

  function handleCancel() {
    reset();
    onOpenChange(false);
    toast.warning("Inicio de sesión cancelado.");
  }

  function handleSubmit() {
    if (VALID_PINS.includes(pin.trim())) {
      toast.success("Token de seguridad 2FA verificado correctamente.");
      reset();
      onOpenChange(false);
      onVerified();
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (nextAttempts >= MAX_ATTEMPTS) {
      reset();
      onOpenChange(false);
      onExhausted?.();
      return;
    }

    const remaining = MAX_ATTEMPTS - nextAttempts;
    setError(`Token inválido. Te quedan ${remaining} intento${remaining === 1 ? "" : "s"} antes de bloquear la cuenta.`);
    setPin("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleCancel();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Verificación en dos pasos
          </DialogTitle>
          <DialogDescription>
            Ingresa el token de seguridad de 6 dígitos para confirmar el inicio de sesión.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <InputOTP
            maxLength={6}
            value={pin}
            onChange={setPin}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && pin.length === 6) handleSubmit();
            }}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-center text-xs font-medium text-destructive">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Demo: usa el token <span className="font-mono font-semibold">123456</span> o{" "}
            <span className="font-mono font-semibold">654321</span>.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={pin.length !== 6}>
            Verificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
