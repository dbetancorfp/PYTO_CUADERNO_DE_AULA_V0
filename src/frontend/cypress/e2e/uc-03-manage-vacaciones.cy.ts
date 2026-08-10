/// <reference types="cypress" />
// UC-03: Manage Vacaciones (views/fechas-senaladas/use-cases.md) — range category, same
// shape as UC-02 (including tipo — every category carries it now, see UC-04),
// category = 'holidays'.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-03: Manage Vacaciones', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/fechas-senaladas');
  });

  it('adds a row with tipo, displays it as a DD/MM – DD/MM range, and deletes it', () => {
    const name = `E2E Vacaciones ${Date.now()}`;

    cy.get('[data-element-id="holidays-table-add-button"]').click();
    cy.get('[data-element-id="holidays-table-row-new-name"]').type(name);
    cy.get('[data-element-id="holidays-table-row-new-start-date"]').type('22/12');
    cy.get('[data-element-id="holidays-table-row-new-end-date"]').type('07/01');
    cy.get('[data-element-id="holidays-table-row-new-type"]').type('Vacaciones');

    cy.intercept('POST', '/api/key-dates').as('createKeyDate');
    cy.get('[data-element-id="holidays-table-row-new-save"]').click();
    cy.wait('@createKeyDate').its('response.statusCode').should('eq', 201);

    cy.contains('[data-element-id^="holidays-table-row-"]', name)
      .should('contain.text', '22/12 – 07/01')
      .and('contain.text', 'Vacaciones')
      .invoke('attr', 'data-element-id')
      .then((elementId) => {
        const rowId = (elementId as string).slice('holidays-table-row-'.length);

        cy.intercept('DELETE', `/api/key-dates/${rowId}`).as('deleteKeyDate');
        cy.get(`[data-element-id="holidays-table-row-${rowId}-delete"]`).click();
        cy.wait('@deleteKeyDate').its('response.statusCode').should('eq', 204);
        cy.get(`[data-element-id="holidays-table-row-${rowId}"]`).should('not.exist');
      });
  });

  it('A2: rejects an invalid date (31/02) inline before submitting', () => {
    const name = `E2E Vacaciones inválida ${Date.now()}`;

    cy.get('[data-element-id="holidays-table-add-button"]').click();
    cy.get('[data-element-id="holidays-table-row-new-name"]').type(name);
    cy.get('[data-element-id="holidays-table-row-new-start-date"]').type('31/02');
    cy.get('[data-element-id="holidays-table-row-new-end-date"]').type('01/03');
    cy.get('[data-element-id="holidays-table-row-new-save"]').click();

    cy.contains('Introduce una fecha válida en formato DD/MM.').should('be.visible');
    cy.contains('[data-element-id^="holidays-table-row-"]', name).should('not.exist');
  });
});
