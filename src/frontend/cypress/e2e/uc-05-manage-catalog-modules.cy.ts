/// <reference types="cypress" />
// UC-05: Manage modules within a catalog training cycle
//
// New for the 2026-08-04 redesign: catalog-module-table is backed by the brand-new,
// standalone catalog_modules table (GET/POST /api/catalog/training-cycles/:cycleId/modules,
// PATCH/DELETE /api/catalog/modules/:id). Editing always saves immediately — no
// module-edit-confirm-modal, unlike the old, now-dropped modules table, since nothing
// references a catalog module.

import { signInAsE2eUser } from './support/sign-in';

describe('UC-05: Manage modules within a catalog training cycle', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ciclos-modulos');
  });

  it('adds modules grouped by course, edits one immediately with no modal, and deletes another', () => {
    const cycleName = `E2E Catalog Module Cycle ${Date.now()}`;
    const module1Name = `E2E Module 1o ${Date.now()}`;
    const module2Name = `E2E Module 2o ${Date.now()}`;
    const renamedName = `E2E Module Renamed ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body }) => {
      const cycleId = (body as { id: string }).id;
      cy.reload();
      cy.get(`[data-element-id="catalog-training-cycle-table-row-${cycleId}"]`).click();

      cy.intercept('POST', `/api/catalog/training-cycles/${cycleId}/modules`).as('createModule');

      cy.get('[data-element-id="catalog-module-table-add-button"]').click();
      cy.get('[data-element-id="catalog-module-table-row-new-name"]').type(module1Name);
      cy.get('[data-element-id="catalog-module-table-row-new-course"]').select('1');
      cy.get('[data-element-id="catalog-module-table-row-new-save"]').click();
      cy.wait('@createModule').then(({ response }) => {
        expect(response?.statusCode).to.eq(201);
        const module1Id = (response?.body as { id: string }).id;

        cy.get('[data-element-id="catalog-module-table-add-button"]').click();
        cy.get('[data-element-id="catalog-module-table-row-new-name"]').type(module2Name);
        cy.get('[data-element-id="catalog-module-table-row-new-course"]').select('2');
        cy.get('[data-element-id="catalog-module-table-row-new-save"]').click();

        cy.wait('@createModule').then(({ response: response2 }) => {
          const module2Id = (response2?.body as { id: string }).id;
          cy.contains('[data-element-id="catalog-module-table"]', '1º').should('exist');
          cy.contains('[data-element-id="catalog-module-table"]', '2º').should('exist');
          cy.contains(`[data-element-id="catalog-module-table-row-${module1Id}"]`, module1Name).should('exist');
          cy.contains(`[data-element-id="catalog-module-table-row-${module2Id}"]`, module2Name).should('exist');

          // A4 — editing saves immediately, no confirmation modal (the element doesn't
          // even exist on this screen — see ui-spec.json's screen notes).
          cy.get(`[data-element-id="catalog-module-table-row-${module1Id}-edit"]`).click();
          cy.get(`[data-element-id="catalog-module-table-row-${module1Id}-name"]`).clear().type(renamedName);

          cy.intercept('PATCH', `/api/catalog/modules/${module1Id}`).as('updateModule');
          cy.get(`[data-element-id="catalog-module-table-row-${module1Id}-save"]`).click();
          cy.wait('@updateModule').its('response.statusCode').should('eq', 200);
          cy.contains(`[data-element-id="catalog-module-table-row-${module1Id}"]`, renamedName).should('exist');

          // A3 — deleting always succeeds unconditionally.
          cy.intercept('DELETE', `/api/catalog/modules/${module2Id}`).as('deleteModule');
          cy.get(`[data-element-id="catalog-module-table-row-${module2Id}-delete"]`).click();
          cy.wait('@deleteModule').its('response.statusCode').should('eq', 204);
          cy.get(`[data-element-id="catalog-module-table-row-${module2Id}"]`).should('not.exist');

          cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
        });
      });
    });
  });

  it('A1: shows a prompt and disables adding modules when no cycle is selected', () => {
    // Delete every existing cycle so no cycle can be auto-selected on load (cascade
    // removes their modules too — this catalog has no dependency-blocked deletion).
    cy.request('GET', '/api/catalog/training-cycles').then(({ body }) => {
      const existingCycles = (body as { trainingCycles: Array<{ id: string }> }).trainingCycles;
      existingCycles.forEach((cycle) => {
        cy.request('DELETE', `/api/catalog/training-cycles/${cycle.id}`);
      });
    });

    cy.reload();
    cy.get('[data-element-id="catalog-module-table"]').should('contain.text', 'Elige o crea un ciclo para ver sus módulos.');
    cy.get('[data-element-id="catalog-module-table-add-button"]').should('be.disabled');
  });

  it('A2: rejects a duplicate (name, course) within the same cycle', () => {
    const cycleName = `E2E Catalog Dup Module Cycle ${Date.now()}`;
    const moduleName = `E2E Dup Module ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName })
      .then(({ body }) => (body as { id: string }).id)
      .then((cycleId) =>
        cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(() => cycleId),
      )
      .then((cycleId) => {
        cy.reload();
        cy.get(`[data-element-id="catalog-training-cycle-table-row-${cycleId}"]`).click();

        cy.get('[data-element-id="catalog-module-table-add-button"]').click();
        cy.get('[data-element-id="catalog-module-table-row-new-name"]').type(moduleName);
        cy.get('[data-element-id="catalog-module-table-row-new-course"]').select('1');

        cy.intercept('POST', `/api/catalog/training-cycles/${cycleId}/modules`).as('createDuplicateModule');
        cy.get('[data-element-id="catalog-module-table-row-new-save"]').click();
        cy.wait('@createDuplicateModule').its('response.statusCode').should('eq', 409);

        cy.contains('Ya existe un módulo con ese nombre y curso en este ciclo').should('be.visible');
        cy.get('[data-element-id="catalog-module-table-row-new-name"]').should('have.value', moduleName);

        cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
      });
  });
});
