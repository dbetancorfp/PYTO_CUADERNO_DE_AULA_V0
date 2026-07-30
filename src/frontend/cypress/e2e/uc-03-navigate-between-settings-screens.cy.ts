/// <reference types="cypress" />
// UC-03: Navigate between settings screens

import { signInAsE2eUser } from './support/sign-in';

describe('UC-03: Navigate between settings screens', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('navigates from Profesor to Año académico and back via the nav links', () => {
    cy.visit('/configuracion/profesor');
    cy.get('[data-element-id="teacher-nav-link"]').should('be.visible');
    cy.get('[data-element-id="academic-year-nav-link"]').should('be.visible');

    cy.get('[data-element-id="academic-year-nav-link"]').click();
    cy.url().should('include', '/configuracion/ano-academico');

    cy.get('[data-element-id="teacher-nav-link"]').click();
    cy.url().should('include', '/configuracion/profesor');
  });

  it('shows an active state on the current screen\'s own nav link', () => {
    cy.visit('/configuracion/ano-academico');
    cy.get('[data-element-id="academic-year-nav-link"]').should('have.attr', 'aria-current', 'page');
    cy.get('[data-element-id="teacher-nav-link"]').should('not.have.attr', 'aria-current');
  });

  it('navigates back to Dashboard from either settings screen via back-to-dashboard-link', () => {
    cy.visit('/configuracion/profesor');
    cy.get('[data-element-id="back-to-dashboard-link"]').click();
    cy.url().should('include', '/dashboard');

    cy.visit('/configuracion/ano-academico');
    cy.get('[data-element-id="back-to-dashboard-link"]').click();
    cy.url().should('include', '/dashboard');
  });
});
