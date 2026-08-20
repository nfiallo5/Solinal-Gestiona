import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { useAppState } from "@/context/AppStateContext";
import type { RoleName } from "@/data/seed";
import {
  authApi,
  lockoutDetailsOf,
  remainingAttemptsOf,
  type LoginResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockScreen } from "@/components/layout/LockScreen";
import logoIcon from "@/assets/logo-icon.png";
import logoWordmark from "@/assets/logo-gestiona-blanco.svg";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.26A11.99 11.99 0 0 0 0 12c0 1.94.47 3.77 1.26 5.38z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.26 6.62l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The 5 seeded demo accounts. These used to live in
 * `src/features/auth/credentials.ts` together with a client-side
 * `findCredential()` check; that module is gone — authentication is now
 * `POST /auth/login` against the API. What remains here is purely the
 * convenience list behind the quick-login buttons: each one just prefills the
 * real form and submits it, so the credentials still travel the normal path.
 */
interface DemoAccount {
  email: string;
  password: string;
  user: string;
  role: RoleName;
}

const demoAccounts: DemoAccount[] = [
  { email: "admin@solinal.com", password: "admin2026", user: "Erick Murillo", role: "Administrador" },
  { email: "elaborador@solinal.com", password: "elaborador2026", user: "Nicolas Fiallo", role: "Elaborador" },
  { email: "revisor@solinal.com", password: "revisor2026", user: "Ana Torres", role: "Revisor" },
  { email: "aprobador@solinal.com", password: "aprobador2026", user: "Carlos Ruiz", role: "Aprobador" },
  { email: "lector@solinal.com", password: "lector2026", user: "Lector Simulado", role: "Lector" },
];

/** Standalone login screen — the app's entry point. */
export default function LoginPage() {
  const { state, signIn } = useAppState();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const loginMutation = useMutation({
    mutationFn: (input: { email: string; password: string; method: string }) =>
      authApi.login(input),
    onSuccess: (result: LoginResult) => {
      signIn(result.token, result.user);
      toast.success(`Bienvenido, ${result.user.name}.`);
      navigate("/", { replace: true });
    },
    onError: (error: unknown) => {
      const lockout = lockoutDetailsOf(error);
      if (lockout) {
        setLockedSeconds(lockout.retryAfterSeconds);
        setIsLocked(true);
        toast.error(error instanceof Error ? error.message : "Cuenta bloqueada.");
        return;
      }
      const remaining = remainingAttemptsOf(error);
      const base =
        error instanceof Error
          ? error.message
          : "Credenciales inválidas. Verifica el correo y la contraseña, o elige un usuario de prueba.";
      toast.error(
        remaining !== null
          ? `${base} Te queda${remaining === 1 ? "" : "n"} ${remaining} intento${remaining === 1 ? "" : "s"}.`
          : base,
      );
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) => authApi.register(input),
    onSuccess: (result: LoginResult) => {
      signIn(result.token, result.user);
      toast.success(`Cuenta creada. Bienvenido, ${result.user.name}.`);
      navigate("/", { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la cuenta.");
    },
  });

  if (state.session.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  function submitCredentials(nextEmail: string, nextPassword: string, method: string) {
    if (!nextEmail.trim() || !nextPassword.trim()) {
      toast.error("Ingresa tu correo y contraseña para continuar.");
      return;
    }
    loginMutation.mutate({ email: nextEmail.trim(), password: nextPassword, method });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register") {
      if (!email.trim() || !password) {
        toast.error("Ingresa tu correo y contraseña para continuar.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Las contraseñas no coinciden.");
        return;
      }
      registerMutation.mutate({ email: email.trim(), password });
      return;
    }
    submitCredentials(email, password, "credenciales");
  }

  /** Quick-login: prefill the real form, then submit it exactly as a human would. */
  function handleQuickLogin(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    submitCredentials(account.email, account.password, "acceso rápido");
  }

  function toggleMode() {
    setMode((m) => (m === "login" ? "register" : "login"));
    setPassword("");
    setConfirmPassword("");
  }

  function handleUnavailable(label: string) {
    toast.info(`${label}: función simulada, no disponible en este MVP.`);
  }

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      {/* Left — brand / pitch panel */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-background px-12 py-16 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40"
        />
        <div className="relative flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="size-9 object-contain" />
            <span className="text-2xl font-bold tracking-tight text-foreground">
              Solinal<span className="text-primary">.</span> Gestiona
            </span>
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
            Gestión documental, lista para auditar.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cada procedimiento, política y manual en un solo lugar. Control de versiones
            automático, flujo de aprobación por roles y trazabilidad completa para tus
            auditorías.
          </p>
        </div>
      </div>

      {/* Right — auth panel */}
      <div className="flex flex-col justify-center bg-navy px-6 py-16 text-navy-foreground sm:px-12 lg:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-7">
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <img src={logoWordmark} alt="Solinal. Gestiona AI" className="h-10 w-auto object-contain" />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {mode === "login" ? "Acceso" : "Nueva cuenta"}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {mode === "login" ? "Iniciar sesión." : "Crear cuenta."}
            </h2>
            <p className="mt-1 text-sm text-navy-foreground/60">
              {mode === "login"
                ? "Ingresa con tu cuenta para continuar."
                : "Solo necesitas un correo y una contraseña."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email" className="text-navy-foreground/80">
                E-mail
              </Label>
              <Input
                id="login-email"
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-white/15 bg-white/5 text-navy-foreground placeholder:text-navy-foreground/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password" className="text-navy-foreground/80">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-white/15 bg-white/5 pr-10 text-navy-foreground placeholder:text-navy-foreground/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-foreground/50 hover:text-navy-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-confirm-password" className="text-navy-foreground/80">
                  Confirmar contraseña
                </Label>
                <Input
                  id="login-confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-white/15 bg-white/5 text-navy-foreground placeholder:text-navy-foreground/40"
                />
              </div>
            )}

            <Button type="submit" size="lg" className="mt-1 font-bold" disabled={isPending}>
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </form>

          <p className="text-center text-sm text-navy-foreground/60">
            {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>

          {mode === "login" && (
          <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-center text-xs text-navy-foreground/50">
              Demo — un usuario de prueba dedicado por cada rol. Un clic inicia sesión.
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleQuickLogin(account)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/10 disabled:opacity-60"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {initialsOf(account.user)}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-xs font-semibold">{account.role}</span>
                    <span className="block truncate text-[11px] text-navy-foreground/50">
                      {account.user} · {account.email}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

        </div>
      </div>

      {isLocked && (
        <LockScreen
          retryAfterSeconds={lockedSeconds}
          onDismiss={() => {
            setIsLocked(false);
            setLockedSeconds(null);
          }}
        />
      )}
    </div>
  );
}
