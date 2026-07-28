// Concrete `SessionApiService` client, wired into `main.ts` at bootstrap — the real HTTP
// calls against `GET /api/auth/session` and `POST /api/auth/logout` (both owned by Login,
// see views/login/api-contracts.md; reused as-is per views/dashboard/api-contracts.md).
// `session-api-service.ts` only declares the interface `DashboardView` depends on (DIP).
import type { SessionApiService, SessionOutcome } from './session-api-service';

export class HttpSessionApiService implements SessionApiService {
  async getSession(): Promise<SessionOutcome> {
    const response = await fetch('/api/auth/session');

    if (!response.ok) {
      return { authenticated: false };
    }

    const body = (await response.json()) as { fullName: string };
    return { authenticated: true, fullName: body.fullName };
  }

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  }
}
