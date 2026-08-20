# Backend NOTES — divergences, guesses, and decisions

Running log required by `backend-agent-instructions.md` §7. Every place where a
faithful port of the frontend was impossible, ambiguous, or deliberately
"fixed" is recorded here so it can be reviewed before the frontend is wired up.

**Route agents: append your own entries. Do not rewrite existing ones.**

---

## Layer 1 — Foundation (schema, seed, shared infrastructure)

### 1. Enum name mapping (Prisma identifier vs. DB label vs. API wire format)

Prisma enum value identifiers **may** contain accents (verified against Prisma
6.19.3), so `Política`, `En_aprobación`, `Producción` etc. are written as-is.
They **may not** contain spaces. Exactly two frontend literals contain a space:

| seed.ts literal | Prisma identifier | Postgres label | API wire format |
|---|---|---|---|
| `"En aprobación"` | `DocumentStatus.En_aprobación` | `En aprobación` | `En aprobación` |
| `"No aplica"` | `PeriodicidadRevision.No_aplica` | `No aplica` | `No aplica` |

Both use `@map(...)` in `schema.prisma`, so **the database label is the exact
original string** (verified with `pg_enum`). Prisma Client, however, hands back
the underscore identifier, so the API layer converts:

- **out** → `src/lib/serialize.ts` calls `toWireEstado` / `toWirePeriodicidad`.
  Anything that goes through `serializeDocument` / `serializeTemplate` is
  already correct.
- **in** → `src/lib/enums.ts` exports `zEstadoWire` / `zPeriodicidadWire`, zod
  schemas that accept the wire literal and *transform* it into the Prisma enum.
  Use them in `validate({ body: … })`.

⚠️ **Never `res.json()` a raw `document.estado` or
`template.periodicidadRevision`.** Every other enum (`DocumentType`,
`TemplateLevel`, `RoleName`, `PasswordPolicy`, `DoubleApproval`) round-trips
unchanged and needs no mapping.

### 2. `isSectionLocked` moved from session-level to per-document

`AppStateContext.tsx` keeps a single global `state.session.isSectionLocked`
shared by every document. That cannot back `PATCH /documents/:code/section-lock`.

→ **`Document.sectionLocked Boolean @default(false)`.** This is an intentional
behaviour change: locking one document no longer locks all of them. The
frontend must be updated to read `doc.sectionLocked`. Authorization rule from
`handleToggleLock()` (Editor.tsx:111-120) is unchanged: only the document's
`creador` or an `Administrador` may toggle it.

### 3. `creador` is both an FK and a denormalized name

`Document.creadorId` is a real FK to `User.id`; `Document.creador` holds the
display name. The frontend compares `state.session.activeUser === doc.creador`
against a *name string*, so the serializer emits `creador` as the name.
`creadorId` is emitted too (additive) for anything that wants the real id.

Consequence: **`User.name` is `@unique`.** The whole frontend identifies users
by name (`doc.signatures.includes(activeUser)`), so duplicate display names
would be genuinely ambiguous. `POST /users` must reject a duplicate name — it
will surface as Prisma `P2002` → 409 automatically.

### 4. `signatures` and `revisiones` are join tables serialized back to `string[]`

- `DocumentSignature(documentCode, userId, userName, signedAt)` with
  `@@unique([documentCode, userId])` — "can't sign twice" is now a DB
  constraint, not just an `if`. `userName` is denormalized so an old signature
  keeps showing the name it was signed with.
  → serialized **oldest first** (`signedAt asc`); the frontend appends.
- `DocumentRevision(id, documentCode, text, createdAt)` where `id` is an
  **autoincrement `Int`, not a uuid** — the frontend prepends revisions and
  then indexes into the array positionally (`handleRestoreVersion(idx)`), so
  "newest first" must be an exact, tie-free ordering. `orderBy: { id: 'desc' }`
  gives that; `createdAt desc` could swap two same-millisecond inserts.
  → serialized **newest first**.

Both serializers re-sort defensively, so a query that forgets the `orderBy`
still produces correct JSON. Use the `documentInclude` preset anyway.

### 5. Audit log: server-owned ids, real IPs, and a timezone fix

- `id` is a Postgres sequence, replacing the client's `max(id) + 1`.
- `ip` is the real `req.ip` (with `app.set('trust proxy', 1)`), replacing the
  faked `192.168.1.${random}`. IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is
  unwrapped for readability.
- **Deliberate fix:** the original `makeAuditLog()` built `date` from
  `toISOString()` (UTC) but `time` from `toTimeString()` (local), so in UTC-5
  the two disagree for five hours every evening. `writeAudit()` uses **local
  time for both**. If byte-identical reproduction of the old bug is ever
  wanted, change `formatAuditDate` in `src/lib/audit.ts`.
- `user` and `role` stay denormalized strings with **no FK**, per the spec: an
  audit row must show the role the actor *had*, not their current one.

### 6. Audit-log ordering and the seeded ids

`AuditLogTable.tsx` renders `#{l.id}`, so the four seed ids (1-4) are inserted
verbatim to keep the UI identical. In `src/data/seed.ts` those ids ascend while
the array is newest-first, so **`orderBy: { id: 'desc' }` would show them
backwards.** `GET /audit-logs` must order by:

```ts
orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
```

The seed sets `createdAt` from each row's `date` + `time`, and afterwards calls
`setval()` on the sequence so the first runtime insert does not collide with
id 1.

### 7. Seed documents keep `nivel` and `rolesRequeridos` NULL

Both are optional on `SolinalDocument` and absent from all 7 seed documents
(they predate templates). The seed writes `null` / `Prisma.DbNull` — **no
values were invented.** Only documents created from a template get them.

Knock-on effect for the sign flow: `handleSign()`'s `rolesRequeridos` gate is a
no-op for every seed document, exactly as it is today.

### 8. Login lockout moved server-side — two storage locations

The frontend tracks `session.failedAttempts` and locks at 3, trivially bypassed
by reloading. Server-side there are now two pieces, on purpose:

- **Authoritative state**: `User.failedAttempts Int @default(0)` and
  `User.lockedAt DateTime?`. `requireAuth` returns **423** while `lockedAt` is
  set. Reset `failedAttempts` to 0 on a successful login.
- **Audit trail**: the `LoginAttempt` table logs every attempt (success or not)
  with the email, optional `userId`, and IP. It also covers attempts against
  emails that match no user, which the counter cannot.

`env.MAX_FAILED_LOGIN_ATTEMPTS` defaults to **3**, matching the frontend.
**Open question for the auth agent:** nothing currently *unlocks* an account.
Either add an admin unlock endpoint or a time-based expiry on `lockedAt`;
flag whichever you pick here.

### 9. 2FA is not implemented

Per the user's decision, `TwoFactorDialog.tsx` stays a cosmetic UI step. There
is **no `totpSecret` column and no two-step login.** `OrgConfig.twoFactorEnabled`
is persisted (the config screen writes it) but the backend does not act on it.

### 10. Document codes are generated server-side

`nextDocumentCode()` from `docStyles.ts` is ported to
`src/lib/documentCode.ts` with identical arithmetic. `POST /documents` must
**not** accept a client-supplied `code`; it takes `type` + `area` and derives
the code.

**Race caveat:** two simultaneous creates can compute the same code. `code` is
the PK so the loser gets Prisma `P2002` → 409 from the central error handler.
Use `createWithGeneratedCode()` to retry transparently instead.

### 11. Demo flows: agreed shapes

The static HTML blocks from `src/features/editor/aiEngine.ts` are mirrored
byte-for-byte in **`src/lib/demoContent.ts`** so the merge/scanner/regulation
agents share one copy. Do not edit that markup without editing `aiEngine.ts`.

- **Merge** → real optimistic concurrency. `Document.contentVersion Int
  @default(0)`, bumped on every content write. A `PATCH` carrying a stale
  `contentVersion` should 409 with both contents; `POST /documents/:code/merge`
  commits the resolved text. Suggested 409 body (via `HttpError`):
  `{ error: { code: 'STALE_VERSION', details: { serverVersion, serverContent, clientContent } } }`.
- **Scanner** → **no real OCR** (no dependency, no spec for one). The endpoint
  accepts `{ inspector, resultado, codigoRegistro?, fechaInspeccion? }`,
  appends `renderScanImportHtml(payload)`, and persists a `ScanImport` row so
  the ingest is auditable. User-supplied values are HTML-escaped before being
  interpolated into document content.
- **Regulation alerts** → the `RegulationAlert` table replaces the hardcoded
  `NORMA_CON_CAMBIO_PENDIENTE` const. Seeded with the single ISO 22000:2018
  alert using the exact `REGULATION_UPDATE_MARKER` / `regulationUpdateText`
  strings. Banner predicate, unchanged in meaning: *doc's `norma` has an active
  alert AND `doc.content` does not already contain that alert's `marker`.*

### 12. Additive fields in API responses

The DTOs in `serialize.ts` are supersets of the seed.ts interfaces. Extra keys
the frontend currently ignores: `sectionLocked`, `contentVersion`, `creadorId`,
`createdAt`, `updatedAt` on documents; `id` on comments; `id`/`email`/`createdAt`
on users. Nothing was removed.

`serializeTemplate` **omits** `documentoPadreKey` entirely (rather than sending
`null`) for root-level templates, matching seed.ts where the field is simply
absent.

`serializeUser` never emits `passwordHash`, `failedAttempts`, or `lockedAt`.

### 13. Seed idempotency semantics

`npx prisma db seed` is safe to re-run. Seed rows are **upserted back to their
baseline**, so a re-run *restores* the demo state and discards local edits to
seed rows — that is the intent. Runtime-created rows that are not part of the
seed are left untouched. The two seed comments are matched on
`(code, author, date, text)` and skipped if already present, so re-seeding does
not duplicate them.

### 14. Docker is unavailable in the development environment

`docker-compose.yml` ships as required, but Docker is not installed on this
machine. All migrations, seeding, and tests were run against the **local
PostgreSQL 16** over the unix socket with peer auth
(`postgresql://nfiallo@localhost/solinal_gestiona?host=/var/run/postgresql`).
The databases `solinal_gestiona` and `solinal_gestiona_test` were created for
this. See README.

`npm run test:db:reset` uses `prisma migrate deploy` + `db seed` rather than
`prisma migrate reset`, because the destructive reset command is blocked in
this environment.

### 15. `express.json` limit raised to 2 MB

Document `content` is rich HTML from a contentEditable surface and the default
100 KB limit is plausibly reachable. Not a behaviour change, just a guess worth
recording.

### 16. Pinned to Prisma 6.x

`prisma` / `@prisma/client` are pinned to `^6.19`. Prisma 7 is out but drops
the `package.json#prisma.seed` config in favour of `prisma.config.ts` (the CLI
already warns about it on every command). Upgrading is a separate, deliberate
task — do not bump it as a side effect of adding a route.

---

## Layer 2 — Routes

*(append below)*

---

### Agent 2 — auth & admin (`/auth`, `/users`, `/config`)

Files: `src/routes/auth.ts`, `src/routes/users.ts`, `src/routes/config.ts`,
`tests/auth.test.ts`, `tests/users.test.ts`, `tests/config.test.ts`.

| Method | Path | Required role |
|---|---|---|
| POST | `/auth/login` | public |
| POST | `/auth/logout` | any authenticated |
| GET | `/auth/me` | any authenticated |
| GET | `/users` | any authenticated |
| POST | `/users` | `Administrador` |
| PATCH | `/users/:id/role` | `Administrador` |
| POST | `/users/:id/unlock` | `Administrador` |
| GET | `/config` | any authenticated |
| PATCH | `/config` | `Administrador` |

### 17. Unlock policy — answers the open question in § 8

§ 8 left "nothing unlocks a locked account" unresolved. **Both** of the
suggested mechanisms are now implemented, because either alone has a bad
failure mode (a time-only lock strands nobody but also gives an admin no
override; an admin-only unlock means the last admin can lock themselves out
of their own system permanently):

1. **Time-based auto-expiry.** `LOCKOUT_MINUTES`, default **15**, read from
   `process.env` in `src/routes/auth.ts`. It is deliberately **not** in the
   validated `env` object — `src/env.ts` is foundation-owned and off-limits to
   this agent; the fallback means no `.env` change is needed. Move it into
   `env.ts` (and `.env.example`) at the next foundation touch.
   `POST /auth/login` clears an elapsed lock lazily on the next attempt, so
   there is no scheduled job.
2. **`POST /users/:id/unlock`**, `Administrador` only. Clears both `lockedAt`
   and `failedAttempts` and audits it ("Desbloqueó manualmente la cuenta de
   …"). Returns `{ user, unlocked }`, where `unlocked` is false if the account
   was not actually locked (the call then just resets the counter).

Lockout details, all in `src/routes/auth.ts`:

- The attempt that *reaches* `MAX_FAILED_LOGIN_ATTEMPTS` (3, from `env`)
  already answers **423**, not 401; earlier failures answer 401 with
  `details.remainingAttempts` so the UI can warn.
- While locked, **the correct password is refused too** (423). That is the
  point of the fix — the client-side version was bypassed by reloading.
- 423 bodies carry `details: { lockedAt, retryAfterSeconds }`.
- A successful login resets `failedAttempts` to 0 (`RESET_FAILED_ATTEMPTS`).
- An unknown email gets a 401 and a `LoginAttempt` row with `userId: NULL`,
  but **no audit entry** — `AuditLogEntry` requires an actor name and role and
  there is no user to name. The `LoginAttempt` table is the trail for those.
- **Known gap:** `requireAuth` (foundation-owned) 423s on any non-null
  `lockedAt` without consulting the expiry window. In practice a locked user
  has no fresh token, so this only bites a user holding a still-valid token
  whose account was locked and whose window has since elapsed; they get 423
  until they log in again (which succeeds and clears the lock). Fixing it
  properly means teaching `requireAuth` about `LOCKOUT_MINUTES`.

### 18. `POST /auth/logout` is an audited no-op, by design

Token storage is localStorage + `Authorization: Bearer` with no refresh
rotation, so there is no server-side session to destroy. The route requires a
valid token, writes `"Cierre de sesión de <name>"`, and returns
`{ ok: true }`. **There is deliberately no token blacklist** — the JWT stays
valid until `JWT_EXPIRES_IN` (8h) elapses and the client simply drops it. A
test asserts this explicitly so the behaviour is not mistaken for a bug.

### 19. New users need a password the "Nuevo usuario" modal never collects

`NewUserDialog.tsx` collects name, email, role, status and notes — no
password — and does not even pass the email through to `ADD_USER`.
Decision for `POST /users`:

- `password` is **optional**. Supplied → validated against the org's
  `OrgConfig.passwordPolicy` (see § 22) and hashed.
- Omitted → the server mints a 14-character cryptographically random
  temporary password (`node:crypto` `randomInt`, guaranteed to contain an
  uppercase, a lowercase and a digit, so it satisfies every policy tier) and
  returns it **once** as `temporaryPassword` in the 201 body. It is never
  stored in plaintext and never returned again.
- The frontend should surface it to the admin to hand over out of band.
  **Not implemented and worth doing later:** a forced password change on first
  login (there is no `mustChangePassword` column) and any self-service
  password reset / change endpoint. Neither is in the spec.

`email` is required by the route even though the dialog currently drops it,
because `User.email` is `@unique` and non-null and is the login identifier —
the dialog must be wired to send the field it already collects.

### 20. `initialsOf()` slices to 3 characters, not 2

The spec and the seeded rows say `short` is 2-letter initials, but the
function `NewUserDialog.tsx` actually calls
(`src/features/users/roleTheme.ts#initialsOf`) does `.slice(0, 3)`.
`src/routes/users.ts` ports the **real** implementation verbatim, so
"Maria Jose Del Campo" → `MJD`, matching what the UI would have produced. All
five seed users have two-word names, which is why the divergence is invisible
today. `short` is always derived server-side and never accepted from the
client, so the two can no longer drift.

### 21. `GET /config` is open to `Lector`; only `PATCH /config` is gated

`lectorRestrictedPages` lists `config`, but that restriction is about the
Configuración *page*, and the config *values* are read from screens that have
nothing to do with it: `brandColor`/`orgName` theme the whole shell, and
`doubleApproval` is read by `Editor.tsx:190` and `ApprovalFlowDialog.tsx:88`.
None of the five fields is sensitive. So the read is open to any authenticated
role and the **write** carries the Lector restriction (via admin-only).

Note also that `Login.tsx:80` reads `config.twoFactorEnabled` **before**
authenticating. `GET /config` requires a token, so the frontend cannot fetch
it at that point — since 2FA is a UI-only simulation (§ 9) the simplest fix is
for the login screen to stop gating on it, or for the flag to be inlined at
build time. Flagged, not fixed: it is a frontend change and outside this
agent's files.

`PATCH /config` is `.strict()` — an unknown key is a 400 rather than a silent
no-op — and rejects an empty body.

### 22. `OrgConfig.passwordPolicy` is now enforced, not just displayed

It was a stored string that nothing read. `POST /users` now validates an
explicitly supplied password against it, using the rules spelled out in the
labels of `src/features/config/SecuritySection.tsx`:

| policy | rule |
|---|---|
| `weak` | ≥ 6 characters |
| `medium` | ≥ 8 characters and a digit |
| `strong` | ≥ 10 characters, an uppercase letter and a digit |

A violation is a **422**. This is an addition, not a port — the frontend never
enforced anything. Note the five **seeded demo passwords** (`admin2026`, …)
would fail the seeded `strong` policy; they are hashed by the seed script and
never go through this check, so the demo quick-login buttons keep working.

### 23. Rejected admin actions are audited via `requireRoleAudited()`

`Usuarios.tsx#handleRoleChange()` logs
`"Intento no autorizado de cambiar el rol de X por Y (Rol: Z)"`, and the spec
insists rejected attempts stay logged. Plain `requireRole()` rejects before any
handler runs, so `src/routes/auth.ts` exports
`requireRoleAudited(roles, describe)` / `requireAdmin(describe)`, which write
the audit entry and then `next(HttpError.forbidden(...))`. Used by
`POST /users`, `PATCH /users/:id/role`, `POST /users/:id/unlock`, and
`PATCH /config`. On `POST /users` it is mounted **before** body validation on
purpose, so an unauthorized attempt is logged even when the payload is also
malformed.

`config.ts` and `users.ts` import these helpers from `auth.ts` rather than a
new shared module, only because this agent owns those three files and nothing
under `src/lib/`. If a fourth consumer appears, promote them to
`src/lib/authz.ts`.

### 24. Response envelopes for the auth/admin routes

Documented because they are new surface, not ports of anything:

- `POST /auth/login` → `{ token, user }` (`user` is a `UserDTO`).
- `GET /auth/me` → `{ user }` — same envelope as login, minus the token.
- `POST /auth/logout` → `{ ok: true }`.
- `GET /users` → a bare `UserDTO[]`, ordered by `createdAt asc`.
- `POST /users` → `201 { user, temporaryPassword? }`.
- `PATCH /users/:id/role` → `{ user, isSelf }`. **`isSelf` exists for the
  reducer**: `UPDATE_USER_ROLE` also rewrites `session.activeRole` when the
  edited user is the logged-in one (`Usuarios.tsx:45`), and this saves the
  frontend a name comparison. A no-op role change (same role) is a 200, not an
  error, and writes no audit entry.
- `POST /users/:id/unlock` → `{ user, unlocked }`.
- `GET`/`PATCH /config` → a bare `ConfigDTO`.

`:id` is validated as a **uuid** (`User.id` is `@default(uuid())`), so a
non-uuid is a 400 and an unknown uuid a 404. Note the route keys on the user
**id**, while the `UPDATE_USER_ROLE` reducer keys on the **name** — the id is
the stable identifier and `GET /users` already returns it.

---

### Agent 3 — documents, templates & audit trail (`/documents`, `/templates`, `/audit-logs`)

*Numbered `A3.n` rather than continuing the global sequence: Agent 4 was
appending to this file at the same time and plain integers would have
collided.*

#### A3.1 `GET /documents` filter vocabulary, and `estado=Vencido`

The query parameters are named after the state variables in `Documentos.tsx`,
one per client-side filter that exists today:

| Param | Values | Maps to |
|---|---|---|
| `estado` | `Borrador` \| `En aprobación` \| `Aprobado` \| `Rechazado` \| **`Vencido`** | `estado`, except `Vencido` |
| `type` | the 5 `DocumentType` values | `type` |
| `norma` | exact string, e.g. `ISO 9001:2015` | `norma` |
| `vencido` | `true` \| `false` \| `1` \| `0` | `vencido` |
| `critico` | `true` \| `false` \| `1` \| `0` | `critico` (additive) |
| `search` | free text | case-insensitive `contains` over `title` OR `code` |

**`Vencido` is not a `DocumentStatus`.** It is the 5th option of the estado
`<Select>` (Documentos.tsx:124) and means `vencido === true`. It is handled as
a special case of `estado` so the existing `<Select>` can post its value
unchanged; `?vencido=true` is the explicit equivalent. `critico` is additive —
nothing filters on it today, but the column exists and the badge is rendered.

Ordering is `[{ createdAt: 'asc' }, { code: 'asc' }]`, which reproduces the
`seedDocuments` array order the table renders today.

#### A3.2 `Lector` scoping is enforced on reads, not just hidden in the UI

`Documentos.tsx:55` filters the list to `estado === "Aprobado"` for a Lector.
Ported server-side as an extra `AND` term rather than by overwriting the
caller's `estado` filter, so `GET /documents?estado=Borrador` as a Lector
correctly returns `[]` instead of silently returning approved documents.
`GET /documents/:code` 403s a Lector on any non-approved document.

`Cumplimiento.tsx` is **not** in `lectorRestrictedPages` and
`useRequirementMapping()` reads `state.templates`, so **`GET /templates` stays
open to `Lector`** — only `POST /templates` is gated. `GET /audit-logs` and
every document mutation are closed to `Lector` (`edit`, `templates`, `audit`
are all in `lectorRestrictedPages`, src/data/seed.ts:482).

#### A3.3 `POST /documents`: `description` is accepted and discarded

`CreateDocumentDialog.tsx` collects a "Descripción breve" textarea but never
puts it on the `SolinalDocument` it dispatches — there is no such field in the
model. The request schema accepts `description` and ignores it, so the form can
post its whole state unchanged. **If that description should actually be
stored, it needs a new column;** flagged rather than invented.

The `critical` checkbox is received as **`critico`** (the document field name),
not `critical` (the form-state name). `critico` derives from
`template.rolesRequeridos.dobleAprobacion` whenever a `templateKey` is given,
and only falls back to the request's `critico` for blank documents — verbatim
from CreateDocumentDialog.tsx:127. A request that sets `critico: true` while
naming a template with `dobleAprobacion: false` gets `critico: false`.

`type` and `norma` come from the request, not the template: the dialog
pre-fills both from the template but leaves them editable before submit.

#### A3.4 `PATCH /documents/:code` — the 409 conflict contract

Patchable fields: `title`, `content`, `estado`, `version`, `vencido`,
`critico`. Deliberately **not** patchable: `code`, `type`, `norma`, `creador`
(`MetadataForm.tsx` documents these as "set once at creation"), and
`signatures` / `revisiones` / `nivel` / `rolesRequeridos` / `sectionLocked`,
which belong to Agent 4's workflow endpoints. An empty body is a 400.

Rules for content writes:

- **`contentVersion` is bumped whenever `content` is present in the body**,
  even if the new text is byte-identical. A simple, predictable rule beats a
  diff check.
- `contentVersion` in the request is **optional**. When present and different
  from the stored value the request 409s; when absent there is no conflict
  check (a client that opts out of concurrency control still works). The
  frontend should always send it.

The 409 body, which `POST /documents/:code/merge` and `MergeDialog.tsx` both
have to match:

```jsonc
{
  "error": {
    "message": "El documento PRO-CAL-009 fue modificado por otra sesión.",
    "code": "CONTENT_VERSION_CONFLICT",
    "details": {
      "code": "PRO-CAL-009",
      "clientContentVersion": 0,      // what the caller sent
      "serverContentVersion": 1,      // what to send back on merge
      "clientContent": "<p>…</p>",    // the rejected draft (MergeDialog left pane)
      "serverContent": "<p>…</p>",    // what is stored now  (MergeDialog right pane)
      "serverUpdatedAt": "2026-08-19T23:41:07.123Z"
    }
  }
}
```

`MergeDialog.tsx` also names the other editor ("Ana Torres guardó cambios hace
unos momentos"). **There is no `lastEditedBy` column**, so the details payload
cannot supply that name — `serverUpdatedAt` is the closest available fact. The
dialog either drops the attribution or a `lastEditedBy` column gets added.

#### A3.5 A signed Registro is frozen server-side (423)

`Editor.tsx:257` computes `contenidoBloqueado = esRegistroPorNivel(doc.nivel)
&& doc.signatures.length > 0` and makes the editor read-only. CLAUDE.md §4.4
raises enforcing it in the reducer as an open question. It is enforced here
instead: a `PATCH` that writes `content` to a document with
`nivel === "Registro"` and at least one signature returns **423 LOCKED**.
Metadata on the same document stays patchable — only `content` is evidence.

`sectionLocked` is deliberately **not** enforced on `PATCH`: in the frontend
the lock only changes what `LockedSection.tsx` renders, it never blocks the
main content editor, and the toggle itself is Agent 4's route.

#### A3.6 Comments are read through their own endpoint

`Editor.tsx:288` does `state.comments.filter(c => c.code === doc.code)` over a
global list. `DocumentDTO` has no `comments` field and adding one would change
a shape three other routers already return, so reads go through
**`GET /documents/:code/comments`** instead. Ordered **oldest-first**
(`[{ createdAt: 'asc' }, { id: 'asc' }]`) because `CommentsThread.tsx` renders
the array in order and the reducer appends. Both comment routes are closed to
`Lector` (the thread only exists on the `edit` page).

`date` is written with `formatCommentDate()` → `"YYYY-MM-DD HH:mm"`, matching
`Editor.tsx:149`'s `toISOString().slice(0,16).replace("T"," ")` in shape, but
in **local** time rather than UTC (same fix as § 5).

#### A3.7 `POST /templates` derives what the dialog derives

The request only has to carry `name`, `norma`, `type`, `nivel`,
`periodicidadRevision` and a non-empty `secciones`. Everything
`NewTemplateDialog.tsx#handleSave` computes is recomputed server-side when the
field is omitted, using the same expressions:

- `key` → `` `${name.toLowerCase().replace(/\s+/g,'-')}-${Date.now()}` ``
- `desc` → `Estructura personalizada para {type} bajo la norma {norma}.`
- `preview` → `Secciones: {títulos, comma-joined}`
- `content` → `1. Título<br/>2. Título…`
- `mandatory` → titles of the sections flagged `obligatoria`
- `tiempoRetencionAnios` → `3`
- `rolesRequeridos` → `{Elaborador, Revisor, Aprobador, dobleAprobacion:false}`

All of them can be overridden explicitly. The client MAY send its own `key`;
a collision is a 409 (`P2002`). The ISO rule from G06 Scenario 4 ("al menos una
sección obligatoria") is enforced server-side, after trimming titles, so a
section list of blank titles is a 400 rather than a template with no structure.
A `documentoPadreKey` that names no existing template is a 400 (checked
explicitly, for a better message than the raw FK violation).

**Not implemented: `PATCH`/`DELETE /templates/:key`.** The frontend has no
edit-or-delete affordance for templates (`Plantillas.tsx` only lists, previews
and creates), and `AppAction` has only `TEMPLATE_ADD`.

#### A3.8 `GET /audit-logs` filters, and why `doc` is a substring match

Parameters mirror `AuditFilterState` exactly: `user`, `doc`, `role` — plus an
optional `limit` (1-1000; omitted returns the whole trail, as the UI does
today). The literal string **`"all"` is accepted and treated as "no filter"**,
because that is the sentinel value the three `<Select>`s hold when cleared;
this saves the frontend from stripping them before building the query.

`doc` is a **substring match against `action`**, not a foreign key:
`AuditLogEntry` has no document relation (by design — see § 5), the code is
embedded in the freeform Spanish action text, and `Auditoria.tsx:30` filters
with `l.action.includes(filters.doc)`. Ported verbatim, with the same
consequence: an action mentioning two codes matches both.

Ordering is `[{ createdAt: 'desc' }, { id: 'desc' }]` per § 6.

**There is no `POST /audit-logs`** and there must never be one. Three frontend
call sites currently dispatch `ADD_AUDIT_LOG` with no accompanying mutation and
therefore have **no endpoint to call**:

1. `Auditoria.tsx#handleExport` — "Exportó registros de auditoría a CSV".
2. `Auditoria.tsx#handleUnauthorizedEdit` — "Intento fallido de eliminación del
   Audit Trail…", the scripted immutability demo.
3. `Editor.tsx`'s regulation-banner `useEffect` — "Recibió alerta de
   actualización de norma … al abrir …", fired on document open.

Each needs either its own server action that audits as a side effect (an export
endpoint; a `POST /audit-logs/report-attempt`-style route), or to stop being
audited. Left unresolved on purpose rather than punching a hole in the trail —
flagging it for whoever wires the frontend.

#### A3.9 Response envelopes

All three routers return **bare DTOs**, never wrapped: `GET /documents` →
`DocumentDTO[]`, `GET|POST|PATCH /documents/:code` → `DocumentDTO`,
`GET /documents/:code/comments` → `CommentDTO[]`, `POST …/comments` →
`CommentDTO`, `GET /templates` → `TemplateDTO[]`, `POST /templates` →
`TemplateDTO`, `GET /audit-logs` → `AuditLogDTO[]`. Creates answer **201**.
(Note this differs from Agent 2's `/users` and `/auth` routes, which wrap — see
§ 24.)

### Agent 4 — workflow actions & demo flows (`/documents/:code/…`, `/regulation-alerts`)

Files: `src/routes/documentWorkflow.ts`, `src/routes/regulationAlerts.ts`,
`tests/documentWorkflow.test.ts`, `tests/regulationAlerts.test.ts`.

| Method | Path | Required role |
|---|---|---|
| POST | `/documents/:code/sign` | `Aprobador` or `Administrador` (checked in-handler, see § A4-2) |
| POST | `/documents/:code/approve` | `Aprobador`, `Administrador` |
| POST | `/documents/:code/reject` | `Aprobador`, `Administrador` |
| POST | `/documents/:code/versions` | `Administrador`, `Elaborador`, `Revisor`, `Aprobador` |
| POST | `/documents/:code/versions/:index/restore` | `Administrador`, `Elaborador`, `Revisor`, `Aprobador` |
| PATCH | `/documents/:code/section-lock` | above **and** the document's `creador`, or `Administrador` |
| POST | `/documents/:code/merge` | `Administrador`, `Elaborador`, `Revisor`, `Aprobador` |
| POST | `/documents/:code/scan-import` | `Administrador`, `Elaborador`, `Revisor`, `Aprobador` |
| POST | `/documents/:code/apply-regulation` | `Administrador`, `Elaborador`, `Revisor`, `Aprobador` |
| GET | `/documents/:code/regulation-alert` | any authenticated |
| GET | `/regulation-alerts` | any authenticated |

In short: everything except the two GETs excludes `Lector`, and the three
decision verbs narrow further to `Aprobador` / `Administrador`.

### A4-1. Every workflow action answers `{ document, message }`

Generic CRUD returns a bare `DocumentDTO`; the *action* endpoints in
`documentWorkflow.ts` return `{ document: DocumentDTO, message: string }`.
`message` is the exact Spanish string the corresponding `toast.*()` shows today
("Firma 1/2 agregada. Pendiente de co-firma de un segundo aprobador.", etc.), so
the branch-dependent copy lives on the server next to the branch that chose it
and the frontend does not have to re-derive which of three sign outcomes it got.
`document` always comes from `serializeDocument` on a `documentInclude` query.

`POST /:code/apply-regulation` adds a third key, `alert`, with the
`RegulationAlertDTO` that was applied.

### A4-2. `POST /:code/sign` gates roles inside the handler, not with `requireRole`

`handleSign()` writes an audit entry for its *rejections*
(`Intento fallido…` / `Intento no autorizado…`). `requireRole` would 403 in
middleware, before any handler code could log that. So `/sign` mounts
`requireAuth` only and performs both gates itself.

`/approve` and `/reject` keep `requireRole('Aprobador', 'Administrador')`
because `ApprovalFlowDialog.tsx` does **not** audit its rejections — only
`toast.error`. That asymmetry is in the original source, not an oversight here.

### A4-3. `handleSign` and `handleApprove` disagree about `estado` and `vencido` — both ported verbatim

Two real differences between the two frontend functions, preserved exactly:

| | first-of-two branch | approving branch |
|---|---|---|
| `handleSign` | sets `estado = "En aprobación"`, leaves `vencido` alone | `estado = "Aprobado"`, `vencido = false` |
| `handleApprove` | writes the signature **only** — `estado` untouched | `estado = "Aprobado"`, `vencido = false` |

`handleApprove` also tolerates a caller who already signed (it reuses the
existing signature instead of erroring), whereas `handleSign` 409s on a repeat.
Both behaviours are ported as-is.

### A4-4. Revision timestamps use local time, following divergence § 5

`handleSaveVersion()` builds its revision line with
`new Date().toISOString().slice(0, 10)` — a **UTC** date, while the audit row
written in the same click used local time. The backend uses
`formatAuditDate(new Date())` (local) for both, consistent with the timezone fix
already recorded in divergence § 5. In UTC-5 the two disagree for five hours
every evening; picking local for everything is the lesser evil.

`POST /:code/versions` also 422s when `parseFloat(version.replace('v',''))` is
`NaN` — the frontend would silently write `"vNaN"`.

### A4-5. `restore` reproduces a latent frontend bug on purpose

`handleRestoreVersion()` derives the restored version with
`revisionText.split(" - ")[0]`. The revision lines *it* writes contain `" - "`
(`"v1.2 - Modificado el …"`), so this works. But the **seed** revisions do not
(`"v1.1: Ajustes en límites de humedad"`), so restoring one of those sets
`version` to the entire line. That is exactly what the UI does today, and the
brief specified the `split(" - ")[0]` rule explicitly, so it is ported verbatim
rather than "fixed". Worth revisiting with the user — the fix is to store the
version in its own column on `DocumentRevision`.

The `:index` param is **positional into the newest-first array**
`serializeRevisiones` returns, matching `doc.revisiones[idx]` in the frontend.
Out-of-range 400s.

### A4-6. Additive audit entries where the frontend had none

`handleToggleLock()` and `handleApplyRegulation()` only toast today. Both now
write audit rows, since the spec asks every branch of a gated mutation to leave
a trail:

- `Bloqueó la sección crítica del documento ${code}` / `Desbloqueó …`
- `Intento no autorizado de cambiar el bloqueo de sección en ${code} por ${user} (Rol: ${role})`
- `Aplicó la actualización regulatoria de ${norma} en el documento ${code}`
- `Escaneó formato físico e importó datos al editor en ${code}` — the frontend
  string has no document code; one is appended so the entry is traceable.

Everything else uses the frontend's string byte-for-byte.

One message could not be reproduced: `handleApplyRegulation`'s toast says
"Cambios regulatorios **ISO 22000:2026** aplicados al borrador" — the *new*
norm. The `RegulationAlert` row only stores the *old* norm it applies to
(`ISO 22000:2018`), so the response message names that instead. Adding a
`normaDestino` column would fix it; not worth a migration for one toast.

### A4-7. `PATCH /:code/section-lock` toggles, and also excludes `Lector`

Body is `{ locked?: boolean }`. Omit `locked` to toggle (what the Editor button
does); send it to set an absolute value (idempotent, retry-safe). Authorization
is the frontend's rule unchanged — the document's `creador` **name** or role
`Administrador` — with `requireRole` excluding `Lector` in front of it, since
`lectorRestrictedPages` blocks Lector from the `edit` page entirely.

Same `EDITOR_ROLES` gate (`Administrador | Elaborador | Revisor | Aprobador`) is
applied to `/versions`, `/versions/:index/restore`, `/merge`, `/scan-import`,
and `/apply-regulation`.

### A4-8. Merge: request shape and the coordinated 409 body

**Coordinated with `PATCH /documents/:code` in `src/routes/documents.ts`.** That
handler rejects a stale write with

```
409 { error: { code: 'CONTENT_VERSION_CONFLICT', details: {
        code, clientContentVersion, serverContentVersion,
        clientContent, serverContent, serverUpdatedAt } } }
```

`POST /documents/:code/merge` takes:

```ts
{
  content?: string,              // resolved content; omit → server content + MERGE_RESOLUTION_TEXT
  contentVersion: number,        // = details.serverContentVersion from the 409
  baseVersion?: number,          // tolerated alias for contentVersion
  appendResolutionText?: boolean // append MERGE_RESOLUTION_TEXT on top of `content`
}
```

and answers `200 { document, message }` with `contentVersion` incremented. If
another write landed between the 409 and the merge, it re-conflicts with the
**identical** body shown above, so one client handler covers both cases.

Omitting `content` reproduces the old fake `handleConfirmMerge()` exactly
(server content + `MERGE_RESOLUTION_TEXT`), which keeps MergeDialog working
unchanged before the frontend is taught to send resolved text.

### A4-9. The signed-Registro freeze is enforced on every content write, not just PATCH

`PATCH /documents/:code` 423s a content write to a `nivel: "Registro"` document
that has signatures. `/merge`, `/scan-import`, `/apply-regulation`, and
`/versions/:index/restore` apply the **same** guard — otherwise each would be a
way around it. `/versions` (a version-number bump, no content write) is still
allowed on a frozen Registro.

### A4-10. `apply-regulation` is idempotent by refusing, not by no-op

If `doc.content` already contains the alert's `marker`, the endpoint 409s
(`ALREADY_APPLIED`) rather than appending the block twice or silently returning
200. 404 when the document's `norma` has no active alert at all.

### A4-11. `GET /documents/:code/regulation-alert` — the banner predicate, server-side

Not in the spec's route list; added because the brief defines the banner
predicate as *"the doc's norma has an active alert AND the content does not
already contain that alert's marker"*, and computing it once on the server beats
having the client re-derive it from a list. Returns
`{ alert: RegulationAlertDTO | null }`.

`GET /regulation-alerts` supports `?norma=` and `?includeInactive=true`. It is
read-only: nothing in the frontend authors alerts, so there is no POST/PATCH.

### A4-12. `doubleApproval` is read from the DB per request

`OrgConfig.doubleApproval` is admin-editable from the Configuración screen, so
it is fetched fresh inside each sign/approve handler rather than cached in
module scope. Falls back to `critical` (the seeded value) if the singleton row
is somehow missing.

### A4-13. Signature + status change are transactional

`prisma.$transaction` wraps the `DocumentSignature` insert, the `Document`
update, and the `writeAudit({ tx })` call, so a signature can never be recorded
without its status transition (or its audit row) and vice versa. Same for every
other mutating action in the router.

### A4-14. Test-suite note: two other suites read the audit log globally

`tests/auth.test.ts` asserts on `prisma.auditLogEntry.findFirst({ orderBy: { id:
'desc' } })` with **no `where`**, i.e. the newest row in the whole table. That is
only safe if nothing else is writing audit rows at the same time, so it fails
intermittently when two agents run `npm test` concurrently. Not this agent's
file to change, but it should be scoped to `{ where: { user: … } }`.
`tests/documents.test.ts` has one failing search assertion that is independent
of this router (it fails with these suites excluded too).
