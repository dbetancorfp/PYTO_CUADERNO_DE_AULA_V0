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

// Short, timestamp-unique name generator for both the real catalog_training_cycles table
// (UC-04/UC-05, Postgres-persisted, unique per teacher) and Año académico's local-state-only
// entities (UC-06..UC-09, 2026-08-04 redesign — see academic-year-settings-view.ts).
export function uniqueAcademicYearName(tag: string): string {
  return `${tag} ${Date.now() % 1000000}`;
}
