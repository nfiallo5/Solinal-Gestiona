/**
 * Central error handling.
 *
 * Route agents: throw `HttpError` (or one of the `HttpError.*` shorthands)
 * from anywhere inside a handler and this middleware turns it into a JSON
 * response. Wrap async handlers in `asyncHandler` so rejected promises land
 * here too (Express 5 forwards them automatically, but `asyncHandler` keeps
 * the typing tidy and works the same either way).
 *
 * Response body is always: `{ error: { message, code?, details? } }`.
 */
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../env.js';

/**
 * An error with an HTTP status attached.
 *
 * @example
 *   throw HttpError.notFound(`Documento ${code} no encontrado`);
 *   throw new HttpError(409, 'Versión desactualizada', { code: 'STALE_VERSION', details: { serverVersion } });
 */
export class HttpError extends Error {
  readonly status: number;
  /** Stable machine-readable code, e.g. `"STALE_VERSION"`. Optional. */
  readonly code: string | undefined;
  /** Arbitrary JSON payload merged into the response body. Optional. */
  readonly details: unknown;

  constructor(
    status: number,
    message: string,
    options?: { code?: string; details?: unknown; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'HttpError';
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
    Error.captureStackTrace?.(this, HttpError);
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, message, { code: 'BAD_REQUEST', details });
  }
  static unauthorized(message = 'No autenticado.', details?: unknown) {
    return new HttpError(401, message, { code: 'UNAUTHORIZED', details });
  }
  static forbidden(message = 'No autorizado.', details?: unknown) {
    return new HttpError(403, message, { code: 'FORBIDDEN', details });
  }
  static notFound(message = 'Recurso no encontrado.', details?: unknown) {
    return new HttpError(404, message, { code: 'NOT_FOUND', details });
  }
  static conflict(message: string, details?: unknown) {
    return new HttpError(409, message, { code: 'CONFLICT', details });
  }
  static locked(message: string, details?: unknown) {
    return new HttpError(423, message, { code: 'LOCKED', details });
  }
  static unprocessable(message: string, details?: unknown) {
    return new HttpError(422, message, { code: 'UNPROCESSABLE', details });
  }
}

/** Wrap an async route handler so rejections reach the error middleware. */
export function asyncHandler<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** 404 fallback — mount AFTER all routes, BEFORE `errorHandler`. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

/** Terminal error middleware — mount LAST. */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) return next(err);

  const { status, body } = normalize(err);

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(status).json(body);
};

interface ErrorBody {
  error: { message: string; code?: string; details?: unknown };
}

function normalize(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: {
        error: {
          message: err.message,
          ...(err.code ? { code: err.code } : {}),
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          message: 'Datos de la solicitud inválidos.',
          code: 'VALIDATION_ERROR',
          details: err.issues,
        },
      },
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Unique constraint — e.g. signing the same document twice.
      case 'P2002':
        return {
          status: 409,
          body: {
            error: {
              message: 'El registro ya existe.',
              code: 'UNIQUE_VIOLATION',
              details: err.meta,
            },
          },
        };
      // Foreign key constraint.
      case 'P2003':
        return {
          status: 400,
          body: {
            error: {
              message: 'Referencia inválida.',
              code: 'FOREIGN_KEY_VIOLATION',
              details: err.meta,
            },
          },
        };
      // Record not found (findUniqueOrThrow / update / delete).
      case 'P2025':
        return {
          status: 404,
          body: { error: { message: 'Recurso no encontrado.', code: 'NOT_FOUND' } },
        };
      default:
        break;
    }
  }

  const message =
    env.NODE_ENV === 'production'
      ? 'Error interno del servidor.'
      : err instanceof Error
        ? err.message
        : String(err);

  return { status: 500, body: { error: { message, code: 'INTERNAL_ERROR' } } };
}
