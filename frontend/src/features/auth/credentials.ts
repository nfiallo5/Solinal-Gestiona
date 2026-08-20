import type { RoleName } from "@/data/seed";

/**
 * Simulated per-role credentials — this is a static MVP with no real backend,
 * so each of the 5 roles gets its own dedicated demo login instead of the
 * old "cycle role" button. `user` must match a `name` in seedUsers.
 */
export interface DemoCredential {
  email: string;
  password: string;
  user: string;
  role: RoleName;
}

export const demoCredentials: DemoCredential[] = [
  { email: "admin@solinal.com", password: "admin2026", user: "Erick Murillo", role: "Administrador" },
  { email: "elaborador@solinal.com", password: "elaborador2026", user: "Nicolas Fiallo", role: "Elaborador" },
  { email: "revisor@solinal.com", password: "revisor2026", user: "Ana Torres", role: "Revisor" },
  { email: "aprobador@solinal.com", password: "aprobador2026", user: "Carlos Ruiz", role: "Aprobador" },
  { email: "lector@solinal.com", password: "lector2026", user: "Lector Simulado", role: "Lector" },
];

export function findCredential(email: string, password: string): DemoCredential | undefined {
  const normalized = email.trim().toLowerCase();
  return demoCredentials.find(
    (c) => c.email.toLowerCase() === normalized && c.password === password,
  );
}
