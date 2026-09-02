/**
 * Loads and validates process configuration exactly once.
 * Import `env` anywhere instead of touching `process.env` directly.
 */
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  /** Comma-separated allowed browser origins. `*` allows any. */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(3),
  /** Optional: the /documents/:code/ai/* routes 503 with a clear message if unset,
   * rather than failing the whole server to boot over one feature's key. */
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

export const env = {
  ...parsed.data,
  /** Parsed form of CORS_ORIGIN. */
  corsOrigins: parsed.data.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export type Env = typeof env;
