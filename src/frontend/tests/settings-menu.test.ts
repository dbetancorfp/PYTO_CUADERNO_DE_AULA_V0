// elementId: settings-menu (see views/dashboard/use-cases.md UC-04 — reopened: now a real,
// always-enabled navigation link to /configuracion/profesor, same pattern as the seven
// section cards in dashboard-cards.test.ts, not the disabled placeholder it used to be)
import { describe, it, expect } from 'bun:test';
import '../src/dashboard-view';
import type { DashboardView } from '../src/dashboard-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

async function mountAuthenticatedDashboard(): Promise<DashboardView> {
  const el = document.createElement('app-dashboard-view') as DashboardView;
  el.service = {
    getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
    logout: async () => {},
  } satisfies SessionApiService;
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: settings-menu', () => {
  it('is visible and enabled at the right end of the navbar', async () => {
    const el = await mountAuthenticatedDashboard();

    const settingsMenu = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="settings-menu"]')!;

    expect(settingsMenu).not.toBeNull();
    expect(settingsMenu.disabled).toBe(false);

    el.remove();
  });

  it('navigates to /configuracion/profesor when clicked', async () => {
    const el = await mountAuthenticatedDashboard();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="settings-menu"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const path = window.location.pathname;
    window.history.pushState({}, '', '/dashboard');

    expect(path).toBe('/configuracion/profesor');

    el.remove();
  });
});
