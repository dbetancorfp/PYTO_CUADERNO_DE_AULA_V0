// elementId: logout-link (see views/dashboard/use-cases.md UC-02)
import { describe, it, expect } from 'bun:test';
import '../src/dashboard-view';
import type { DashboardView } from '../src/dashboard-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

async function mountAuthenticatedDashboard(service: SessionApiService): Promise<DashboardView> {
  const el = document.createElement('app-dashboard-view') as DashboardView;
  el.service = service;
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: logout-link', () => {
  it('calls service.logout() when clicked', async () => {
    let called = false;
    const el = await mountAuthenticatedDashboard({
      getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
      logout: async () => {
        called = true;
      },
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="logout-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(called).toBe(true);

    window.history.pushState({}, '', '/dashboard');
    el.remove();
  });

  it('redirects to /login after the logout response', async () => {
    const el = await mountAuthenticatedDashboard({
      getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
      logout: async () => {},
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="logout-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/login');

    window.history.pushState({}, '', '/dashboard');
    el.remove();
  });
});
