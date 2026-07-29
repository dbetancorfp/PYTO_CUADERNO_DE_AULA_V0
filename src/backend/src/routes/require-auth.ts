// Shared Express middleware every Configuración route uses to identify the signed-in
// teacher (see views/configuracion/api-contracts.md's "requires a valid session... only
// ever reads/writes the signed-in teacher's own rows" rule, repeated on every endpoint).
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { SessionService } from '../services/session.service';

/** Cookie name carrying the opaque session lookup key — same as auth.routes.ts's own
 * SESSION_COOKIE constant (kept local here to avoid a circular import between the two
 * route modules; both must stay in sync with views/login/api-contracts.md). */
const SESSION_COOKIE = 'session_id';

function readSessionId(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[SESSION_COOKIE];
}

export function requireAuth(sessionService: SessionService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = sessionService.resolve(readSessionId(req));
    if (!session) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    res.locals.teacherId = session.id;
    next();
  };
}
