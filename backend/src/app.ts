/**
 * Express app factory.
 *
 * Kept separate from `server.ts` so tests can do
 * `request(createApp()).get('/health')` without binding a port.
 *
 * ── For route agents ───────────────────────────────────────────────────────
 * Add your router in the ROUTES block below, between the two comment markers.
 * Everything above it (cors, body parsing, trust proxy) and everything below
 * it (404 fallback, error handler) is shared infrastructure — leave it alone,
 * and in particular keep `notFoundHandler`/`errorHandler` LAST or thrown
 * `HttpError`s will not be converted into JSON responses.
 * ───────────────────────────────────────────────────────────────────────────
 */
import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { configRouter } from './routes/config.js';
import { documentsRouter } from './routes/documents.js';
import { templatesRouter } from './routes/templates.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { documentWorkflowRouter } from './routes/documentWorkflow.js';
import { regulationAlertsRouter } from './routes/regulationAlerts.js';
import { documentTypesRouter } from './routes/documentTypes.js';

export function createApp(): Express {
  const app = express();

  // Behind one reverse proxy in production; makes `req.ip` honour
  // X-Forwarded-For, which `writeAudit()` records.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      credentials: false, // token goes in the Authorization header, not a cookie
    }),
  );

  // Document `content` is rich HTML and can get long.
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ===== ROUTES ============================================================
  // Every mount point is pre-wired so that the agents building these routers
  // in parallel each touch only their own file and never contend over app.ts.
  // DO NOT edit this block — implement inside the router modules themselves.
  app.use(healthRouter);
  app.use('/auth', authRouter);
  // Workflow mounts BEFORE documentsRouter: both live under /documents, and the
  // specific action paths (/:code/sign, /:code/versions, …) must get first
  // refusal before the generic /:code handlers can match them.
  app.use('/documents', documentWorkflowRouter);
  app.use('/documents', documentsRouter);
  app.use('/templates', templatesRouter);
  app.use('/users', usersRouter);
  app.use('/config', configRouter);
  app.use('/audit-logs', auditLogsRouter);
  app.use('/regulation-alerts', regulationAlertsRouter);
  app.use('/document-types', documentTypesRouter);
  // ===== END ROUTES ========================================================

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
