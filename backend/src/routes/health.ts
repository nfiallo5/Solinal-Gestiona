/**
 * `GET /health` — liveness + DB reachability smoke test.
 * Unauthenticated on purpose. Handy for `curl localhost:3001/health`.
 */
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../middleware/error.js';

export const healthRouter: Router = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    res.status(200).json({
      status: 'ok',
      service: 'solinal-gestiona-backend',
      database,
      timestamp: new Date().toISOString(),
    });
  }),
);
