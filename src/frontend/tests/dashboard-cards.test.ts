// elementId: calendar-card, evaluation-criteria-card, work-units-card, student-roster-card,
// diary-card, student-detail-card, reports-card (see views/dashboard/use-cases.md UC-03)
//
// Route slugs ([INFERENCE — verify with the user]: not specified anywhere in Phase A —
// ui-spec.json/functional-spec.json only say "navigates to this card's route" without a
// literal path, and none of these seven views exist yet to derive one from) — one per card,
// kebab-case matching the card's own label:
//   calendar-card            -> /calendario
//   evaluation-criteria-card -> /criterios-evaluacion
//   work-units-card          -> /unidades-trabajo
//   student-roster-card      -> /listado-alumnos
//   diary-card                -> /diario
//   student-detail-card      -> /alumno
//   reports-card              -> /informes
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

async function clickCardAndGetPath(el: DashboardView, elementId: string): Promise<string> {
  el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${elementId}"]`)!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const path = window.location.pathname;
  window.history.pushState({}, '', '/dashboard');
  return path;
}

const CARDS: Array<{ elementId: string; route: string; position: number }> = [
  { elementId: 'calendar-card', route: '/calendario', position: 1 },
  { elementId: 'evaluation-criteria-card', route: '/criterios-evaluacion', position: 2 },
  { elementId: 'work-units-card', route: '/unidades-trabajo', position: 3 },
  { elementId: 'student-roster-card', route: '/listado-alumnos', position: 4 },
  { elementId: 'diary-card', route: '/diario', position: 5 },
  { elementId: 'student-detail-card', route: '/alumno', position: 6 },
  { elementId: 'reports-card', route: '/informes', position: 7 },
];

for (const { elementId, route } of CARDS) {
  describe(`elementId: ${elementId}`, () => {
    it('is visible in the dashboard grid', async () => {
      const el = await mountAuthenticatedDashboard();

      expect(el.shadowRoot!.querySelector(`[data-element-id="${elementId}"]`)).not.toBeNull();

      el.remove();
    });

    it(`navigates to ${route} when clicked`, async () => {
      const el = await mountAuthenticatedDashboard();

      const path = await clickCardAndGetPath(el, elementId);

      expect(path).toBe(route);

      el.remove();
    });
  });
}

describe('elementId: calendar-card, evaluation-criteria-card, work-units-card, student-roster-card, diary-card, student-detail-card, reports-card', () => {
  it('render in the fixed order: Calendario, Criterios de evaluación, Unidades de Trabajo, Listado de alumnos, Diario, Vista individual de alumno, Informes', async () => {
    const el = await mountAuthenticatedDashboard();

    const orderedIds = CARDS.map(({ elementId }) => elementId);
    const nodes = orderedIds.map(
      (elementId) => el.shadowRoot!.querySelector(`[data-element-id="${elementId}"]`)!,
    );

    for (let i = 0; i < nodes.length - 1; i += 1) {
      expect(nodes[i]!.compareDocumentPosition(nodes[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    el.remove();
  });
});
