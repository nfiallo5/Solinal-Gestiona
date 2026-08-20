/**
 * Prepares the test database: applies all migrations to TEST_DATABASE_URL and
 * seeds it. Run once before `npm test`, and again after adding a migration.
 *
 *   npm run test:db:reset
 *
 * A tiny script rather than a `dotenv-cli` dependency, since the brief asks
 * for a minimal dependency list.
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import 'dotenv/config';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('TEST_DATABASE_URL is not set in .env');
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: testUrl };

function run(args) {
  const res = spawnSync('npx', args, { stdio: 'inherit', env, shell: false });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

console.log(`Preparing test database: ${testUrl.replace(/:[^:@/]*@/, ':***@')}`);
// Non-destructive: applies pending migrations, then re-seeds to the baseline.
// (Use `npx prisma migrate reset` manually if you want a true wipe.)
run(['prisma', 'migrate', 'deploy']);
run(['prisma', 'db', 'seed']);
