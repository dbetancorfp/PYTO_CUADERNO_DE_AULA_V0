/// <reference types="cypress" />
// UC-06: End a session (logout-session)
//
// This view owns the session-ending capability, but has no UI to trigger it — the "Salir"
// button is Dashboard's (not yet built, see description_login.md's Session section and
// use-cases.md UC-06). These specs exercise the capability directly against the real,
// running backend, the same way UC-05's specs verify session-guard without a Dashboard UI.

describe('UC-06: End a session (logout-session)', () => {
  it('ends a real session started by login, so session-guard no longer authenticates it', () => {
    cy.visit('/login');
    cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
    cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
    cy.get('[data-element-id="login-button"]').click();
    cy.url().should('include', '/dashboard');

    cy.request('/api/auth/session').its('status').should('eq', 200);

    cy.request('POST', '/api/auth/logout').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.deep.equal({ message: 'Logged out' });
    });
    cy.getCookie('session_id').should('not.exist');

    cy.request({ url: '/api/auth/session', failOnStatusCode: false }).its('status').should('eq', 401);
  });

  it('is idempotent: logging out with no active session at all still responds 200', () => {
    cy.clearCookies();

    cy.request('POST', '/api/auth/logout').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.deep.equal({ message: 'Logged out' });
    });
  });
});
