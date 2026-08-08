import { html, render } from 'lit-html';
import { attachSharedStyles } from './styles/shadow-styles';
import { classesFor } from './styles/classes-for';
import type { SessionApiService } from './session-api-service';

// Reopened per views/dashboard/use-cases.md UC-04: settings-menu is now a real,
// always-enabled navigation link, same pattern as the seven SECTION_CARDS below, just
// with a fixed destination instead of a card position.
const SETTINGS_MENU_ROUTE = '/configuracion/profesor';

interface SectionCard {
  elementId: string;
  label: string;
  icon: string;
  route: string;
}

// Fixed display order per views/dashboard/functional-spec.json globalRules and
// use-cases.md UC-03. Route slugs are an explicit inference — none of these seven
// destination views exist yet (see src/frontend/tests/dashboard-cards.test.ts header).
const SECTION_CARDS: readonly SectionCard[] = [
  { elementId: 'calendar-card', label: 'Calendario', icon: 'calendar', route: '/calendario' },
  {
    elementId: 'evaluation-criteria-card',
    label: 'Criterios de evaluación',
    icon: 'clipboard-check',
    route: '/criterios-evaluacion',
  },
  { elementId: 'work-units-card', label: 'Unidades de Trabajo', icon: 'book-open', route: '/unidades-trabajo' },
  { elementId: 'student-roster-card', label: 'Listado de alumnos', icon: 'users', route: '/listado-alumnos' },
  { elementId: 'diary-card', label: 'Diario', icon: 'notebook', route: '/diario' },
  {
    elementId: 'student-detail-card',
    label: 'Vista individual de alumno',
    icon: 'user',
    route: '/alumno',
  },
  { elementId: 'reports-card', label: 'Informes', icon: 'file-text', route: '/informes' },
];

/**
 * Resolves `path` against the current page's URL before navigating. Mirrors
 * `login-view.ts`'s `redirectTo` helper (see that file for why: a plain relative
 * assignment degrades silently against happy-dom's opaque `about:blank` starting page,
 * the default in this project's unit-test environment).
 */
function redirectTo(path: string): void {
  try {
    window.location.href = new URL(path, window.location.href).href;
  } catch {
    window.location.href = new URL(path, 'http://localhost').href;
  }
}

/**
 * Dashboard screen — single Shadow DOM, every element (`app-logo`, `settings-menu`,
 * `welcome-message`, `logout-link`, and the seven section cards) is a plain element
 * inside it, per CLAUDE.md's "no nested Shadow DOM" rule. See `views/dashboard/ui-spec.json`
 * for element design and `views/dashboard/functional-spec.json` for the business rules
 * implemented here.
 */
export class DashboardView extends HTMLElement {
  private _service: SessionApiService | null = null;
  private _fullName: string | null = null;
  private _disposables: Array<() => void> = [];

  set service(value: SessionApiService) {
    this._service = value;
  }

  get service(): SessionApiService {
    if (this._service === null) {
      throw new Error('DashboardView.service must be set before use');
    }
    return this._service;
  }

  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    attachSharedStyles(this.shadowRoot!);
    this._render();

    const onClick = (event: Event): void => this._handleClick(event);
    this.shadowRoot!.addEventListener('click', onClick);
    this._disposables.push(() => this.shadowRoot!.removeEventListener('click', onClick));

    void this._loadSession();
  }

  disconnectedCallback(): void {
    this._disposables.forEach((dispose) => dispose());
    this._disposables = [];
  }

  private async _loadSession(): Promise<void> {
    const outcome = await this.service.getSession();

    if (!outcome.authenticated) {
      redirectTo('/login');
      return;
    }

    this._fullName = outcome.fullName;
    this._render();
  }

  private _handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;

    const elementId = target.dataset.elementId;

    if (elementId === 'logout-link') {
      void this._handleLogout();
      return;
    }

    if (elementId === 'settings-menu') {
      redirectTo(SETTINGS_MENU_ROUTE);
      return;
    }

    const card = SECTION_CARDS.find((candidate) => candidate.elementId === elementId);
    if (card) {
      redirectTo(card.route);
    }
  }

  private async _handleLogout(): Promise<void> {
    try {
      await this.service.logout();
    } finally {
      redirectTo('/login');
    }
  }

  private _render(): void {
    if (this._fullName === null) {
      // Unauthenticated or still resolving the session check — render nothing until
      // `_loadSession` either redirects away or confirms a valid session.
      render(html``, this.shadowRoot!);
      return;
    }

    render(
      html`
        <div class="flex flex-col gap-6 p-4">
          <nav class="${classesFor('card')} flex items-center justify-between px-4 py-3">
            <h1 class="${classesFor('heading')}" data-element-id="app-logo">Cuaderno de Aula</h1>
            <div class="flex items-center gap-4">
              <button
                type="button"
                class="${classesFor('icon-button', 'ghost', 'sm')}"
                data-element-id="settings-menu"
                aria-label="Configuración"
                title="Configuración"
              >
                Config
              </button>
              <p class="${classesFor('paragraph')}" data-element-id="welcome-message">
                Bienvenido, ${this._fullName}
              </p>
              <a class="${classesFor('link', 'link')}" data-element-id="logout-link" tabindex="0" role="link">
                Salir
              </a>
            </div>
          </nav>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            ${SECTION_CARDS.map(
              (card) => html`
                <button
                  type="button"
                  class="${classesFor('card', 'interactive')} flex flex-col items-center gap-2 p-6 text-center"
                  data-element-id="${card.elementId}"
                >
                  <span aria-hidden="true" class="text-xs uppercase tracking-wide text-slate-400">${card.icon}</span>
                  <span class="${classesFor('heading')}">${card.label}</span>
                </button>
              `,
            )}
          </div>
        </div>
      `,
      this.shadowRoot!,
    );
  }
}

customElements.define('app-dashboard-view', DashboardView);
