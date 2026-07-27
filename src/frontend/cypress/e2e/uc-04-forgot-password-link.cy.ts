/// <reference types="cypress" />
// UC-04: Forgot password link (out of scope placeholder)

describe('UC-04: Forgot password link (out of scope placeholder)', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/login').as('login');
    cy.visit('/login');
  });

  it('is present and visible below login-button on first load', () => {
    cy.get('[data-element-id="login-button"]').then(($button) => {
      cy.get('[data-element-id="forgot-password-link"]')
        .should('be.visible')
        .then(($link) => {
          expect($link[0].compareDocumentPosition($button[0]) & Node.DOCUMENT_POSITION_PRECEDING).to.be.greaterThan(
            0,
          );
        });
    });
  });

  it('does not navigate and sends no request when clicked', () => {
    cy.get('[data-element-id="forgot-password-link"]').click();

    cy.url().should('include', '/login');
    cy.get('@login.all').should('have.length', 0);
  });
});
