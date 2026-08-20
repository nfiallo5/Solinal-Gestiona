/**
 * Server-side audit logging — the port of `makeAuditLog()` from
 * `src/context/AppStateContext.tsx`.
 *
 * ── Contract for route agents ──────────────────────────────────────────────
 * Audit entries are a SERVER SIDE EFFECT. The client never posts them and
 * there is no `POST /audit-logs`. Call `writeAudit` from every mutating
 * handler — including the ones that REJECT the request (`handleSign` in
 * Editor.tsx logs "Intento fallido…" / "Intento no autorizado…" and those
 * must keep being logged).
 *
 *   await writeAudit(req, `Aprobó y publicó el documento ${code}`);
 *
 * On routes where `requireAuth` has not run yet (POST /auth/login), pass the
 * actor explicitly:
 *
 *   await writeAudit(req, 'Inicio de sesión', { actor: { user: u.name, role: u.role } });
 *
 * Inside a `prisma.$transaction`, pass the transaction client so the audit row
 * rolls back with the rest of the work:
 *
 *   await prisma.$transaction(async (tx) => {
 *     await tx.document.update({ ... });
 *     await writeAudit(req, `Firmó el documento ${code}`, { tx });
 *   });
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Differences from the client-side original, both deliberate (see NOTES.md):
 *   - `id` comes from the Postgres sequence, not `max(id) + 1`.
 *   - `ip` is the real request IP (`req.ip`, X-Forwarded-For aware), not
 *     `192.168.1.${random}`.
 *   - `date` and `time` are both LOCAL-time. The original mixed a UTC date
 *     (`toISOString()`) with a local time (`toTimeString()`), which disagree
 *     for several hours a day in UTC-5.
 */
import type { Request } from 'express';
import type { AuditLogEntry, Prisma, RoleName } from '@prisma/client';
import { prisma } from '../prisma.js';

/** Anything you can call `.auditLogEntry.create()` on — the client or a tx. */
export type DbClient = Prisma.TransactionClient | typeof prisma;

export interface AuditActor {
  /** Display name, denormalized onto the row. */
  user: string;
  /** Role AT THE TIME OF THE ACTION, denormalized on purpose. */
  role: RoleName;
}

export interface WriteAuditOptions {
  /**
   * Who performed the action. Defaults to `req.user` (set by `requireAuth`).
   * REQUIRED on routes that run before authentication.
   */
  actor?: AuditActor;
  /** Write inside an open transaction instead of the shared client. */
  tx?: DbClient;
  /** Override the recorded IP. Defaults to `clientIp(req)`. */
  ip?: string;
  /** Override the timestamp. Defaults to now. */
  at?: Date;
}

/**
 * Append one audit entry.
 *
 * @param req    the Express request (used for `req.user` and `req.ip`)
 * @param action freeform human-readable Spanish description, e.g.
 *               `"Aprobó y publicó el documento POL-GER-003"`
 * @returns the created row
 * @throws {Error} if no actor can be determined (no `req.user`, no `actor`)
 */
export async function writeAudit(
  req: Request,
  action: string,
  options: WriteAuditOptions = {},
): Promise<AuditLogEntry> {
  const actor = options.actor ?? (req.user ? { user: req.user.name, role: req.user.role } : null);
  if (!actor) {
    throw new Error(
      'writeAudit(): no actor. Mount requireAuth before this route, or pass { actor }.',
    );
  }

  return writeAuditRaw({
    action,
    user: actor.user,
    role: actor.role,
    ip: options.ip ?? clientIp(req),
    at: options.at,
    tx: options.tx,
  });
}

export interface WriteAuditRawInput {
  action: string;
  user: string;
  role: RoleName;
  ip: string;
  at?: Date;
  tx?: DbClient;
}

/**
 * Request-free variant, for cron jobs, tests, and the seed script.
 * Prefer `writeAudit(req, …)` inside route handlers.
 */
export async function writeAuditRaw(input: WriteAuditRawInput): Promise<AuditLogEntry> {
  const db = input.tx ?? prisma;
  const at = input.at ?? new Date();

  return db.auditLogEntry.create({
    data: {
      action: input.action,
      user: input.user,
      role: input.role,
      date: formatAuditDate(at),
      time: formatAuditTime(at),
      ip: input.ip,
      createdAt: at,
    },
  });
}

/**
 * Real client IP. `app.set('trust proxy', 1)` in `app.ts` makes Express honour
 * `X-Forwarded-For`. IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is unwrapped so the
 * audit table stays readable.
 */
export function clientIp(req: Request): string {
  const raw = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}

/** "YYYY-MM-DD", local time. */
export function formatAuditDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "HH:mm", local time. */
export function formatAuditTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD HH:mm", the format `DocumentComment.date` uses. */
export function formatCommentDate(d: Date): string {
  return `${formatAuditDate(d)} ${formatAuditTime(d)}`;
}
