/// <reference types="cypress" />
// UC-01: Reach the Dashboard as a signed-in teacher

function signIn(): void {
  cy.visit('/login');
  cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
  cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
  cy.get('[data-element-id="login-button"]').click();
  cy.url().should('include', '/dashboard');
}

describe('UC-01: Reach the Dashboard as a signed-in teacher', () => {
  it("renders the navbar with the signed-in teacher's name after a real login", () => {
    signIn();

    cy.get('[data-element-id="app-logo"]').should('be.visible');
    cy.get('[data-element-id="welcome-message"]').should('contain.text', 'Bienvenido, E2E Valid User');
    cy.get('[data-element-id="settings-menu"]').should('be.disabled');
    cy.get('[data-element-id="logout-link"]').should('be.visible');
  });

  it("loads the shared Tailwind stylesheet into a card's Shadow DOM", () => {
    // Proves attachSharedStyles actually fetched and adopted /dist/tailwind.css into
    // dashboard-view's shadow root — see e2e-engineer.md's "Style application proof".
    signIn();

    cy.get('[data-element-id="calendar-card"]').should('have.css', 'background-color', 'rgb(255, 255, 255)');
  });

  it('redirects to /login when visiting /dashboard without a valid session', () => {
    cy.clearCookies();

    cy.visit('/dashboard');

    cy.url().should('include', '/login');
  });
});
