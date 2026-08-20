import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { TaskTone } from "./roleTasks";

const toneClasses: Record<TaskTone, string> = {
  borrador: "border-secondary/25 bg-secondary/10 text-secondary",
  revision: "border-status-warning/40 bg-status-warning/20 text-amber-800",
  aprobacion: "border-status-valid/35 bg-status-valid/15 text-emerald-700",
  vigente: "border-status-valid/35 bg-status-valid/15 text-emerald-700",
  rechazado: "border-status-danger/30 bg-status-danger/10 text-status-danger",
};

export function TaskBadge({
  tone,
  children,
}: {
  tone: TaskTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}
