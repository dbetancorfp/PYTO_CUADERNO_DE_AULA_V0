/// <reference types="cypress" />
// UC-01: Navigate between the four Configuración screens (Fechas señaladas' own entry —
// see views/fechas-senaladas/use-cases.md UC-01). Extends the shared settings nav
// (uc-03-navigate-between-settings-screens.cy.ts) with the fourth link, key-dates-nav-link.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-01: Navigate to Fechas señaladas', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('navigates to Fechas señaladas via key-dates-nav-link from another settings screen, and back to Dashboard', () => {
    cy.visit('/configuracion/profesor');
    cy.get('[data-element-id="key-dates-nav-link"]').should('be.visible').and('not.have.attr', 'aria-current');

    cy.get('[data-element-id="key-dates-nav-link"]').click();
    cy.url().should('include', '/configuracion/fechas-senaladas');
    cy.get('[data-element-id="key-dates-nav-link"]').should('have.attr', 'aria-current', 'page');
    cy.get('[data-element-id="teacher-nav-link"]').should('not.have.attr', 'aria-current');

    cy.get('[data-element-id="back-to-dashboard-link"]').click();
    cy.url().should('include', '/dashboard');
  });

  it('A1: clicking key-dates-nav-link again while already on this screen is a no-op', () => {
    cy.visit('/configuracion/fechas-senaladas');
    cy.get('[data-element-id="key-dates-nav-link"]').click();
    cy.url().should('include', '/configuracion/fechas-senaladas');
    cy.get('[data-element-id="key-dates-nav-link"]').should('have.attr', 'aria-current', 'page');
  });
});
