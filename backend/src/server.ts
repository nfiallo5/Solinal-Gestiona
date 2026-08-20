/**
 * Listen entrypoint. `createApp()` lives in app.ts so supertest can import the
 * app without binding a port.
 */
import { createApp } from './app.js';
import { env } from './env.js';
import { disconnectPrisma } from './prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[solinal-gestiona-backend] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`\n[solinal-gestiona-backend] ${signal} received, shutting down…`);
  server.close(() => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
  // Don't hang forever on lingering keep-alive sockets.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
