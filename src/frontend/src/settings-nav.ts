// Shared nav markup for `teacher-nav-link`/`training-catalog-nav-link`/
// `academic-year-nav-link`, rendered identically on all three Configuración screens (see
// views/configuracion/ui-spec.json's screen notes and use-cases.md UC-03) via one plain
// function, never a nested custom element — per CLAUDE.md's "no nested Shadow DOM"
// allowance for sharing behavior via plain functions.
//
// `training-catalog-nav-link` added 2026-08-04 for the Ciclos/Módulos redesign — it sits
// between `teacher-nav-link` and `academic-year-nav-link` in `NAV_LINKS`' order, per
// functional-spec.json's acceptance criteria for that elementId.
import { html, nothing, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';

export type SettingsScreen = 'profesor' | 'ciclos-modulos' | 'ano-academico';

interface NavLinkDef {
  elementId: 'teacher-nav-link' | 'training-catalog-nav-link' | 'academic-year-nav-link';
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
    elementId: 'academic-year-nav-link',
    screen: 'ano-academico',
    label: 'Año académico',
    route: '/configuracion/ano-academico',
  },
];

export function renderSettingsNav(activeScreen: SettingsScreen): TemplateResult {
  return html`
    <nav class="flex items-center gap-4 border-b border-slate-200 pb-2">
      <a
        class="${classesFor('link', 'link')} text-slate-500"
        data-element-id="back-to-dashboard-link"
        tabindex="0"
        role="link"
      >
        Volver
      </a>
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
