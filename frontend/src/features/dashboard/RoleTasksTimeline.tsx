import { Clock, ListChecks, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RoleName } from "@/data/seed";
import { roleTasksByRole } from "./roleTasks";
import { TaskBadge } from "./TaskBadge";

/**
 * Port of legacy "Tareas de Rol" timeline + "Limpiar tareas" toggle
 * (window.toggleClearTasks / #dash-tasks-container). The cleared/loaded
 * flag is page-local UI state, same as the legacy module-scoped
 * `areDashboardTasksCleared` variable — no global state needed.
 */
export function RoleTasksTimeline({
  role,
  cleared,
  onToggleCleared,
}: {
  role: RoleName;
  cleared: boolean;
  onToggleCleared: () => void;
}) {
  const tasks = cleared ? [] : roleTasksByRole[role];

  return (
    <Card className="animate-in fade-in duration-500">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-secondary" />
          Tareas de rol:{" "}
          <span className="text-secondary">{role}</span>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={onToggleCleared}>
          {cleared ? (
            <>
              <RotateCcw className="size-3.5" /> Cargar tareas
            </>
          ) : (
            <>
              <ListChecks className="size-3.5" /> Limpiar tareas
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
            <ListChecks className="size-6 text-status-valid" />
            <h4 className="text-sm font-bold text-foreground">
              Sin actividad pendiente
            </h4>
            <p className="max-w-[260px] text-xs text-muted-foreground">
              ¡Excelente! No tienes tareas prioritarias asignadas para tu rol
              de {role}. Todo al día.
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.title}
              className="rounded-lg border-l-2 border-primary/50 bg-muted/30 px-3.5 py-3 transition-colors hover:bg-muted/60"
            >
              <strong className="text-sm font-bold text-foreground">
                {task.title}
              </strong>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {task.desc}
              </p>
              <div className="mt-2">
                <TaskBadge tone={task.tone}>{task.badge}</TaskBadge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
