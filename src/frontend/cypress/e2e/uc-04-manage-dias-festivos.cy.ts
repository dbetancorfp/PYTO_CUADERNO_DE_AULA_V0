/// <reference types="cypress" />
// UC-04: Manage Días festivos (views/fechas-senaladas/use-cases.md) — single-day category,
// the only one with tipo. category = 'public_holidays'.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-04: Manage Días festivos', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/fechas-senaladas');
  });

  it('adds a row with tipo, displays a single DD/MM (no range dash), edits its tipo, and deletes it', () => {
    const name = `E2E Festivo ${Date.now()}`;

    cy.get('[data-element-id="public-holidays-table-add-button"]').click();
    cy.get('[data-element-id="public-holidays-table-row-new-name"]').type(name);
    cy.get('[data-element-id="public-holidays-table-row-new-start-date"]').type('12/10');
    cy.get('[data-element-id="public-holidays-table-row-new-type"]').type('Nacional');

    // No fecha-fin input for a single-day category.
    cy.get('[data-element-id="public-holidays-table-row-new-end-date"]').should('not.exist');

    cy.intercept('POST', '/api/key-dates').as('createKeyDate');
    cy.get('[data-element-id="public-holidays-table-row-new-save"]').click();
    cy.wait('@createKeyDate').its('response.statusCode').should('eq', 201);

    cy.contains('[data-element-id^="public-holidays-table-row-"]', name)
      .should('contain.text', '12/10')
      .and('contain.text', 'Nacional')
      .and('not.contain.text', '–')
      .invoke('attr', 'data-element-id')
      .then((elementId) => {
        const rowId = (elementId as string).slice('public-holidays-table-row-'.length);

        cy.get(`[data-element-id="public-holidays-table-row-${rowId}-edit"]`).click();
        cy.get(`[data-element-id="public-holidays-table-row-${rowId}-type"]`).clear().type('Autonómico');

        cy.intercept('PATCH', `/api/key-dates/${rowId}`).as('updateKeyDate');
        cy.get(`[data-element-id="public-holidays-table-row-${rowId}-save"]`).click();
        cy.wait('@updateKeyDate').its('response.statusCode').should('eq', 200);
        cy.contains(`[data-element-id="public-holidays-table-row-${rowId}"]`, 'Autonómico').should('exist');

        cy.request('DELETE', `/api/key-dates/${rowId}`);
      });
  });

  it('A5: tipo left blank is allowed', () => {
    const name = `E2E Festivo sin tipo ${Date.now()}`;

    cy.get('[data-element-id="public-holidays-table-add-button"]').click();
    cy.get('[data-element-id="public-holidays-table-row-new-name"]').type(name);
    cy.get('[data-element-id="public-holidays-table-row-new-start-date"]').type('01/11');

    cy.intercept('POST', '/api/key-dates').as('createKeyDate');
    cy.get('[data-element-id="public-holidays-table-row-new-save"]').click();
    cy.wait('@createKeyDate').its('response.statusCode').should('eq', 201);

    cy.contains('[data-element-id^="public-holidays-table-row-"]', name)
      .invoke('attr', 'data-element-id')
      .then((elementId) => {
        const rowId = (elementId as string).slice('public-holidays-table-row-'.length);
        cy.request('DELETE', `/api/key-dates/${rowId}`);
      });
  });
});
