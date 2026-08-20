# Solinal Gestiona — backend

REST API + PostgreSQL for the Solinal Gestiona document-management frontend
(the Vite app in `../frontend`). Node + TypeScript, Express 5, Prisma, JWT +
bcrypt, zod, vitest + supertest.

This is a **two-package monorepo**: the frontend lives in `../frontend`, the
backend lives here — each with its own `package.json`/lockfile so they can be
deployed independently (e.g. frontend on Vercel, backend+DB on Render). The
root `package.json` only adds thin convenience scripts (`npm run dev`,
`npm run build`, ...) that shell out to both; neither deploy target needs it.

---

## Quick start (local PostgreSQL)

> **Docker is not installed on this machine.** `docker-compose.yml` ships for
> other environments, but everything below uses the system PostgreSQL 16 that
> is already running on `127.0.0.1:5432` and on the unix socket
> `/var/run/postgresql`. TCP auth needs a password we do not have; unix-socket
> peer auth works, so the connection string uses the socket.

```bash
cd backend
npm install

# One-time: create the two databases (peer auth, no password).
createdb solinal_gestiona
createdb solinal_gestiona_test

cp .env.example .env      # then edit — or use the .env already committed locally
```

`.env` for this machine:

```ini
DATABASE_URL="postgresql://nfiallo@localhost/solinal_gestiona?host=/var/run/postgresql"
TEST_DATABASE_URL="postgresql://nfiallo@localhost/solinal_gestiona_test?host=/var/run/postgresql"
PORT=3001
JWT_SECRET="dev-only-insecure-secret-change-me"
CORS_ORIGIN="http://localhost:5173,http://localhost:8080"
```

Then:

```bash
npm run prisma:migrate     # apply migrations (prisma migrate dev)
npm run prisma:seed        # load the demo data — safe to re-run
npm run dev                # http://localhost:3001
curl localhost:3001/health
```

## With Docker (other machines)

```bash
docker compose up -d
# then point DATABASE_URL at it:
#   postgresql://solinal:solinal@localhost:5432/solinal_gestiona?schema=public
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` — API with hot reload |
| `npm run build` | `tsc` → `dist/` |
| `npm start` | run the compiled `dist/server.js` |
| `npm test` | vitest, against `TEST_DATABASE_URL` |
| `npm run test:db:reset` | apply migrations + seed the **test** database |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:seed` | `prisma db seed` |
| `npm run prisma:generate` | regenerate Prisma Client after a schema edit |

Run `npm run test:db:reset` once before the first `npm test`, and again
whenever you add a migration.

---

## What the seed loads

A verbatim port of `../frontend/src/data/seed.ts` plus the demo logins from
`../frontend/src/features/auth/credentials.ts`, so the app looks identical to
the in-memory version on first run:

7 documents · 4 templates · 4 audit logs · 2 comments · 5 users · 1 org config
· 1 regulation alert.

Demo logins (passwords are bcrypt-hashed in the DB):

| email | password | name | role |
|---|---|---|---|
| admin@solinal.com | admin2026 | Erick Murillo | Administrador |
| elaborador@solinal.com | elaborador2026 | Nicolas Fiallo | Elaborador |
| revisor@solinal.com | revisor2026 | Ana Torres | Revisor |
| aprobador@solinal.com | aprobador2026 | Carlos Ruiz | Aprobador |
| lector@solinal.com | lector2026 | Lector Simulado | Lector |

Re-running the seed restores these rows to their baseline; it does not
duplicate them and does not delete rows created at runtime.

---

## Layout

```
backend/
  prisma/
    schema.prisma        every model + enum, heavily commented
    migrations/          generated; commit these
    seed.ts              port of ../src/data/seed.ts
  scripts/
    test-db-reset.mjs    migrate + seed the test DB
  src/
    env.ts               validated process config — import `env`, not process.env
    prisma.ts            PrismaClient singleton
    app.ts               createApp() — register new routers in the ROUTES block
    server.ts            listen entrypoint (port from env, default 3001)
    middleware/
      auth.ts            requireAuth, requireRole, getAuthUser, AuthUser
      validate.ts        validate({ body, params, query })
      error.ts           HttpError, asyncHandler, notFoundHandler, errorHandler
    lib/
      audit.ts           writeAudit() — server-side makeAuditLog()
      serialize.ts       Prisma rows -> the exact JSON the frontend expects
      enums.ts           Spanish enum vocabulary + wire-format mapping
      documentCode.ts    TIPO-AREA-NNN generation, ported from docStyles.ts
      jwt.ts             signToken / verifyToken / bearerFromHeader
      demoContent.ts     the aiEngine.ts HTML blocks, server-side
    routes/
      health.ts          GET /health
  tests/
    setup.ts             redirects the process at TEST_DATABASE_URL
    foundation.test.ts   smoke tests for the shared seams
  NOTES.md               divergences, guesses, open questions — READ THIS
```

---

## Adding a route

1. Create `src/routes/<feature>.ts` exporting a `Router`.
2. Register it inside the `ROUTES` block in `src/app.ts` — above
   `notFoundHandler` / `errorHandler`, which must stay last.
3. Gate it: `requireAuth`, then `requireRole('Administrador')` etc.
4. Validate input with `validate({ body: zSomething })`.
5. Throw `HttpError.notFound(...)` / `.forbidden(...)` — never
   `res.status(...).json({ error })` by hand.
6. Serialize output with the helpers in `lib/serialize.ts`. **Never return a
   raw Prisma row** — `estado` and `periodicidadRevision` need wire mapping
   (see NOTES.md §1).
7. Call `await writeAudit(req, '…')` on every mutation, including rejections.

```ts
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole, getAuthUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { writeAudit } from '../lib/audit.js';
import { documentInclude, serializeDocument } from '../lib/serialize.js';

export const documentsRouter: Router = Router();

documentsRouter.get(
  '/:code',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await prisma.document.findUnique({
      where: { code: req.params.code },
      include: documentInclude,
    });
    if (!row) throw HttpError.notFound(`Documento ${req.params.code} no encontrado.`);
    res.json(serializeDocument(row));
  }),
);
```

Note the `.js` extensions on relative imports — this package is ESM with
`moduleResolution: NodeNext`.

---

## Error response shape

Every error, from any layer, comes back as:

```json
{ "error": { "message": "…", "code": "NOT_FOUND", "details": {} } }
```

Prisma errors are translated automatically: `P2002` → 409 `UNIQUE_VIOLATION`,
`P2003` → 400 `FOREIGN_KEY_VIOLATION`, `P2025` → 404 `NOT_FOUND`. Zod errors →
400 `VALIDATION_ERROR` with the issue list in `details`.

---

## Auth

`POST /auth/login` returns `{ token, user }`. The frontend keeps the token in
`localStorage` and sends `Authorization: Bearer <token>` — no cookies, no CSRF
layer, no refresh rotation (project decision). `requireAuth` re-reads the user
row on every request, so a role change takes effect immediately.

---

Read **`NOTES.md`** before changing anything: it records the deliberate
divergences from the frontend's current behaviour (per-document section lock,
real IPs in the audit log, enum wire mapping, server-side lockout, and more).
