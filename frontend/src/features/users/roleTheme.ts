import { Crown, Pencil, Search, ShieldCheck, Eye, type LucideIcon } from "lucide-react";
import type { RoleName } from "@/data/seed";

/**
 * Visual language for the 5 legacy roles (js/users.js renderKanban()).
 *
 * The design system only ships 4 document-type tag colors (sanitary,
 * permit, lab, technical) plus the 3 status colors — there is no 5th
 * "tag" color reserved for roles. We reuse those existing tokens (instead
 * of inventing new CSS variables, which is out of scope for this feature
 * folder) so roles are still visually distinguishable the same way
 * document types are:
 *   Administrador -> tag-technical (control / systemic)
 *   Elaborador    -> tag-permit (creation / draft)
 *   Revisor       -> tag-lab (analysis / review)
 *   Aprobador     -> status-valid (approval reads as "green light")
 *   Lector        -> secondary (neutral, read-only)
 */
export interface RoleTheme {
  icon: LucideIcon;
  /** border + bg + text classes for badges/chips */
  badge: string;
  /** solid background, used for avatars / small dots */
  solid: string;
}

export const roleTheme: Record<RoleName, RoleTheme> = {
  Administrador: {
    icon: Crown,
    badge: "border-tag-technical/30 bg-tag-technical-bg text-tag-technical",
    solid: "bg-tag-technical text-white",
  },
  Elaborador: {
    icon: Pencil,
    badge: "border-tag-permit/30 bg-tag-permit-bg text-tag-permit",
    solid: "bg-tag-permit text-white",
  },
  Revisor: {
    icon: Search,
    badge: "border-tag-lab/30 bg-tag-lab-bg text-tag-lab",
    solid: "bg-tag-lab text-white",
  },
  Aprobador: {
    icon: ShieldCheck,
    badge: "border-status-valid/30 bg-status-valid/10 text-status-valid",
    solid: "bg-status-valid text-white",
  },
  Lector: {
    icon: Eye,
    badge: "border-secondary/30 bg-secondary/10 text-secondary",
    solid: "bg-secondary text-secondary-foreground",
  },
};

export const roleOrder: RoleName[] = [
  "Administrador",
  "Elaborador",
  "Revisor",
  "Aprobador",
  "Lector",
];

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
