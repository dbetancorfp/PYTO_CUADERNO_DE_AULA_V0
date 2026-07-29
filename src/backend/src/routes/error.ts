// Centralized mapping of domain error codes -> HTTP status (see
// tecnologias/tecnologia_code.md's STATUS_MAP convention and
// views/configuracion/api-contracts.md's error code table). No route handler decides the
// HTTP status directly for a DomainError — this is the single place that does.
import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '../errors/domain-error';

const STATUS_MAP: Record<string, number> = {
  DUPLICATE_NAME: 409,
  HAS_DEPENDENTS: 409,
  IS_CURRENT: 409,
  INVALID_CREDENTIALS: 401,
};

export function statusForDomainErrorCode(code: string): number {
  return STATUS_MAP[code] ?? 500;
}

/**
 * Express 5 auto-forwards exceptions thrown from `async` route handlers here (see
 * tecnologias/tecnologia_code.md) — routes never need a manual try/catch for a DomainError.
 * Must be registered as the LAST `app.use(...)` (see app.ts).
 */
export function domainErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof DomainError) {
    res.status(statusForDomainErrorCode(err.code)).json({
      message: err.message,
      code: err.code,
      ...err.details,
    });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
}
