# Instructions: Build the Solinal Gestiona Backend

## Context for the agent

This is a document-management system (ISO 9001/22000 compliance docs, approval
workflows, audit trail) for a food-processing company. The **frontend already
exists and is fully built** — React 18 + TypeScript + Vite, at
`https://github.com/nfiallo5/Solinal-Gestiona`. Right now it has **no real
backend**: all data lives in a single `useReducer` in
`src/context/AppStateContext.tsx`, seeded from hardcoded objects in
`src/data/seed.ts`, and "auth" is a hardcoded list of 5 demo credentials in
`src/features/auth/credentials.ts` (one per role). Nothing persists except the
session flag, which is written to `localStorage`.

Your job: **build a backend (API + PostgreSQL) that replaces this in-memory
state**, without redesigning the data model or the business rules — they
already exist and are correct. Port them faithfully.

Do not touch `src/App.tsx`'s route wiring or redesign the UI. You will need to
edit `AppStateContext.tsx` and the feature files that currently `dispatch()`
directly, to call the new API instead — see "Frontend integration" below.

---

## 1. Stack

- **Runtime**: Node.js + TypeScript (matches the frontend's language, keeps
  one language across the stack — reasonable default given "simple backend,
  not sure about Python").
- **Framework**: Express. Don't over-engineer with NestJS or similar — this
  is an MVP.
- **DB**: PostgreSQL, accessed via **Prisma** (schema-first, good TS types,
  easy migrations — appropriate for a small team shipping fast).
- **Auth**: JWT (access token), bcrypt for password hashing. No need for
  refresh-token rotation or OAuth for this MVP — email/password is enough,
  matching what the current login form already collects.
- **Validation**: `zod` — the frontend already depends on `zod`, reuse it for
  request validation so schemas can eventually be shared.

If you (the agent) have a strong reason to deviate from any of the above,
that's fine, but keep the total stack small. This should be runnable with
`docker-compose up` (Postgres) + `npm run dev` (API), nothing more exotic.

---

## 2. Data model

Port these TypeScript interfaces from `src/data/seed.ts` into a Prisma schema.
Field names and semantics below are taken directly from that file — don't
invent new fields or drop existing ones.

### `User`
From `AppUser` (seed.ts) + `DemoCredential` (credentials.ts), merged into one
real table:
- `id` (uuid, pk)
- `name` (string) — display name, e.g. "Ana Torres"
- `short` (string) — 2-letter initials shown in avatars, e.g. "AT"
- `email` (string, unique)
- `passwordHash` (string)
- `role` (enum: `Administrador | Elaborador | Revisor | Aprobador | Lector`)
- `status`, `notes` (nullable strings — only set for users created via the
  "Nuevo usuario" modal, see `src/features/users/NewUserDialog.tsx`)
- `createdAt`

### `Document` (`SolinalDocument`)
- `code` (string, pk — human-assigned like "PRO-CAL-009", not auto-generated;
  check `CreateDocumentDialog.tsx` for the exact generation rule if the
  frontend currently derives it, and preserve that logic server-side instead)
- `title`, `type` (enum: `Procedimiento | Política | Manual | Instructivo |
  Checklist`), `norma` (string, e.g. "ISO 9001:2015")
- `estado` (enum: `Borrador | En aprobación | Aprobado | Rechazado`)
- `version` (string, e.g. "v1.2")
- `creador` (→ User relation, but stored as name historically; decide:
  either FK to User.id with name denormalized for display, or keep as free
  string like today — FK is cleaner, do that)
- `vencido` (bool), `critico` (bool)
- `content` (text — rich HTML from the contentEditable editor)
- `signatures` (string[] — user names who've signed; **this is an array of
  User references in practice**, model as a join table `DocumentSignature
  (documentCode, userId, signedAt)` rather than a raw array column, so you
  get timestamps for free and can enforce "can't sign twice")
- `revisiones` (string[] of freeform version-history strings — keep as a
  join table `DocumentRevision (id, documentCode, text, createdAt)` rather
  than a Postgres array, for queryability)
- `nivel` (nullable enum: `Política | Manual | Procedimiento | Instructivo |
  Registro`)
- `rolesRequeridos` (nullable JSON: `{ elaborador, revisor, aprobador,
  dobleAprobacion }` — copied from the originating template at creation
  time, per the comment in seed.ts; store as JSONB, it's a snapshot, not a
  live relation)

### `DocumentTemplate`
Port `DocumentTemplate` from seed.ts directly — `key` (pk), `name`, `norma`,
`type`, `desc`, `preview`, `content`, `mandatory` (string[], marked
`@deprecated` in the source but still present — keep it, don't drop it),
`nivel`, `clausulaIso`, `secciones` (JSON array of `{titulo, proposito,
obligatoria}`), `periodicidadRevision` (enum), `tiempoRetencionAnios` (int),
`documentoPadreKey` (nullable, self-referencing FK to another template's
`key`), `rolesRequeridos` (JSON, same shape as above).

### `AuditLogEntry`
- `id` (int, pk, auto-increment — note: current frontend computes this as
  `max(id) + 1` client-side in `makeAuditLog()`, `AppStateContext.tsx`; let
  Postgres do this instead)
- `action` (string — freeform human-readable description, e.g. "Aprobó y
  publicó el documento POL-GER-003")
- `user`, `role` (denormalize these at write time, same as now — audit logs
  should show what the user's role *was* at the time of the action, not a
  live FK that could change)
- `date`, `time`, `ip` — the frontend currently **fakes the IP**
  (`192.168.1.${random}` in `AppStateContext.tsx`). Replace with the real
  request IP server-side (`req.ip`, respecting `X-Forwarded-For` if you put
  this behind a proxy).

### `DocumentComment`
- `id`, `code` (FK → Document), `author` (FK → User, denormalize name for
  display), `date`, `text`

### `OrgConfig`
Singleton row (or just `id=1` convention): `orgName`, `brandColor`,
`twoFactorEnabled`, `passwordPolicy` (enum: `weak|medium|strong`),
`doubleApproval` (enum: `none|critical|all`).

Look at `src/features/config/*.tsx` to confirm nothing else needs to move
server-side (2FA is currently simulated client-side in
`TwoFactorDialog.tsx` — decide whether to implement real TOTP or keep it a
UI-only step for now; flag this decision back to the user rather than
guessing, since it changes login-flow scope significantly).

---

## 3. API routes

Design REST routes mapping 1:1 to the `AppAction` union in
`AppStateContext.tsx` — every dispatched action there is currently a local
state mutation and needs to become an API call. Use this table as the
starting contract:

| Frontend action (current) | Route | Notes |
|---|---|---|
| `LOGIN` | `POST /auth/login` | body: `{email, password}` → `{token, user}`. Replace `findCredential()` in `credentials.ts` with real bcrypt check against `User` table. |
| — | `POST /auth/logout` | invalidate/blacklist token if you're doing that; otherwise client just drops it |
| — | `GET /auth/me` | return current user from token, for session rehydration on page load (replaces the `localStorage` session read in `loadPersistedSession()`) |
| `ADD_DOCUMENT` | `POST /documents` | see `CreateDocumentDialog.tsx` for exact fields collected at creation, including template-derived `nivel`/`rolesRequeridos` |
| `UPDATE_DOCUMENT` | `PATCH /documents/:code` | generic partial update — but see below, several specific actions should probably be their own endpoints instead of raw PATCH, since they carry business rules |
| — | `GET /documents` | list, support query filters matching whatever `Documentos.tsx` / `Cumplimiento.tsx` currently filter client-side (status, type, norma, vencido) |
| — | `GET /documents/:code` | single doc detail for the Editor |
| `ADD_COMMENT` | `POST /documents/:code/comments` | |
| `ADD_AUDIT_LOG` | *(no direct route — server writes these itself)* | Audit entries should be a **side effect the server generates** on every meaningful write (login, approve, reject, sign, restore version, user role change), not something the client posts freely. Move `makeAuditLog()`'s logic server-side. |
| — | `GET /audit-logs` | with filters (see `AuditFilters.tsx`) |
| `TEMPLATE_ADD` | `POST /templates` | |
| — | `GET /templates` | |
| `ADD_USER` | `POST /users` | admin-only |
| `UPDATE_USER_ROLE` | `PATCH /users/:id/role` | admin-only |
| — | `GET /users` | |
| `UPDATE_CONFIG` | `PATCH /config` | admin-only |
| — | `GET /config` | |

### Business-logic endpoints (don't just do generic PATCH for these)

These currently live as functions inside `.tsx` files but encode real domain
rules that must be enforced **server-side**, not trusted from the client:

- **`POST /documents/:code/sign`** — port `handleSign()` from
  `src/routes/Editor.tsx`. Rules to preserve exactly:
  - Only `Aprobador` or `Administrador` role may sign.
  - If the doc has `rolesRequeridos`, the signer's role must match
    `revisor` or `aprobador` from that snapshot (Administrador always
    allowed).
  - Can't sign twice (check existing signatures).
  - If `critico === true` AND org config `doubleApproval === "critical"`:
    first signature → status stays/moves to `"En aprobación"`; second
    signature → status becomes `"Aprobado"`, `vencido` reset to `false`.
    Otherwise single signature → straight to `"Aprobado"`.
  - Every branch (including failed/unauthorized attempts) writes an audit
    log entry — including the *failure* cases, per the existing
    `audit(\`Intento fallido...\`)` calls. Don't skip logging rejected
    attempts.

- **`POST /documents/:code/approve`** and **`POST /documents/:code/reject`**
  — port `handleApprove()` / `handleReject()` from
  `ApprovalFlowDialog.tsx`. Rules:
  - Only `Aprobador` or `Administrador`.
  - Reject requires a non-empty comment; approve's comment is optional.
  - Same critical/double-approval branching as `sign`.

- **`POST /documents/:code/versions`** — port `handleSaveVersion()` from
  `Editor.tsx`: bumps `version` by `+0.1`, prepends a formatted revision
  string to `revisiones`.

- **`POST /documents/:code/versions/:index/restore`** — port
  `handleRestoreVersion()`: prepends a "[Versión Restaurada]" marker to
  content and resets `version` to the restored one.

- **`PATCH /documents/:code/section-lock`** — port `handleToggleLock()`:
  only the document's `creador` or an `Administrador` may toggle this.

Check `src/routes/Editor.tsx` in full (it's ~330 lines) for a few more
simulated actions (merge/scanner/regulation-alert simulators) — those are
explicitly fake demo flourishes per the code comments (`G02 Scenario 2`,
`G04 Scenario 4`, etc.) and probably don't need real backend support unless
the user wants them to. Flag this rather than assuming.

### Role-gating

`src/data/seed.ts` exports `lectorRestrictedPages` — the `Lector` role is
blocked from `edit`, `templates`, `audit`, `config` pages client-side today.
Replicate this as **server-side middleware**, not just UI hiding — right now
a `Lector` could hit these mutations directly since nothing stops them but
the UI. Add role-check middleware per route based on the table above (who's
allowed to call `POST /users`, `PATCH /config`, etc.).

---

## 4. Auth flow specifics

Replace `src/features/auth/credentials.ts` entirely. Seed the `User` table
with the 5 existing demo accounts (same emails/names/roles) but with real
bcrypt-hashed passwords instead of plaintext, so the "demo quick login"
buttons on the login screen keep working during the transition.

`RequireAuth.tsx` currently checks `state.session.isAuthenticated` from
client state. It should instead check for a valid JWT (e.g. via a
`GET /auth/me` call on app load, or by validating the JWT client-side and
letting API calls 401 naturally). Decide with the user whether to keep it
simple (token in `localStorage`, sent as `Authorization: Bearer`) — that's
sufficient for this MVP, no need for httpOnly cookies unless they want that
hardening.

The `LOCK_SYSTEM` / failed-attempt-lockout logic
(`REGISTER_FAILED_ATTEMPT`, locks after 3 attempts) currently lives in
client state too — move this server-side (track failed attempts per user in
the `User` table or a separate `LoginAttempt` table) so it can't be bypassed
by just reloading the page.

---

## 5. What NOT to change

- Don't touch component/route file structure, styling, or UI logic beyond
  what's needed to swap `dispatch()` calls for API calls.
- Don't rename any of the Spanish field/enum names (`estado`, `norma`,
  `creador`, etc.) — keep the schema's vocabulary matching the frontend's,
  since a lot of UI strings and comparisons key off these exact values.
- Don't change the 5-role model or the specific role names.

---

## 6. Frontend integration (after the backend exists)

`AppStateContext.tsx`'s reducer becomes redundant for anything that's now
server-owned. Recommended approach: keep the reducer for local-only UI state
(dialog open/close, form drafts) but replace `documents`, `templates`,
`auditLogs`, `comments`, `users`, `config` with **server data fetched via a
query layer** (`@tanstack/react-query` is a reasonable addition — not
currently a dependency, so add it) instead of reducer state. Each `dispatch`
call in feature files (`ApprovalFlowDialog.tsx`, `Editor.tsx`,
`Usuarios.tsx`, etc.) becomes a mutation call against the new API, followed
by a query invalidation/refetch.

This is a second phase — build and test the backend + its own test suite
first, confirm the routes match the business rules above, *then* wire the
frontend to it.

---

## 7. Deliverables checklist for the agent

- [ ] Prisma schema matching section 2, with a migration
- [ ] Seed script porting `src/data/seed.ts` verbatim (same demo docs, users,
      templates, audit logs, config) so the app looks identical on first run
- [ ] Express app with routes from section 3, zod-validated
- [ ] JWT auth + bcrypt, seeded demo credentials working
- [ ] Role-gating middleware
- [ ] Server-side audit logging on every mutating action (not client-supplied)
- [ ] `docker-compose.yml` for local Postgres
- [ ] README section: how to run migrations, seed, and start the API
- [ ] Note any place where you had to guess or diverge from the current
      frontend behavior, so it can be reviewed before the frontend gets
      wired up to it
