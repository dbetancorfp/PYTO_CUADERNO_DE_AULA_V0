/// <reference types="cypress" />
// UC-02: Manage Fechas clave FP (views/fechas-senaladas/use-cases.md) — range category
// (fecha inicio/fecha fin), no tipo. category = 'academic_key_dates'.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-02: Manage Fechas clave FP', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/fechas-senaladas');
  });

  it('adds a row via the UI, displays it as a DD/MM – DD/MM range, edits it, and deletes it', () => {
    const name = `E2E Fecha clave ${Date.now()}`;
    const renamed = `${name} (renombrada)`;

    // Style application proof — secondary add-button, bg-slate-100 (see classes-for.ts).
    cy.get('[data-element-id="academic-key-dates-table-add-button"]').should(
      'have.css',
      'background-color',
      'rgb(241, 245, 249)',
    );

    cy.get('[data-element-id="academic-key-dates-table-add-button"]').click();
    cy.get('[data-element-id="academic-key-dates-table-row-new-name"]').type(name);
    cy.get('[data-element-id="academic-key-dates-table-row-new-start-date"]').type('05/09');
    cy.get('[data-element-id="academic-key-dates-table-row-new-end-date"]').type('20/06');

    cy.intercept('POST', '/api/key-dates').as('createKeyDate');
    cy.get('[data-element-id="academic-key-dates-table-row-new-save"]').click();
    cy.wait('@createKeyDate').its('response.statusCode').should('eq', 201);

    cy.contains('[data-element-id^="academic-key-dates-table-row-"]', name)
      .should('contain.text', '05/09 – 20/06')
      .invoke('attr', 'data-element-id')
      .then((elementId) => {
        const rowId = (elementId as string).slice('academic-key-dates-table-row-'.length);

        cy.get(`[data-element-id="academic-key-dates-table-row-${rowId}-edit"]`).click();
        cy.get(`[data-element-id="academic-key-dates-table-row-${rowId}-name"]`).clear().type(renamed);

        cy.intercept('PATCH', `/api/key-dates/${rowId}`).as('renameKeyDate');
        cy.get(`[data-element-id="academic-key-dates-table-row-${rowId}-save"]`).click();
        cy.wait('@renameKeyDate').its('response.statusCode').should('eq', 200);
        cy.contains(`[data-element-id="academic-key-dates-table-row-${rowId}"]`, renamed).should('exist');

        cy.intercept('DELETE', `/api/key-dates/${rowId}`).as('deleteKeyDate');
        cy.get(`[data-element-id="academic-key-dates-table-row-${rowId}-delete"]`).click();
        cy.wait('@deleteKeyDate').its('response.statusCode').should('eq', 204);
        cy.get(`[data-element-id="academic-key-dates-table-row-${rowId}"]`).should('not.exist');
      });
  });

  it('A2: rejects an invalid date (31/02) inline before submitting, and A1: rejects a duplicate name on the server', () => {
    const invalidName = `E2E Fecha inválida ${Date.now()}`;

    cy.get('[data-element-id="academic-key-dates-table-add-button"]').click();
    cy.get('[data-element-id="academic-key-dates-table-row-new-name"]').type(invalidName);
    cy.get('[data-element-id="academic-key-dates-table-row-new-start-date"]').type('31/02');
    cy.get('[data-element-id="academic-key-dates-table-row-new-end-date"]').type('01/03');
    cy.get('[data-element-id="academic-key-dates-table-row-new-save"]').click();

    cy.contains('Introduce una fecha válida en formato DD/MM.').should('be.visible');
    cy.get('[data-element-id="academic-key-dates-table-row-new-name"]').should('exist');
    cy.contains('[data-element-id^="academic-key-dates-table-row-"]', invalidName).should('not.exist');

    // A1 — duplicate (category, nombre, fecha inicio): create one via the API, then try
    // to add the exact same nombre/fecha inicio through the UI.
    const dupName = `E2E Fecha duplicada ${Date.now()}`;
    cy.request('POST', '/api/key-dates', {
      category: 'academic_key_dates',
      name: dupName,
      startDay: 10,
      startMonth: 4,
      endDay: 12,
      endMonth: 4,
    }).then(({ body }) => {
      const seededId = (body as { id: string }).id;

      cy.get('[data-element-id="academic-key-dates-table-row-new-name"]').clear().type(dupName);
      cy.get('[data-element-id="academic-key-dates-table-row-new-start-date"]').clear().type('10/04');
      cy.get('[data-element-id="academic-key-dates-table-row-new-end-date"]').clear().type('12/04');

      cy.intercept('POST', '/api/key-dates').as('duplicateAttempt');
      cy.get('[data-element-id="academic-key-dates-table-row-new-save"]').click();
      cy.wait('@duplicateAttempt').its('response.statusCode').should('eq', 409);
      cy.contains('Ya existe una fecha con ese nombre en esta categoría').should('be.visible');
      cy.get('[data-element-id="academic-key-dates-table-row-new-name"]').should('exist');

      cy.request('DELETE', `/api/key-dates/${seededId}`);
    });
  });
});
