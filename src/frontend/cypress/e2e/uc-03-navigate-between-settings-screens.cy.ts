/// <reference types="cypress" />
// UC-03: Navigate between settings screens

import { signInAsE2eUser } from './support/sign-in';

describe('UC-03: Navigate between settings screens', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('navigates between all three settings screens via the nav links, including a no-op on the active one', () => {
    cy.visit('/configuracion/profesor');
    cy.get('[data-element-id="teacher-nav-link"]').should('be.visible');
    cy.get('[data-element-id="training-catalog-nav-link"]').should('be.visible');
    cy.get('[data-element-id="academic-year-nav-link"]').should('be.visible');

    cy.get('[data-element-id="training-catalog-nav-link"]').click();
    cy.url().should('include', '/configuracion/ciclos-modulos');

    cy.get('[data-element-id="academic-year-nav-link"]').click();
    cy.url().should('include', '/configuracion/ano-academico');

    cy.get('[data-element-id="teacher-nav-link"]').click();
    cy.url().should('include', '/configuracion/profesor');

    // A1 — clicking the link for the already-active screen is a no-op.
    cy.get('[data-element-id="teacher-nav-link"]').click();
    cy.url().should('include', '/configuracion/profesor');
  });

  it('shows an active state on the current screen\'s own nav link, inactive on the other two', () => {
    cy.visit('/configuracion/profesor');
    cy.get('[data-element-id="teacher-nav-link"]').should('have.attr', 'aria-current', 'page');
    cy.get('[data-element-id="training-catalog-nav-link"]').should('not.have.attr', 'aria-current');
    cy.get('[data-element-id="academic-year-nav-link"]').should('not.have.attr', 'aria-current');

    cy.visit('/configuracion/ciclos-modulos');
    cy.get('[data-element-id="training-catalog-nav-link"]').should('have.attr', 'aria-current', 'page');
    cy.get('[data-element-id="teacher-nav-link"]').should('not.have.attr', 'aria-current');

    cy.visit('/configuracion/ano-academico');
    cy.get('[data-element-id="academic-year-nav-link"]').should('have.attr', 'aria-current', 'page');
    cy.get('[data-element-id="teacher-nav-link"]').should('not.have.attr', 'aria-current');
  });

  it('navigates back to Dashboard from any of the three settings screens via back-to-dashboard-link', () => {
    cy.visit('/configuracion/profesor');
    cy.get('[data-element-id="back-to-dashboard-link"]').click();
    cy.url().should('include', '/dashboard');

    cy.visit('/configuracion/ciclos-modulos');
    cy.get('[data-element-id="back-to-dashboard-link"]').click();
    cy.url().should('include', '/dashboard');

    cy.visit('/configuracion/ano-academico');
    cy.get('[data-element-id="back-to-dashboard-link"]').click();
    cy.url().should('include', '/dashboard');
  });
});
