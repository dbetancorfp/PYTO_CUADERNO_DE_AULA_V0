/// <reference types="cypress" />
// Shared sign-in helper for every Configuración spec (UC-01 through UC-09 all require an
// authenticated session). Not a *.cy.ts file itself, so cypress.config.ts's specPattern
// never picks it up as a spec on its own — imported by the specs that need it, same
// no-supportFile convention Login/Dashboard's own specs already use (each spec is
// self-contained; this just avoids repeating the same three lines seven times over).

export function signInAsE2eUser(): void {
  cy.visit('/login');
  cy.get('[data-element-id="email-input"]').type('e2e-valid-user@example.com');
  cy.get('[data-element-id="password-input"]').type('CorrectHorseBattery1');
  cy.get('[data-element-id="login-button"]').click();
  cy.url().should('include', '/dashboard');
}

// Unique `academic_years.start_year` generator (2026-08-05 redesign — Año académico is a
// real, Postgres-persisted, per-teacher-unique INTEGER now, not a free-text name). Keeps
// the value well under Postgres' INTEGER range while staying unique across specs run in
// the same suite, same timestamp-plus-sequence pattern the catalog specs already use.
let startYearSequence = 0;
export function uniqueStartYear(): number {
  startYearSequence += 1;
  return 3000 + (Date.now() % 90000) + startYearSequence;
}
