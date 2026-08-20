/**
 * Shared user-account helpers used by both `/users` (admin-created accounts,
 * `src/routes/users.ts`) and `/auth/register` (public self-service signup,
 * `src/routes/auth.ts`). Kept out of either route module so neither has to
 * import the other.
 */
import { randomInt } from 'node:crypto';
import type { PasswordPolicy } from '@prisma/client';
import { HttpError } from '../middleware/error.js';

export const BCRYPT_ROUNDS = 10;

/**
 * Port of `initialsOf()` in `src/features/users/roleTheme.ts`. Note it slices
 * to **3**, not 2, despite every seeded `short` being two letters (see
 * NOTES.md § 20).
 */
export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

/** The rules behind the labels in `src/features/config/SecuritySection.tsx`. */
const passwordRules: Record<
  PasswordPolicy,
  { minLength: number; requireDigit: boolean; requireUpper: boolean; label: string }
> = {
  weak: { minLength: 6, requireDigit: false, requireUpper: false, label: 'mínimo 6 caracteres' },
  medium: {
    minLength: 8,
    requireDigit: true,
    requireUpper: false,
    label: 'mínimo 8 caracteres y un número',
  },
  strong: {
    minLength: 10,
    requireDigit: true,
    requireUpper: true,
    label: 'mínimo 10 caracteres, una mayúscula y un número',
  },
};

export function assertPasswordPolicy(password: string, policy: PasswordPolicy): void {
  const rule = passwordRules[policy];
  const failed =
    password.length < rule.minLength ||
    (rule.requireDigit && !/\d/.test(password)) ||
    (rule.requireUpper && !/[A-Z]/.test(password));
  if (failed) {
    throw HttpError.unprocessable(
      `La contraseña no cumple la política "${policy}" del sistema (${rule.label}).`,
    );
  }
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';

/** Cryptographically random temp password that satisfies every policy tier. */
export function generateTemporaryPassword(): string {
  const alphabet = UPPER + LOWER + DIGIT;
  const chars = [
    UPPER[randomInt(UPPER.length)] as string,
    LOWER[randomInt(LOWER.length)] as string,
    DIGIT[randomInt(DIGIT.length)] as string,
  ];
  while (chars.length < 14) chars.push(alphabet[randomInt(alphabet.length)] as string);
  // Fisher-Yates so the guaranteed characters are not always in positions 0-2.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}
