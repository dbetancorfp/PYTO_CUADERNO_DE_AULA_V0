/// <reference types="cypress" />
// UC-01: Navigate to Calendario and back to Dashboard (views/calendario/use-cases.md)

import { signInAsE2eUser } from './support/sign-in';

describe('UC-01: Navigate to Calendario', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('opens Calendario from the dashboard card, shows the heading, and returns via Volver', () => {
    cy.visit('/dashboard');
    cy.get('[data-element-id="calendar-card"]').click();
    cy.url().should('include', '/calendario');

    cy.get('[data-element-id="calendario-heading"]').should('contain.text', 'Calendario');

    // Style application proof — nav bar shares dashboard-view.ts's classesFor('card') shell.
    cy.get('[data-element-id="calendario-heading"]')
      .parent('nav')
      .should('have.css', 'background-color', 'rgb(255, 255, 255)');

    cy.get('[data-element-id="back-to-dashboard-link"]').click();
    cy.url().should('include', '/dashboard');
  });
});
