/// <reference types="cypress" />
// UC-01: Sign in with valid credentials

describe('UC-01: Sign in with valid credentials', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/login').as('login');
    cy.visit('/login');
  });

  it('redirects to /dashboard after a successful login response', () => {
    cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
    cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="login-button"]').click();

    cy.wait('@login').its('response.statusCode').should('eq', 200);
    cy.url().should('include', '/dashboard');
  });

  it("loads the shared Tailwind stylesheet into login-button's Shadow DOM", () => {
    // Proves attachSharedStyles actually fetched and adopted /dist/tailwind.css into the
    // component's shadow root — a regression here would ship a silently unstyled view (see
    // e2e-engineer.md's "Style application proof").
    cy.get('[data-element-id="login-button"]').should('have.css', 'background-color', 'rgb(15, 23, 42)');
  });

  it('shows "Incorrect email or password" and resets login-button after a wrong-password response', () => {
    cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
    cy.get('[data-element-id="password-input"]').type('TheWrongPassword1');
    cy.get('[data-element-id="login-button"]').click();

    cy.wait('@login').its('response.statusCode').should('eq', 401);
    cy.get('[data-element-id="login-error-message"]').should('contain.text', 'Incorrect email or password');
    cy.get('[data-element-id="login-button"]').should('not.be.disabled');
  });

  it('shows the account-locked message even with the correct password, once the account is locked', () => {
    cy.get('[data-element-id="email-input"]').type('e2e-locked-user@example.com');
    cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="login-button"]').click();

    cy.wait('@login').its('response.statusCode').should('eq', 403);
    cy.get('[data-element-id="login-error-message"]').should(
      'contain.text',
      'This account has been locked due to too many failed attempts. Contact support.',
    );
    cy.get('[data-element-id="login-button"]').should('not.be.disabled');
  });
});
