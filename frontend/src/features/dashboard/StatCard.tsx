import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  meta: ReactNode;
  valueClassName?: string;
  onClick?: () => void;
  className?: string;
}

/** Port of legacy `.stat-card` (SolinalGestiona_MVP.html status-grid). */
export function StatCard({
  label,
  value,
  meta,
  valueClassName,
  onClick,
  className,
}: StatCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-4 text-left transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/70 hover:shadow-sm",
        className,
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-3xl font-extrabold leading-none", valueClassName)}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{meta}</span>
    </Comp>
  );
}
