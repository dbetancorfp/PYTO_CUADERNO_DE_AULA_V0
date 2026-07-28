/// <reference types="cypress" />
// UC-03: Navigate to a section via its card
//
// Route slugs match src/frontend/src/dashboard-view.ts's SECTION_CARDS and the unit tests
// in src/frontend/tests/dashboard-cards.test.ts — none of these seven destination views
// exist yet, same as Login's own uc-01 spec asserting a redirect to a not-yet-built
// /dashboard.

function signIn(): void {
  cy.visit('/login');
  cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
  cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
  cy.get('[data-element-id="login-button"]').click();
  cy.url().should('include', '/dashboard');
}

const CARDS: Array<{ elementId: string; route: string; label: string }> = [
  { elementId: 'calendar-card', route: '/calendario', label: 'Calendario' },
  { elementId: 'evaluation-criteria-card', route: '/criterios-evaluacion', label: 'Criterios de evaluación' },
  { elementId: 'work-units-card', route: '/unidades-trabajo', label: 'Unidades de Trabajo' },
  { elementId: 'student-roster-card', route: '/listado-alumnos', label: 'Listado de alumnos' },
  { elementId: 'diary-card', route: '/diario', label: 'Diario' },
  { elementId: 'student-detail-card', route: '/alumno', label: 'Vista individual de alumno' },
  { elementId: 'reports-card', route: '/informes', label: 'Informes' },
];

describe('UC-03: Navigate to a section via its card', () => {
  beforeEach(() => {
    signIn();
  });

  it('shows all seven cards, each with its label', () => {
    for (const { elementId, label } of CARDS) {
      cy.get(`[data-element-id="${elementId}"]`).should('contain.text', label);
    }
  });

  for (const { elementId, route } of CARDS) {
    it(`navigates to ${route} when ${elementId} is clicked`, () => {
      cy.get(`[data-element-id="${elementId}"]`).click();

      cy.url().should('include', route);
    });
  }
});
