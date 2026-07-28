// elementId: settings-menu (see views/dashboard/use-cases.md UC-04 — explicitly
// non-functional placeholder, not a stub pretending to work)
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

describe('elementId: settings-menu', () => {
  it('renders disabled', async () => {
    const el = await mountAuthenticatedDashboard({
      getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
      logout: async () => {},
    });

    const settingsMenu = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="settings-menu"]')!;

    expect(settingsMenu.disabled).toBe(true);

    el.remove();
  });

  it('exposes a non-availability indicator (aria-disabled or a title/tooltip)', async () => {
    const el = await mountAuthenticatedDashboard({
      getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
      logout: async () => {},
    });

    const settingsMenu = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="settings-menu"]')!;

    const hasIndicator =
      settingsMenu.getAttribute('aria-disabled') === 'true' || settingsMenu.title.length > 0;
    expect(hasIndicator).toBe(true);

    el.remove();
  });

  it('opens no menu and sends no request when clicked', async () => {
    let sessionCalls = 0;
    let logoutCalls = 0;
    const el = await mountAuthenticatedDashboard({
      getSession: async () => {
        sessionCalls += 1;
        return { authenticated: true, fullName: 'Jane Doe' };
      },
      logout: async () => {
        logoutCalls += 1;
      },
    });
    sessionCalls = 0; // ignore the mount-time call, only count calls made by the click below

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="settings-menu"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sessionCalls).toBe(0);
    expect(logoutCalls).toBe(0);

    el.remove();
  });
});
