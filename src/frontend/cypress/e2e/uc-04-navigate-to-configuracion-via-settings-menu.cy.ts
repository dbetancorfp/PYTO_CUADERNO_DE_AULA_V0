/// <reference types="cypress" />
// UC-04: Navigate to Configuración via settings-menu
//
// Reopened — settings-menu was a disabled placeholder until the Configuración view existed
// (now merged to main). It behaves identically to the seven section cards in UC-03, just
// with a fixed destination instead of a card position — see this spec's sibling
// uc-03-navigate-to-a-section-via-its-card.cy.ts for the pattern this mirrors. Unlike the
// seven cards, /configuracion/profesor is a real, built view, so the navigation actually
// lands on live content rather than just changing the URL.

function signIn(): void {
  cy.visit('/login');
  cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
  cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
  cy.get('[data-element-id="login-button"]').click();
  cy.url().should('include', '/dashboard');
}

describe('UC-04: Navigate to Configuración via settings-menu', () => {
  beforeEach(() => {
    signIn();
  });

  it('is visible and enabled at the right end of the navbar', () => {
    cy.get('[data-element-id="settings-menu"]').should('be.visible').and('not.be.disabled');
  });

  it('navigates to /configuracion/profesor when clicked, landing on the real Profesor screen', () => {
    cy.get('[data-element-id="settings-menu"]').click();

    cy.url().should('include', '/configuracion/profesor');
    cy.get('[data-element-id="teacher-full-name-input"]').should('be.visible');
  });
});
