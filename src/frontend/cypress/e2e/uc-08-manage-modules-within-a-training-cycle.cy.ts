/// <reference types="cypress" />
// UC-08: Manage modules within a training cycle (local state — not wired)
//
// Rewritten 2026-08-04 — see UC-06's header comment for the redesign context shared by this
// whole screen. Everything here operates on local component state only.

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

function rowIdFrom(tableId: string, elementId: string): string {
  return elementId.slice(`${tableId}-row-`.length);
}

describe('UC-08: Manage modules within a training cycle', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.intercept('/api/academic-years**').as('yearApi');
    cy.intercept('/api/training-cycles**').as('cycleApi');
    cy.intercept('/api/modules**').as('moduleApi');
    cy.visit('/configuracion/ano-academico');
  });

  it('adds a module through module-table (auto-selected for the active year), then opens the edit-confirm modal for a referenced module', () => {
    const yearName = uniqueAcademicYearName('AY-Mod');
    const cycleName = `E2E Mod Cycle ${Date.now()}`;
    const module1Name = `E2E Mod One ${Date.now()}`;
    const module2Name = `E2E Mod Two ${Date.now()}`;
    const renamedName = `E2E Mod Renamed ${Date.now()}`;

    cy.get('[data-element-id="academic-year-table-add-button"]').click();
    cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);
    cy.get('[data-element-id="training-cycle-table-add-button"]').click();
    cy.get('[data-element-id="training-cycle-table-row-new-name"]').type(cycleName);
    cy.get('[data-element-id="training-cycle-table-row-new-save"]').click();

    cy.contains('[data-element-id^="training-cycle-table-row-"]', cycleName)
      .invoke('attr', 'data-element-id')
      .then((cycleElementId) => {
        const cycleId = rowIdFrom('training-cycle-table', cycleElementId as string);
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).click();

        cy.get('[data-element-id="module-selection-add-button"]').click();
        cy.get('[data-element-id="module-selection-table-row-new-name"]').type(module1Name);
        cy.get('[data-element-id="module-selection-table-row-new-course"]').select('1');
        cy.get('[data-element-id="module-selection-table-row-new-save"]').click();
        cy.get('[data-element-id="module-selection-save-button"]').click();
        cy.get('[data-element-id="module-selection-save-message"]').should('contain.text', 'guardados');

        // A1 — module-table is hidden while adding-year/adding-cycle mode is active; back
        // in normal mode it shows again, with module 1.
        cy.get('[data-element-id="module-table"]').should('exist');
        cy.contains('[data-element-id="module-table"]', module1Name).should('exist');

        // Main flow — module-table-add-button adds a second module, auto-selected for the
        // active year (this cycle stays referenced without any explicit checkbox step).
        cy.get('[data-element-id="module-table-add-button"]').click();
        cy.get('[data-element-id="module-table-row-new-name"]').type(module2Name);
        cy.get('[data-element-id="module-table-row-new-course"]').select('2');
        cy.get('[data-element-id="module-table-row-new-save"]').click();
        cy.contains('[data-element-id="module-table"]', module2Name).should('exist');
        cy.contains('[data-element-id="module-table"]', '1º').should('exist');
        cy.contains('[data-element-id="module-table"]', '2º').should('exist');

        // A3 — editing a module referenced by the active academic year opens
        // module-edit-confirm-modal instead of saving immediately.
        cy.contains('[data-element-id^="module-table-row-"]', module1Name)
          .invoke('attr', 'data-element-id')
          .then((module1ElementId) => {
            const module1Id = rowIdFrom('module-table', module1ElementId as string);

            cy.get(`[data-element-id="module-table-row-${module1Id}-edit"]`).click();
            cy.get(`[data-element-id="module-table-row-${module1Id}-name"]`).clear().type(renamedName);
            cy.get(`[data-element-id="module-table-row-${module1Id}-save"]`).click();

            cy.get('[data-element-id="module-edit-confirm-modal"]').should('be.visible').and('contain.text', yearName);
            cy.get('[data-element-id="module-edit-confirm-modal-confirm"]').click();
            cy.get('[data-element-id="module-edit-confirm-modal"]').should('not.exist');
            cy.contains(`[data-element-id="module-table-row-${module1Id}"]`, renamedName).should('exist');

            // A2 — deleting a module referenced by the active academic year is rejected.
            cy.get(`[data-element-id="module-table-row-${module1Id}-delete"]`).click();
            cy.get('[data-element-id="module-delete-blocked-message"]').should('be.visible').and('contain.text', yearName);
            cy.get(`[data-element-id="module-table-row-${module1Id}"]`).should('exist');
          });
      });

    cy.get('@yearApi.all').should('have.length', 0);
    cy.get('@cycleApi.all').should('have.length', 0);
    cy.get('@moduleApi.all').should('have.length', 0);
  });
});
