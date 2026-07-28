/// <reference types="cypress" />
// UC-04: Configuración is a non-functional placeholder

function signIn(): void {
  cy.visit('/login');
  cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
  cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
  cy.get('[data-element-id="login-button"]').click();
  cy.url().should('include', '/dashboard');
}

describe('UC-04: Configuración is a non-functional placeholder', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/auth/session').as('sessionCheck');
    signIn();
    cy.wait('@sessionCheck');
  });

  it('renders settings-menu disabled with a non-availability indicator', () => {
    cy.get('[data-element-id="settings-menu"]')
      .should('be.disabled')
      .and('have.attr', 'aria-disabled', 'true');
  });

  it('does nothing when clicked: no navigation, no extra request', () => {
    cy.get('[data-element-id="settings-menu"]').click({ force: true });

    cy.url().should('include', '/dashboard');
    cy.get('@sessionCheck.all').should('have.length', 1);
  });
});
