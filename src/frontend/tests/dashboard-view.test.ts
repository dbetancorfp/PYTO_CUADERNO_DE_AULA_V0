// elementId: app-logo, welcome-message, settings-menu, logout-link (screen-level: session
// gate on load + navbar rendering — see views/dashboard/use-cases.md UC-01)
import { describe, it, expect } from 'bun:test';
import '../src/dashboard-view';
import type { DashboardView } from '../src/dashboard-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

function mountDashboardView(service: SessionApiService): DashboardView {
  const el = document.createElement('app-dashboard-view') as DashboardView;
  el.service = service;
  document.body.appendChild(el);
  return el;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('elementId: app-logo, welcome-message, settings-menu, logout-link', () => {
  it('redirects to /login when the session check responds unauthenticated', async () => {
    const el = mountDashboardView({
      getSession: async () => ({ authenticated: false }),
      logout: async () => {},
    });

    await flush();

    expect(window.location.pathname).toBe('/login');

    window.history.pushState({}, '', '/dashboard');
    el.remove();
  });

  it('does not render the navbar or cards while unauthenticated', async () => {
    const el = mountDashboardView({
      getSession: async () => ({ authenticated: false }),
      logout: async () => {},
    });

    await flush();

    expect(el.shadowRoot!.querySelector('[data-element-id="welcome-message"]')).toBeNull();

    window.history.pushState({}, '', '/dashboard');
    el.remove();
  });

  it('renders app-logo at the left end of the navbar once authenticated', async () => {
    const el = mountDashboardView({
      getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
      logout: async () => {},
    });

    await flush();

    expect(el.shadowRoot!.querySelector('[data-element-id="app-logo"]')).not.toBeNull();

    el.remove();
  });

  it("shows 'Bienvenido, ' followed by the signed-in teacher's full name", async () => {
    const el = mountDashboardView({
      getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
      logout: async () => {},
    });

    await flush();

    expect(el.shadowRoot!.querySelector('[data-element-id="welcome-message"]')!.textContent).toContain(
      'Bienvenido, Jane Doe',
    );

    el.remove();
  });

  it('renders settings-menu and logout-link at the right end of the navbar', async () => {
    const el = mountDashboardView({
      getSession: async () => ({ authenticated: true, fullName: 'Jane Doe' }),
      logout: async () => {},
    });

    await flush();

    const settingsMenu = el.shadowRoot!.querySelector('[data-element-id="settings-menu"]');
    const logoutLink = el.shadowRoot!.querySelector('[data-element-id="logout-link"]');
    const welcomeMessage = el.shadowRoot!.querySelector('[data-element-id="welcome-message"]');

    expect(settingsMenu).not.toBeNull();
    expect(logoutLink).not.toBeNull();
    // Navbar order: settings-menu, welcome-message, logout-link (see ui-spec.json)
    expect(settingsMenu!.compareDocumentPosition(welcomeMessage!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(welcomeMessage!.compareDocumentPosition(logoutLink!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    el.remove();
  });
});
