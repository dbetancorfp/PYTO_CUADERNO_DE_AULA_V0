/// <reference types="cypress" />
// UC-06: Manage Evaluaciones (views/fechas-senaladas/use-cases.md) — range category, same
// shape as UC-02/UC-03. category = 'evaluations'.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-06: Manage Evaluaciones', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/fechas-senaladas');
  });

  it('adds a row, displays it as a DD/MM – DD/MM range, edits it, and deletes it', () => {
    const name = `E2E Evaluación ${Date.now()}`;
    const renamed = `${name} (renombrada)`;

    cy.get('[data-element-id="evaluations-table-add-button"]').click();
    cy.get('[data-element-id="evaluations-table-row-new-name"]').type(name);
    cy.get('[data-element-id="evaluations-table-row-new-start-date"]').type('14/12');
    cy.get('[data-element-id="evaluations-table-row-new-end-date"]').type('16/12');

    cy.intercept('POST', '/api/key-dates').as('createKeyDate');
    cy.get('[data-element-id="evaluations-table-row-new-save"]').click();
    cy.wait('@createKeyDate').its('response.statusCode').should('eq', 201);

    cy.contains('[data-element-id^="evaluations-table-row-"]', name)
      .should('contain.text', '14/12 – 16/12')
      .invoke('attr', 'data-element-id')
      .then((elementId) => {
        const rowId = (elementId as string).slice('evaluations-table-row-'.length);

        cy.get(`[data-element-id="evaluations-table-row-${rowId}-edit"]`).click();
        cy.get(`[data-element-id="evaluations-table-row-${rowId}-name"]`).clear().type(renamed);

        cy.intercept('PATCH', `/api/key-dates/${rowId}`).as('renameKeyDate');
        cy.get(`[data-element-id="evaluations-table-row-${rowId}-save"]`).click();
        cy.wait('@renameKeyDate').its('response.statusCode').should('eq', 200);
        cy.contains(`[data-element-id="evaluations-table-row-${rowId}"]`, renamed).should('exist');

        cy.request('DELETE', `/api/key-dates/${rowId}`);
      });
  });

  it('A4: Eliminar removes a row unconditionally', () => {
    cy.request('POST', '/api/key-dates', {
      category: 'evaluations',
      name: `E2E Evaluación borrable ${Date.now()}`,
      startDay: 11,
      startMonth: 6,
      endDay: 11,
      endMonth: 6,
    }).then(({ body }) => {
      const rowId = (body as { id: string }).id;
      cy.visit('/configuracion/fechas-senaladas');

      cy.intercept('DELETE', `/api/key-dates/${rowId}`).as('deleteKeyDate');
      cy.get(`[data-element-id="evaluations-table-row-${rowId}-delete"]`).click();
      cy.wait('@deleteKeyDate').its('response.statusCode').should('eq', 204);
      cy.get(`[data-element-id="evaluations-table-row-${rowId}"]`).should('not.exist');
    });
  });
});
