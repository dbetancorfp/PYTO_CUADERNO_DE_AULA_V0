// Shared Express param-validation middleware — every route in this app that takes an `:id`
// URL param treats "id doesn't match a row owned by this teacher" as 404 (see
// views/configuracion/api-contracts.md). A malformed id (not a syntactically valid UUID)
// must resolve to that same 404 instead of ever reaching the repository layer: Postgres'
// `uuid` column type throws (error code 22P02, "invalid input syntax for type uuid") for
// anything that isn't, which the in-memory backend used by unit tests can't reproduce since
// its store tolerates any string as a key. Register once per router via
// `router.param('id', requireValidUuidParam)` so every `:id` route on that router gets the
// check without repeating it per handler.
import type { NextFunction, Request, Response } from 'express';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireValidUuidParam(req: Request, res: Response, next: NextFunction, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  next();
}
