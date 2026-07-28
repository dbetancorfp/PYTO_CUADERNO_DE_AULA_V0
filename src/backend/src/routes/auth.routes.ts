// elementId: login-button (HTTP contract side of UC-01 — see views/login/api-contracts.md
// POST /api/auth/login), session-guard (GET /api/auth/session), logout-session
// (POST /api/auth/logout)
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service';
import type { SessionService } from '../services/session.service';

const loginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const ERROR_MESSAGES = {
  invalidCredentials: 'Incorrect email or password',
  accountLocked: 'This account has been locked due to too many failed attempts. Contact support.',
  notAuthenticated: 'Not authenticated',
} as const;

/** Cookie name carrying the opaque session lookup key (see views/login/api-contracts.md —
 * no JWT, no encoded payload). */
const SESSION_COOKIE = 'session_id';

function readSessionId(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[SESSION_COOKIE];
}

export function authRouter(authService: AuthService, sessionService: SessionService): Router {
  const router = Router();

  router.post('/login', async (req: Request, res: Response) => {
    const parseResult = loginRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ message: 'email and password are required' });
      return;
    }

    const { email, password } = parseResult.data;
    const result = await authService.login(email, password);

    if (result.outcome === 'success') {
      const fullName = (await authService.fullNameFor(email)) ?? '';
      const sessionId = sessionService.start({ fullName });
      res.cookie(SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: 'lax', path: '/' });
      res.status(200).json({ message: 'Login successful' });
      return;
    }
    if (result.outcome === 'account-locked') {
      res.status(403).json({ message: ERROR_MESSAGES.accountLocked });
      return;
    }
    res.status(401).json({ message: ERROR_MESSAGES.invalidCredentials });
  });

  router.get('/session', (req: Request, res: Response) => {
    const user = sessionService.resolve(readSessionId(req));
    if (!user) {
      res.status(401).json({ message: ERROR_MESSAGES.notAuthenticated });
      return;
    }
    res.status(200).json({ fullName: user.fullName });
  });

  router.post('/logout', (req: Request, res: Response) => {
    sessionService.end(readSessionId(req));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(200).json({ message: 'Logged out' });
  });

  return router;
}
