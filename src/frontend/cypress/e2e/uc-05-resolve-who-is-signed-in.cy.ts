/// <reference types="cypress" />
// UC-05: Resolve who is signed in (session-guard)

describe('UC-05: Resolve who is signed in (session-guard)', () => {
  it('resolves the signed-in user\'s full name after a real login, from the browser to the database', () => {
    cy.visit('/login');
    cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
    cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="login-button"]').click();
    cy.url().should('include', '/dashboard');

    cy.request('/api/auth/session').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.deep.equal({ fullName: 'E2E Valid User' });
    });
  });

  it('resolves to "not signed in" (401) when no session_id cookie is present', () => {
    cy.clearCookies();

    cy.request({ url: '/api/auth/session', failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(401);
      expect(response.body).to.deep.equal({ message: 'Not authenticated' });
    });
  });
});
