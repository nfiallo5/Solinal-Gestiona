/**
 * Thin typed client for the Solinal Gestiona REST API (backend/).
 *
 * Responsibilities kept in this one module:
 *   1. Base URL resolution (`VITE_API_URL`, defaulting to the dev API port).
 *   2. Bearer-token plumbing against `localStorage`.
 *   3. Turning the uniform error envelope `{ error: { message, code, details } }`
 *      into a typed `ApiError` carrying `status` / `code` / `details`.
 *   4. Normalising the deliberately NON-uniform success envelopes
 *      (`{token,user}` / `{user}` / bare DTO / `{document,message}`) so callers
 *      always receive clean data.
 *   5. Mapping the API's `null`s back to the `undefined`s that
 *      `src/data/seed.ts`'s interfaces use, so every existing component keeps
 *      type-checking untouched.
 */
import type {
  AppUser,
  AuditLogEntry,
  DocumentComment,
  DocumentStatus,
  DocumentTemplate,
  DocumentType,
  OrgConfig,
  RoleName,
  SolinalDocument,
  TemplateLevel,
  TemplateSection,
} from "@/data/seed";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * In dev the default is the same-origin `/api` prefix that `vite.config.ts`
 * proxies to the API, so no CORS negotiation is involved whatever port Vite
 * ends up on. `VITE_API_URL` overrides it (and also retargets the proxy); a
 * production build with no override talks to the local API directly.
 */
const RAW_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "/api" : "http://localhost:3001");

/** Base URL (or same-origin prefix) of the API, without a trailing slash. */
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

const TOKEN_KEY = "solinal-gestiona:token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage unavailable (private mode / quota) — the session simply
    // won't survive a reload.
  }
}

/**
 * Fired when an authenticated request comes back 401 (expired/invalid token) or
 * 423 (the account got locked while the session was live). `AppStateProvider`
 * listens and drops the local session.
 */
export const SESSION_EXPIRED_EVENT = "solinal:session-expired";
export const ACCOUNT_LOCKED_EVENT = "solinal:account-locked";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** `PATCH /documents/:code` and `POST /documents/:code/merge` share this shape. */
export interface ContentConflictDetails {
  code: string;
  clientContentVersion: number;
  serverContentVersion: number;
  /** The rejected draft — MergeDialog's left pane. `null` on a merge re-conflict. */
  clientContent: string | null;
  /** What is stored right now — MergeDialog's right pane. */
  serverContent: string;
  serverUpdatedAt: string;
}

export function isContentConflict(
  error: unknown,
): error is ApiError & { details: ContentConflictDetails } {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === "CONTENT_VERSION_CONFLICT" &&
    typeof error.details === "object" &&
    error.details !== null
  );
}

/** 423 details from `POST /auth/login` when the account is locked out. */
export interface LockoutDetails {
  lockedAt: string | null;
  retryAfterSeconds: number;
}

export function lockoutDetailsOf(error: unknown): LockoutDetails | null {
  if (!(error instanceof ApiError) || error.status !== 423) return null;
  const d = error.details as Partial<LockoutDetails> | undefined;
  if (!d || typeof d.retryAfterSeconds !== "number") return null;
  return { lockedAt: d.lockedAt ?? null, retryAfterSeconds: d.retryAfterSeconds };
}

/** 401 details from a failed login: how many tries are left before the lock. */
export function remainingAttemptsOf(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 401) return null;
  const d = error.details as { remainingAttempts?: unknown } | undefined;
  return typeof d?.remainingAttempts === "number" ? d.remainingAttempts : null;
}

// ---------------------------------------------------------------------------
// Fetch wrapper
// ---------------------------------------------------------------------------

/** Query-string source object. Interfaces (which have no index signature) are
 * accepted, so the filter types below can be passed straight through. */
export type QueryParams = object;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: QueryParams;
  /** Skip the global 401/423 session teardown (used by the login call). */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: QueryParams): string {
  // The second argument makes a relative `API_BASE` (the dev proxy prefix)
  // resolve against the page's own origin.
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, anonymous = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(
      0,
      "No se pudo conectar con el servidor. Verifica que la API esté en ejecución.",
      "NETWORK_ERROR",
      cause,
    );
  }

  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  let payload: unknown = undefined;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const envelope = payload as
      | { error?: { message?: string; code?: string; details?: unknown } }
      | undefined;
    const error = new ApiError(
      response.status,
      envelope?.error?.message ?? `Error ${response.status} en ${method} ${path}`,
      envelope?.error?.code,
      envelope?.error?.details,
    );

    if (!anonymous && response.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    if (!anonymous && response.status === 423 && error.code === "LOCKED") {
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_LOCKED_EVENT, { detail: lockoutDetailsOf(error) }),
      );
    }

    throw error;
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Wire shapes (supersets of the seed.ts interfaces) + normalisation
// ---------------------------------------------------------------------------

/** `DocumentDTO` — `SolinalDocument` plus the fields the backend added. */
export interface ApiDocument extends SolinalDocument {
  /** Per-document replacement for the old global `session.isSectionLocked`. */
  sectionLocked: boolean;
  /** Optimistic-concurrency token; echo it back on a content PATCH. */
  contentVersion: number;
  creadorId: string;
  createdAt: string;
  updatedAt: string;
}

/** `UserDTO` — `AppUser` plus the identity fields the API keys on. */
export interface ApiUser extends AppUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface RegulationAlert {
  id: number;
  norma: string;
  marker: string;
  bodyHtml: string;
  active: boolean;
  createdAt: string;
}

/** Every workflow action answers this envelope. */
export interface WorkflowResult {
  document: ApiDocument;
  /** The exact `toast.*()` string of the branch that ran — use it verbatim. */
  message: string;
}

type RawDocument = Omit<ApiDocument, "nivel" | "rolesRequeridos"> & {
  nivel: TemplateLevel | null;
  rolesRequeridos: SolinalDocument["rolesRequeridos"] | null;
};

/** `null` -> `undefined`, so `SolinalDocument`'s optional fields still fit. */
function normalizeDocument(raw: RawDocument): ApiDocument {
  return {
    ...raw,
    nivel: raw.nivel ?? undefined,
    rolesRequeridos: raw.rolesRequeridos ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginResult {
  token: string;
  user: ApiUser;
}

export const authApi = {
  /** `{ token, user }`. 401 carries `details.remainingAttempts`, 423 the lockout. */
  async login(input: {
    email: string;
    password: string;
    method?: string;
  }): Promise<LoginResult> {
    return request<LoginResult>("/auth/login", {
      method: "POST",
      body: input,
      anonymous: true,
    });
  },

  /**
   * Public self-service signup: just an email and a password. The server
   * derives a display name and defaults the role to `Lector`. Responds like
   * `login()` so the caller can sign the new account straight in.
   */
  async register(input: { email: string; password: string }): Promise<LoginResult> {
    return request<LoginResult>("/auth/register", {
      method: "POST",
      body: input,
      anonymous: true,
    });
  },

  /** Session rehydration on page load — unwraps `{ user }`. */
  async me(): Promise<ApiUser> {
    const data = await request<{ user: ApiUser }>("/auth/me");
    return data.user;
  },

  /** Audited server-side no-op; the client just drops the token afterwards. */
  async logout(): Promise<void> {
    await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
  },
};

// ---------------------------------------------------------------------------
// Users & config
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  name: string;
  email: string;
  role: RoleName;
  status?: string;
  notes?: string;
  password?: string;
}

export interface CreateUserResult {
  user: ApiUser;
  /** Returned ONCE when no password was supplied. Never retrievable again. */
  temporaryPassword?: string;
}

export const usersApi = {
  list: () => request<ApiUser[]>("/users"),

  create: (input: CreateUserInput) =>
    request<CreateUserResult>("/users", { method: "POST", body: input }),

  /** Keys on the user's **uuid**. `isSelf` tells you to update the session role. */
  updateRole: (id: string, role: RoleName) =>
    request<{ user: ApiUser; isSelf: boolean }>(`/users/${id}/role`, {
      method: "PATCH",
      body: { role },
    }),

  unlock: (id: string) =>
    request<{ user: ApiUser; unlocked: boolean }>(`/users/${id}/unlock`, {
      method: "POST",
    }),
};

export const configApi = {
  get: () => request<OrgConfig>("/config"),
  patch: (changes: Partial<OrgConfig>) =>
    request<OrgConfig>("/config", { method: "PATCH", body: changes }),
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** `estado` also accepts the pseudo-status `"Vencido"` (means `vencido === true`). */
export interface DocumentFilters {
  estado?: DocumentStatus | "Vencido";
  type?: DocumentType;
  norma?: string;
  vencido?: boolean;
  critico?: boolean;
  search?: string;
}

export interface CreateDocumentInput {
  templateKey?: string | null;
  title: string;
  type: DocumentType;
  /** 3-letter department code — the middle segment of the control code. */
  area: string;
  norma: string;
  description?: string;
  critico?: boolean;
}

export interface PatchDocumentInput {
  title?: string;
  content?: string;
  contentVersion?: number;
  estado?: DocumentStatus;
  version?: string;
  vencido?: boolean;
  critico?: boolean;
}

export const documentsApi = {
  async list(filters: DocumentFilters = {}): Promise<ApiDocument[]> {
    const rows = await request<RawDocument[]>("/documents", { query: filters });
    return rows.map(normalizeDocument);
  },

  async get(code: string): Promise<ApiDocument> {
    return normalizeDocument(
      await request<RawDocument>(`/documents/${encodeURIComponent(code)}`),
    );
  },

  async create(input: CreateDocumentInput): Promise<ApiDocument> {
    return normalizeDocument(
      await request<RawDocument>("/documents", { method: "POST", body: input }),
    );
  },

  /** A stale `contentVersion` throws an `ApiError` matching `isContentConflict`. */
  async patch(code: string, input: PatchDocumentInput): Promise<ApiDocument> {
    return normalizeDocument(
      await request<RawDocument>(`/documents/${encodeURIComponent(code)}`, {
        method: "PATCH",
        body: input,
      }),
    );
  },

  /** Oldest-first, matching the order `CommentsThread` renders. */
  listComments: (code: string) =>
    request<Array<DocumentComment & { id: number }>>(
      `/documents/${encodeURIComponent(code)}/comments`,
    ),

  addComment: (code: string, text: string) =>
    request<DocumentComment & { id: number }>(
      `/documents/${encodeURIComponent(code)}/comments`,
      { method: "POST", body: { text } },
    ),
};

// ---------------------------------------------------------------------------
// Workflow actions — all answer `{ document, message }`
// ---------------------------------------------------------------------------

async function workflow(
  path: string,
  options: RequestOptions = {},
): Promise<WorkflowResult> {
  const raw = await request<{ document: RawDocument; message: string }>(path, options);
  return { document: normalizeDocument(raw.document), message: raw.message };
}

export interface ScanImportInput {
  inspector: string;
  resultado: string;
  codigoRegistro?: string;
  /** "YYYY-MM-DD"; the server defaults to today. */
  fechaInspeccion?: string;
}

export interface MergeInput {
  /** Resolved content. Omitting it appends the canned resolution snippet. */
  content?: string;
  /** `details.serverContentVersion` from the 409. */
  contentVersion: number;
  appendResolutionText?: boolean;
}

export const workflowApi = {
  sign: (code: string) =>
    workflow(`/documents/${encodeURIComponent(code)}/sign`, { method: "POST" }),

  approve: (code: string, comment?: string) =>
    workflow(`/documents/${encodeURIComponent(code)}/approve`, {
      method: "POST",
      body: { comment },
    }),

  /** `comment` is mandatory and non-empty. */
  reject: (code: string, comment: string) =>
    workflow(`/documents/${encodeURIComponent(code)}/reject`, {
      method: "POST",
      body: { comment },
    }),

  saveVersion: (code: string) =>
    workflow(`/documents/${encodeURIComponent(code)}/versions`, { method: "POST" }),

  /** `index` is positional into the newest-first `revisiones` array. */
  restoreVersion: (code: string, index: number) =>
    workflow(`/documents/${encodeURIComponent(code)}/versions/${index}/restore`, {
      method: "POST",
    }),

  /** Omit `locked` to toggle — what the Editor button does. */
  toggleSectionLock: (code: string, locked?: boolean) =>
    workflow(`/documents/${encodeURIComponent(code)}/section-lock`, {
      method: "PATCH",
      body: locked === undefined ? {} : { locked },
    }),

  merge: (code: string, input: MergeInput) =>
    workflow(`/documents/${encodeURIComponent(code)}/merge`, {
      method: "POST",
      body: input,
    }),

  scanImport: (code: string, input: ScanImportInput) =>
    workflow(`/documents/${encodeURIComponent(code)}/scan-import`, {
      method: "POST",
      body: input,
    }),

  applyRegulation: (code: string) =>
    workflow(`/documents/${encodeURIComponent(code)}/apply-regulation`, {
      method: "POST",
    }),

  /** Server-computed banner predicate: active alert for the norma AND not applied yet. */
  async regulationAlert(code: string): Promise<RegulationAlert | null> {
    const data = await request<{ alert: RegulationAlert | null }>(
      `/documents/${encodeURIComponent(code)}/regulation-alert`,
    );
    return data.alert;
  },
};

// ---------------------------------------------------------------------------
// Templates & audit trail
// ---------------------------------------------------------------------------

export interface CreateTemplateInput {
  name: string;
  norma: string;
  type: DocumentType;
  nivel: TemplateLevel;
  clausulaIso?: string;
  periodicidadRevision: DocumentTemplate["periodicidadRevision"];
  secciones: TemplateSection[];
  desc?: string;
  preview?: string;
  content?: string;
  mandatory?: string[];
  tiempoRetencionAnios?: number;
  documentoPadreKey?: string | null;
  rolesRequeridos?: DocumentTemplate["rolesRequeridos"];
}

export const templatesApi = {
  list: () => request<DocumentTemplate[]>("/templates"),
  create: (input: CreateTemplateInput) =>
    request<DocumentTemplate>("/templates", { method: "POST", body: input }),
};

/** `"all"` is an accepted sentinel meaning "no filter" on the first three. */
export interface AuditFilters {
  user?: string;
  doc?: string;
  role?: string;
  limit?: number;
}

export const auditApi = {
  list: (filters: AuditFilters = {}) =>
    request<AuditLogEntry[]>("/audit-logs", { query: filters }),
};
