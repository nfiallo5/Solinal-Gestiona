/**
 * PrismaClient singleton.
 *
 * Import `prisma` from here everywhere — never `new PrismaClient()` in a
 * route module. `tsx watch` re-evaluates modules on every save, so the client
 * is stashed on `globalThis` to avoid leaking a connection pool per reload.
 */
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as { __solinalPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__solinalPrisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.__solinalPrisma = prisma;
}

/** Close the pool — call from tests' `afterAll` and on SIGTERM. */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
