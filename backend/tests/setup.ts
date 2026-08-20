/**
 * Vitest global setup.
 *
 * Points the whole process at TEST_DATABASE_URL (a separate
 * `solinal_gestiona_test` database) BEFORE `src/env.ts` or PrismaClient are
 * imported, so tests never touch dev data.
 *
 * Prepare the test DB once with:
 *   npm run test:db:reset
 */
import 'dotenv/config';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret';
