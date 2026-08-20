import type { AuditLogEntry } from "@/data/seed";

/**
 * Port of js/audit.js exportAuditCSV(), using a Blob download instead of a
 * `data:` URI (same visible behavior, avoids URL-length limits).
 */
export function exportAuditCsv(logs: AuditLogEntry[]) {
  const header = "ID,Accion Registrada,Usuario,Rol,Fecha,Hora,IP";
  const rows = logs.map((l) =>
    [
      l.id,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.user}"`,
      `"${l.role}"`,
      `"${l.date}"`,
      `"${l.time}"`,
      `"${l.ip}"`,
    ].join(","),
  );
  const csvContent = [header, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `solinal_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
