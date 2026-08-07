/// <reference types="cypress" />
// UC-07: Manage Proyecto FEOE (views/fechas-senaladas/use-cases.md) — single-day category,
// no tipo, same shape as UC-05. category = 'feoe_project_days'.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-07: Manage Proyecto FEOE', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/fechas-senaladas');
  });

  it('adds a row, displays a single DD/MM, and deletes it', () => {
    const name = `E2E FEOE ${Date.now()}`;

    cy.get('[data-element-id="feoe-project-days-table-add-button"]').click();
    cy.get('[data-element-id="feoe-project-days-table-row-new-name"]').type(name);
    cy.get('[data-element-id="feoe-project-days-table-row-new-start-date"]').type('10/05');

    cy.intercept('POST', '/api/key-dates').as('createKeyDate');
    cy.get('[data-element-id="feoe-project-days-table-row-new-save"]').click();
    cy.wait('@createKeyDate').its('response.statusCode').should('eq', 201);

    cy.contains('[data-element-id^="feoe-project-days-table-row-"]', name)
      .should('contain.text', '10/05')
      .and('not.contain.text', '–')
      .invoke('attr', 'data-element-id')
      .then((elementId) => {
        const rowId = (elementId as string).slice('feoe-project-days-table-row-'.length);

        cy.intercept('DELETE', `/api/key-dates/${rowId}`).as('deleteKeyDate');
        cy.get(`[data-element-id="feoe-project-days-table-row-${rowId}-delete"]`).click();
        cy.wait('@deleteKeyDate').its('response.statusCode').should('eq', 204);
        cy.get(`[data-element-id="feoe-project-days-table-row-${rowId}"]`).should('not.exist');
      });
  });

  it('A1: rejects a duplicate (category, nombre, fecha) on the server', () => {
    const dupName = `E2E FEOE duplicado ${Date.now()}`;

    cy.request('POST', '/api/key-dates', {
      category: 'feoe_project_days',
      name: dupName,
      startDay: 18,
      startMonth: 5,
      endDay: 18,
      endMonth: 5,
    }).then(({ body }) => {
      const seededId = (body as { id: string }).id;

      cy.get('[data-element-id="feoe-project-days-table-add-button"]').click();
      cy.get('[data-element-id="feoe-project-days-table-row-new-name"]').type(dupName);
      cy.get('[data-element-id="feoe-project-days-table-row-new-start-date"]').type('18/05');

      cy.intercept('POST', '/api/key-dates').as('duplicateAttempt');
      cy.get('[data-element-id="feoe-project-days-table-row-new-save"]').click();
      cy.wait('@duplicateAttempt').its('response.statusCode').should('eq', 409);
      cy.contains('Ya existe una fecha con ese nombre en esta categoría').should('be.visible');

      cy.request('DELETE', `/api/key-dates/${seededId}`);
    });
  });
});
