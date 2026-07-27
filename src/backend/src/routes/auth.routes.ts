// elementId: login-button (HTTP contract side of UC-01 — see views/login/api-contracts.md
// POST /api/auth/login)
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service';

const loginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const ERROR_MESSAGES = {
  invalidCredentials: 'Incorrect email or password',
  accountLocked: 'This account has been locked due to too many failed attempts. Contact support.',
} as const;

export function authRouter(authService: AuthService): Router {
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
      res.status(200).json({ message: 'Login successful' });
      return;
    }
    if (result.outcome === 'account-locked') {
      res.status(403).json({ message: ERROR_MESSAGES.accountLocked });
      return;
    }
    res.status(401).json({ message: ERROR_MESSAGES.invalidCredentials });
  });

  return router;
}
