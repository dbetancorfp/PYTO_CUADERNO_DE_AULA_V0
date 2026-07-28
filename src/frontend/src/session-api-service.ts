// Frontend-side contract for the signed-in teacher's session, consumed by
// `dashboard-view.ts`. Implements the `GET /api/auth/session` and `POST /api/auth/logout`
// endpoints described in `views/login/api-contracts.md` (reused as-is by
// `views/dashboard/api-contracts.md` — this view introduces no new endpoints) — this file
// only declares the shape components depend on (DIP); the real HTTP client wiring it to
// `fetch` lives in `http-session-api-service.ts` and is assembled at bootstrap in `main.ts`.

export type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };

export interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}
