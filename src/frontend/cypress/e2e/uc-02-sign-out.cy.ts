/// <reference types="cypress" />
// UC-02: Sign out

function signIn(): void {
  cy.visit('/login');
  cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
  cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
  cy.get('[data-element-id="login-button"]').click();
  cy.url().should('include', '/dashboard');
}

describe('UC-02: Sign out', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/logout').as('logout');
    signIn();
  });

  it('sends POST /api/auth/logout and redirects to /login when logout-link is clicked', () => {
    cy.get('[data-element-id="logout-link"]').click();

    cy.wait('@logout').its('response.statusCode').should('eq', 200);
    cy.url().should('include', '/login');
  });

  it('a later visit to /dashboard with the same, now-ended session redirects to /login', () => {
    cy.get('[data-element-id="logout-link"]').click();
    cy.url().should('include', '/login');

    cy.visit('/dashboard');

    cy.url().should('include', '/login');
  });
});
