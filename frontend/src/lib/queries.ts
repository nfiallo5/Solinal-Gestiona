/**
 * react-query layer — the server-owned half of the app state.
 *
 * `AppStateContext`'s reducer keeps only local UI state (dialogs, drafts,
 * `activeDocCode`, the resolved session); everything that lives in Postgres
 * (`documents`, `templates`, `auditLogs`, `comments`, `users`, `config`) is
 * read through the hooks below and written through mutations that invalidate
 * the matching key.
 */
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  auditApi,
  authApi,
  codingRuleApi,
  configApi,
  documentFooterApi,
  documentHeaderApi,
  documentsApi,
  documentStructuresApi,
  documentTypesApi,
  getToken,
  processAreasApi,
  templatesApi,
  usersApi,
  workflowApi,
  type AuditFilters,
  type DocumentFilters,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  me: ["auth", "me"] as const,
  documents: (filters: DocumentFilters = {}) => ["documents", filters] as const,
  documentsAll: ["documents"] as const,
  document: (code: string) => ["document", code] as const,
  comments: (code: string) => ["comments", code] as const,
  regulationAlert: (code: string) => ["regulationAlert", code] as const,
  templates: ["templates"] as const,
  documentTypes: ["documentTypes"] as const,
  processAreas: ["processAreas"] as const,
  documentStructures: ["documentStructures"] as const,
  documentHeader: ["documentHeader"] as const,
  documentFooter: ["documentFooter"] as const,
  codingRule: ["codingRule"] as const,
  users: ["users"] as const,
  config: ["config"] as const,
  auditLogs: (filters: AuditFilters = {}) => ["auditLogs", filters] as const,
  auditLogsAll: ["auditLogs"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Never enabled without a token: `GET /auth/me` would just 401. */
export function useMeQuery() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => authApi.me(),
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useDocuments(filters: DocumentFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.documents(filters),
    queryFn: () => documentsApi.list(filters),
    enabled,
  });
}

export function useDocumentComments(code: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.comments(code ?? ""),
    queryFn: () => documentsApi.listComments(code as string),
    enabled: Boolean(code) && enabled,
  });
}

export function useRegulationAlert(code: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.regulationAlert(code ?? ""),
    queryFn: () => workflowApi.regulationAlert(code as string),
    enabled: Boolean(code) && enabled,
  });
}

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: () => templatesApi.list(),
    enabled,
  });
}

export function useDocumentTypes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.documentTypes,
    queryFn: () => documentTypesApi.list(),
    enabled,
  });
}

/** Control Documental's "Procesos y áreas" table — the source of Crear
 * Documento's "Área / Departamento" options and the `area` values
 * `POST /documents` accepts. */
export function useProcessAreas(enabled = true) {
  return useQuery({
    queryKey: queryKeys.processAreas,
    queryFn: () => processAreasApi.list(),
    enabled,
  });
}

/** Control Documental's "Estructuras documentales" tab — the recommended
 * section outline saved per document type. */
export function useDocumentStructures(enabled = true) {
  return useQuery({
    queryKey: queryKeys.documentStructures,
    queryFn: () => documentStructuresApi.list(),
    enabled,
  });
}

/** Control Documental's "Encabezado" tab — the saved header template and the
 * identification/description fields toggled on. */
export function useDocumentHeader(enabled = true) {
  return useQuery({
    queryKey: queryKeys.documentHeader,
    queryFn: () => documentHeaderApi.get(),
    enabled,
  });
}

/** Control Documental's "Pie de página" tab — the saved footer template and
 * content fields. */
export function useDocumentFooter(enabled = true) {
  return useQuery({
    queryKey: queryKeys.documentFooter,
    queryFn: () => documentFooterApi.get(),
    enabled,
  });
}

/** Control Documental's saved "Regla de codificación" — the same rule
 * `POST /documents` uses server-side, so a document-creation preview built
 * from this hook always matches the code the backend will actually assign. */
export function useCodingRule(enabled = true) {
  return useQuery({
    queryKey: queryKeys.codingRule,
    queryFn: () => codingRuleApi.get(),
    enabled,
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => usersApi.list(),
    enabled,
  });
}

export function useConfig(enabled = true) {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: () => configApi.get(),
    enabled,
  });
}

export function useAuditLogs(filters: AuditFilters = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.auditLogs(filters),
    queryFn: () => auditApi.list(filters),
    enabled,
  });
}

// ---------------------------------------------------------------------------
// Invalidation helpers
// ---------------------------------------------------------------------------

/**
 * Every mutation writes an audit row server-side, so the audit trail is
 * invalidated alongside whatever the action actually changed.
 */
export function invalidateAfterDocumentMutation(client: QueryClient, code?: string) {
  void client.invalidateQueries({ queryKey: queryKeys.documentsAll });
  void client.invalidateQueries({ queryKey: queryKeys.auditLogsAll });
  if (code) {
    void client.invalidateQueries({ queryKey: queryKeys.document(code) });
    void client.invalidateQueries({ queryKey: queryKeys.regulationAlert(code) });
  }
}

export function useDocumentInvalidator() {
  const client = useQueryClient();
  return (code?: string) => invalidateAfterDocumentMutation(client, code);
}

/** Drops every cached server response — used on logout / user switch. */
export function resetServerState(client: QueryClient) {
  client.clear();
}
