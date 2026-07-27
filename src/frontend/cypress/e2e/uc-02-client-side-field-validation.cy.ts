/// <reference types="cypress" />
// UC-02: Client-side field validation

describe('UC-02: Client-side field validation', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/login').as('login');
    cy.visit('/login');
  });

  it('shows inline errors and sends no request when both fields are left empty', () => {
    cy.get('[data-element-id="login-button"]').click();

    cy.contains(/required/i).should('be.visible');
    cy.get('@login.all').should('have.length', 0);
  });

  it('shows an inline error and sends no request when the email is malformed', () => {
    cy.get('[data-element-id="email-input"]').type('not-an-email');
    cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="login-button"]').click();

    cy.contains(/valid email/i).should('be.visible');
    cy.get('@login.all').should('have.length', 0);
  });
});
