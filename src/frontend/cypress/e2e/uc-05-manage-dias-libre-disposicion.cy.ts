/// <reference types="cypress" />
// UC-05: Manage Días de libre disposición (views/fechas-senaladas/use-cases.md) —
// single-day category, no tipo. category = 'free_disposal_days'.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-05: Manage Días de libre disposición', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/fechas-senaladas');
  });

  it('adds a row, displays a single DD/MM (no fecha-fin column), and deletes it', () => {
    const name = `E2E Libre disposición ${Date.now()}`;

    cy.get('[data-element-id="free-disposal-days-table-add-button"]').click();
    cy.get('[data-element-id="free-disposal-days-table-row-new-name"]').type(name);
    cy.get('[data-element-id="free-disposal-days-table-row-new-start-date"]').type('03/11');
    cy.get('[data-element-id="free-disposal-days-table-row-new-end-date"]').should('not.exist');
    cy.get('[data-element-id="free-disposal-days-table-row-new-type"]').should('not.exist');

    cy.intercept('POST', '/api/key-dates').as('createKeyDate');
    cy.get('[data-element-id="free-disposal-days-table-row-new-save"]').click();
    cy.wait('@createKeyDate').its('response.statusCode').should('eq', 201);

    cy.contains('[data-element-id^="free-disposal-days-table-row-"]', name)
      .should('contain.text', '03/11')
      .and('not.contain.text', '–')
      .invoke('attr', 'data-element-id')
      .then((elementId) => {
        const rowId = (elementId as string).slice('free-disposal-days-table-row-'.length);

        cy.intercept('DELETE', `/api/key-dates/${rowId}`).as('deleteKeyDate');
        cy.get(`[data-element-id="free-disposal-days-table-row-${rowId}-delete"]`).click();
        cy.wait('@deleteKeyDate').its('response.statusCode').should('eq', 204);
        cy.get(`[data-element-id="free-disposal-days-table-row-${rowId}"]`).should('not.exist');
      });
  });

  it('A2: rejects an invalid date (31/02) inline before submitting', () => {
    const name = `E2E Libre disposición inválida ${Date.now()}`;

    cy.get('[data-element-id="free-disposal-days-table-add-button"]').click();
    cy.get('[data-element-id="free-disposal-days-table-row-new-name"]').type(name);
    cy.get('[data-element-id="free-disposal-days-table-row-new-start-date"]').type('31/02');
    cy.get('[data-element-id="free-disposal-days-table-row-new-save"]').click();

    cy.contains('Introduce una fecha válida en formato DD/MM.').should('be.visible');
    cy.contains('[data-element-id^="free-disposal-days-table-row-"]', name).should('not.exist');
  });
});
