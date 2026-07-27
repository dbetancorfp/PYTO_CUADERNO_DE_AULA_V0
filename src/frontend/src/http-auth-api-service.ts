// Concrete `AuthApiService` client, wired into `main.ts` at bootstrap — the real HTTP call
// against `POST /api/auth/login` (see views/login/api-contracts.md). frontend-implementer's
// `auth-api-service.ts` only declares the interface `LoginView` depends on (DIP); nothing
// upstream of e2e-engineer owns turning that into a real network call, since it's only
// needed once the app actually runs, not for any unit test (which injects a fake).
import type { AuthApiService, LoginOutcome } from './auth-api-service';

export class HttpAuthApiService implements AuthApiService {
  async login(email: string, password: string): Promise<LoginOutcome> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json()) as { message: string };

    if (response.ok) {
      return { success: true };
    }
    return { success: false, message: body.message };
  }
}
