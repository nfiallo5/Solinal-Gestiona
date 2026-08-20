import type { ComplianceStatus } from "./useCompliance";

/** Shared Tailwind class fragments per compliance status, using the
 * status-valid / status-warning / status-danger tokens from styles.css. */
export const statusText: Record<ComplianceStatus, string> = {
  valid: "text-status-valid",
  warning: "text-status-warning",
  danger: "text-status-danger",
};

export const statusBg: Record<ComplianceStatus, string> = {
  valid: "bg-status-valid",
  warning: "bg-status-warning",
  danger: "bg-status-danger",
};

export const statusSoftBg: Record<ComplianceStatus, string> = {
  valid: "bg-status-valid/10",
  warning: "bg-status-warning/10",
  danger: "bg-status-danger/10",
};

export const statusBorder: Record<ComplianceStatus, string> = {
  valid: "border-status-valid/30",
  warning: "border-status-warning/30",
  danger: "border-status-danger/30",
};

export const statusLabel: Record<ComplianceStatus, string> = {
  valid: "Cubierto",
  warning: "Atención",
  danger: "Huérfano",
};
