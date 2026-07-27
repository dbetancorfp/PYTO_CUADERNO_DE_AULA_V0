// Frontend-side contract for authentication, consumed by `login-view.ts`. Implements the
// `POST /api/auth/login` endpoint described in `views/login/api-contracts.md` — this file
// only declares the shape components depend on (DIP); the real HTTP client wiring it to
// `fetch` is assembled once, at bootstrap, by `e2e-engineer` (see CLAUDE.md's
// `src/frontend/src/main.ts` entry).

export type LoginOutcome = { success: true } | { success: false; message: string };

export interface AuthApiService {
  login(email: string, password: string): Promise<LoginOutcome>;
}
