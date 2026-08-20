import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLogEntry } from "@/data/seed";
import { roleTheme } from "@/features/users/roleTheme";

/** Port of js/audit.js renderAuditTrail() — dense, read-only log table. */
export function AuditLogTable({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-16">ID</TableHead>
          <TableHead>Acción registrada</TableHead>
          <TableHead className="w-40">Usuario</TableHead>
          <TableHead className="w-36">Rol</TableHead>
          <TableHead className="w-40">Fecha y hora</TableHead>
          <TableHead className="w-36">Dirección IP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
              No hay registros de auditoría para los filtros seleccionados.
            </TableCell>
          </TableRow>
        )}
        {logs.map((l) => {
          const theme = roleTheme[l.role];
          const Icon = theme.icon;
          return (
            <TableRow key={l.id}>
              <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                #{l.id}
              </TableCell>
              <TableCell className="text-sm text-foreground">{l.action}</TableCell>
              <TableCell className="text-sm">{l.user}</TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${theme.badge}`}
                >
                  <Icon className="size-3" />
                  {l.role}
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {l.date} · {l.time}
              </TableCell>
              <TableCell>
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {l.ip}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
