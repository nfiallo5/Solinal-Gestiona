/**
 * zod request validation.
 *
 * `validate({ body, params, query })` parses each supplied schema and
 * **replaces** `req.body` / `req.params` / `req.query` with the parsed result,
 * so downstream handlers get the coerced/transformed values (this matters for
 * `zEstadoWire`, which transforms `"En aprobación"` into the Prisma enum).
 * A failure short-circuits with a 400 via the central error handler.
 *
 * Because Express 5 makes `req.query` a getter-only property, the parsed query
 * is also exposed as `req.validatedQuery` — prefer that one.
 *
 * @example
 *   const zBody = z.object({ title: z.string().min(1), estado: zEstadoWire });
 *   router.post('/documents', requireAuth, validate({ body: zBody }), asyncHandler(async (req, res) => {
 *     const body = req.body as z.infer<typeof zBody>;   // already parsed
 *   }));
 *
 * For full type inference without the cast, use the `validated<>` helper type:
 *   type Body = Validated<typeof zBody>;
 */
import type { RequestHandler } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { HttpError } from './error.js';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/** Convenience alias: the parsed output type of a zod schema. */
export type Validated<S extends ZodTypeAny> = z.infer<S>;

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      if (schemas.params) {
        // req.params is writable in Express 5.
        req.params = schemas.params.parse(req.params ?? {}) as typeof req.params;
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query ?? {});
        req.validatedQuery = parsedQuery;
        // Best effort: Express 5 defines `query` as a getter on the prototype,
        // so assigning it directly throws. Shadow it with an own property.
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(HttpError.badRequest('Datos de la solicitud inválidos.', err.issues));
        return;
      }
      next(err);
    }
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Output of the `query` schema passed to `validate()`, if any. */
      validatedQuery?: unknown;
    }
  }
}
