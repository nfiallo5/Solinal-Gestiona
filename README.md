# Solinal Gestiona

Document-management system (ISO 9001/22000 compliance docs, approval
workflows, audit trail) for a food-processing company.

## Layout

Two independent packages, each with its own `package.json`/lockfile/`node_modules`,
so they can be **deployed to different hosts**:

```
frontend/   Vite + React + TypeScript SPA        → deploy to Vercel
backend/    Express + Prisma + PostgreSQL API     → deploy to Render (or any Node host + Postgres)
```

Neither package depends on the other's tooling — Vercel only ever sees
`frontend/`, Render only ever sees `backend/`. The root `package.json` is
just a convenience wrapper for local development (see below); it is not
required by either deploy target.

## Local development (both at once)

```bash
npm run install:all   # npm install in backend/ and frontend/
npm run dev            # runs both concurrently: API on :3001, Vite on :5173
```

`frontend`'s dev server proxies `/api/*` to the backend (see
`frontend/vite.config.ts`), so the browser only ever talks to its own
origin — no CORS setup needed locally.

The backend needs a running PostgreSQL and a `backend/.env` (copy from
`backend/.env.example`); see `backend/README.md` for the full local setup
(migrations, seed data, demo logins).

## Building both

```bash
npm run build           # backend (tsc) then frontend (tsc + vite build)
npm run build:backend    # backend/dist
npm run build:frontend   # frontend/dist
```

## Deploying separately

**Frontend → Vercel**
- New Project → import this repo → set **Root Directory: `frontend`**.
- Vercel auto-detects Vite (`npm run build`, output `dist`); `frontend/vercel.json`
  already has the SPA rewrite so client-side routes survive a refresh.
- Set env var `VITE_API_URL` to the deployed backend's URL (e.g.
  `https://solinal-api.onrender.com`) — without it the build defaults to a
  same-origin `/api` proxy, which only exists in local dev.

**Backend → Render**
- New Web Service → import this repo → set **Root Directory: `backend`**.
- Build command: `npm install && npm run build` (the `postinstall` hook runs
  `prisma generate` automatically). Start command: `npm start`.
- Add a Render PostgreSQL instance and set `DATABASE_URL` to its connection
  string; set `JWT_SECRET` to a real random value (not the dev default) and
  `CORS_ORIGIN` to the deployed frontend's origin.
- Run migrations + seed once after the first deploy (Render's shell, or a
  one-off job): `npm run prisma:migrate && npm run prisma:seed`.

## Notes / assumptions

- This split assumes the two services talk over HTTP via `VITE_API_URL` /
  `CORS_ORIGIN`, which is already how `frontend/src/lib/api.ts` is built —
  no code changes were needed for the split itself, only the file layout.
- No CI is configured yet; each platform builds independently from its own
  Root Directory on every push to the branch you connect.
