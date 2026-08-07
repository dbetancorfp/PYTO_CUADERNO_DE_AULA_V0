// Shared nav markup for `teacher-nav-link`/`training-catalog-nav-link`/
// `academic-year-nav-link`, rendered identically on all three Configuración screens (see
// views/configuracion/ui-spec.json's screen notes and use-cases.md UC-03) via one plain
// function, never a nested custom element — per CLAUDE.md's "no nested Shadow DOM"
// allowance for sharing behavior via plain functions.
//
// `training-catalog-nav-link` added 2026-08-04 for the Ciclos/Módulos redesign — it sits
// between `teacher-nav-link` and `academic-year-nav-link` in `NAV_LINKS`' order, per
// functional-spec.json's acceptance criteria for that elementId.
//
// `key-dates-nav-link` added 2026-08-06 for the Fechas señaladas screen, originally after
// `academic-year-nav-link`; reordered 2026-08-07 to sit before it in `NAV_LINKS`' order.
//
// 2026-08-06 visual redesign: matches dashboard-view.ts's top navbar style (card —
// `bg-white`/`shadow-md`/`rounded-lg` — instead of a bare bottom-border row) for cohesion
// across the app. Three-zone layout: `settings-nav-heading` ("Configuración") pinned to the
// far left like the dashboard's `app-logo`; the three screen links truly centered
// (`absolute left-1/2 -translate-x-1/2`, not just flexbox's `justify-between` middle slot,
// which would drift off-center whenever the left/right zones aren't equal width);
// `back-to-dashboard-link` ("Volver") pinned to the far right, playing the same "exit this
// screen" role `logout-link` plays in the dashboard navbar.
import { html, nothing, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';

export type SettingsScreen = 'profesor' | 'ciclos-modulos' | 'ano-academico' | 'fechas-senaladas';

interface NavLinkDef {
  elementId: 'teacher-nav-link' | 'training-catalog-nav-link' | 'academic-year-nav-link' | 'key-dates-nav-link';
  screen: SettingsScreen;
  label: string;
  route: string;
}

const NAV_LINKS: readonly NavLinkDef[] = [
  { elementId: 'teacher-nav-link', screen: 'profesor', label: 'Profesor', route: '/configuracion/profesor' },
  {
    elementId: 'training-catalog-nav-link',
    screen: 'ciclos-modulos',
    label: 'Ciclos/Módulos',
    route: '/configuracion/ciclos-modulos',
  },
  {
    elementId: 'key-dates-nav-link',
    screen: 'fechas-senaladas',
    label: 'Fechas señaladas',
    route: '/configuracion/fechas-senaladas',
  },
  {
    elementId: 'academic-year-nav-link',
    screen: 'ano-academico',
    label: 'Año académico',
    route: '/configuracion/ano-academico',
  },
];

export function renderSettingsNav(activeScreen: SettingsScreen): TemplateResult {
  return html`
    <nav class="relative flex items-center justify-between ${classesFor('card')} px-4 py-3">
      <span class="${classesFor('heading')}" data-element-id="settings-nav-heading">Configuración</span>

      <div class="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">
        ${NAV_LINKS.map((link) => {
          const isActive = link.screen === activeScreen;
          return html`
            <a
              class="${classesFor('link', 'link')} ${isActive ? 'font-semibold' : 'text-slate-500'}"
              data-element-id="${link.elementId}"
              tabindex="0"
              role="link"
              aria-current="${isActive ? 'page' : nothing}"
            >
              ${link.label}
            </a>
          `;
        })}
      </div>

      <a
        class="${classesFor('link', 'link')} text-slate-500"
        data-element-id="back-to-dashboard-link"
        tabindex="0"
        role="link"
      >
        Volver
      </a>
    </nav>
  `;
}

/**
 * Handles a click on either nav link, if `elementId` matches one — no-op (returns `true`
 * without navigating) when the clicked link's screen is already active. Returns `false`
 * when `elementId` isn't one of the two nav links, so callers can fall through to their
 * own click handling.
 */
export function handleSettingsNavClick(elementId: string): boolean {
  if (elementId === 'back-to-dashboard-link') {
    redirectTo('/dashboard');
    return true;
  }

  const link = NAV_LINKS.find((candidate) => candidate.elementId === elementId);
  if (!link) {
    return false;
  }
  if (window.location.pathname !== link.route) {
    redirectTo(link.route);
  }
  return true;
}
