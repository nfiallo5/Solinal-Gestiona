/**
 * Lockout policy — the single source of truth for "is this account locked?".
 *
 * Extracted out of `src/routes/auth.ts` so that `src/middleware/auth.ts` can
 * apply the same expiry rule without importing a route module (which would
 * create a cycle: routes/auth already imports requireAuth from middleware/auth).
 *
 * Both the login route and `requireAuth` must agree on this, or a lock that has
 * expired in one place stays in force in the other — see NOTES.md § 17.
 */

/**
 * How long a lock lasts before it expires on its own.
 * Overridable with the `LOCKOUT_MINUTES` env var; defaults to 15 minutes.
 */
export const LOCKOUT_MINUTES: number = (() => {
  const raw = Number(process.env.LOCKOUT_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
})();

const LOCKOUT_MS = LOCKOUT_MINUTES * 60_000;

/** True while `lockedAt` is set and the auto-expiry window has not elapsed. */
export function isLockActive(lockedAt: Date | null, now: Date = new Date()): boolean {
  if (!lockedAt) return false;
  return now.getTime() - lockedAt.getTime() < LOCKOUT_MS;
}

/** Milliseconds until an active lock lifts by itself (0 if not locked). */
export function lockRemainingMs(lockedAt: Date | null, now: Date = new Date()): number {
  if (!isLockActive(lockedAt, now)) return 0;
  return LOCKOUT_MS - (now.getTime() - (lockedAt as Date).getTime());
}
