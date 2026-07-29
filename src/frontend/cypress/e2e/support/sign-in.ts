/// <reference types="cypress" />
// Shared sign-in helper for every Configuración spec (UC-01 through UC-07 all require an
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

// academic_years.name is VARCHAR(20) (see views/configuracion/schema-changes.sql) — keep
// generated fixture names short and unique. training_cycles.name/modules.name are
// VARCHAR(200), unaffected by this constraint.
export function uniqueAcademicYearName(tag: string): string {
  return `${tag} ${Date.now() % 1000000}`;
}
