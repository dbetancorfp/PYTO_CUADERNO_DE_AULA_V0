/// <reference types="cypress" />
// UC-07: Manage training cycles (local state — not wired)
//
// Rewritten 2026-08-04 — see UC-06's header comment for the redesign context shared by this
// whole screen. `training-cycle-table` shows two different local-state views depending on
// mode: normal mode filters to cycles with >=1 module selected for the active academic
// year; adding-year/adding-cycle mode shows the complete local-state cycle list. This file
// proves that distinction, plus the local-state dependency-blocked deletion.

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

function rowIdFrom(tableId: string, elementId: string): string {
  return elementId.slice(`${tableId}-row-`.length);
}

/** Builds, through the UI only, one committed academic year with one training cycle and
 * one module selected for it, ending back in normal mode. Yields the cycle's local-state
 * id. Shared by both tests below — see UC-06's main-flow test for the same base pattern. */
function buildYearWithOneCycleAndModule(yearName: string, yearTag: string): Cypress.Chainable<string> {
  const cycleName = `E2E Cycle ${yearTag} ${Date.now()}`;
  const moduleName = `E2E Module ${yearTag} ${Date.now()}`;

  cy.get('[data-element-id="academic-year-table-add-button"]').click();
  cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);
  cy.get('[data-element-id="training-cycle-table-add-button"]').click();
  cy.get('[data-element-id="training-cycle-table-row-new-name"]').type(cycleName);
  cy.get('[data-element-id="training-cycle-table-row-new-save"]').click();

  return cy
    .contains('[data-element-id^="training-cycle-table-row-"]', cycleName)
    .invoke('attr', 'data-element-id')
    .then((cycleElementId) => {
      const cycleId = rowIdFrom('training-cycle-table', cycleElementId as string);
      cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).click();
      cy.get('[data-element-id="module-selection-add-button"]').click();
      cy.get('[data-element-id="module-selection-table-row-new-name"]').type(moduleName);
      cy.get('[data-element-id="module-selection-table-row-new-course"]').select('1');
      cy.get('[data-element-id="module-selection-table-row-new-save"]').click();
      cy.get('[data-element-id="module-selection-save-button"]').click();
      cy.get('[data-element-id="module-selection-save-message"]').should('contain.text', 'guardados');
      return cy.wrap(cycleId);
    });
}

describe('UC-07: Manage training cycles', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.intercept('/api/academic-years**').as('yearApi');
    cy.intercept('/api/training-cycles**').as('cycleApi');
    cy.intercept('/api/modules**').as('moduleApi');
    cy.visit('/configuracion/ano-academico');
  });

  it('normal mode filters to referenced cycles only; adding a new cycle switches to the complete list', () => {
    const cycle2Name = `E2E Decoy Cycle ${Date.now()}`;
    const yearName = uniqueAcademicYearName('AY-Cyc');

    buildYearWithOneCycleAndModule(yearName, 'AY-Cyc').then((cycle1Id) => {
      // Normal mode: training-cycle-table shows only cycle 1 (it has a selected module).
      cy.get(`[data-element-id="training-cycle-table-row-${cycle1Id}"]`).should('exist');
      cy.get('[data-element-id="training-cycle-table"]').find('tbody tr[data-element-id]').should('have.length', 1);

      // Adding a second, decoy cycle from normal mode switches into adding-cycle mode —
      // the complete, unfiltered list now shows both cycles, proving the filter really is
      // lifted (cycle 2 has zero modules selected, so normal mode alone would hide it).
      cy.get('[data-element-id="training-cycle-table-add-button"]').click();
      cy.get('[data-element-id="training-cycle-table-row-new-name"]').type(cycle2Name);
      cy.get('[data-element-id="training-cycle-table-row-new-save"]').click();

      cy.get(`[data-element-id="training-cycle-table-row-${cycle1Id}"]`).should('exist');
      cy.contains('[data-element-id^="training-cycle-table-row-"]', cycle2Name).should('exist');
      cy.get('[data-element-id="module-table"]').should('not.exist');
      cy.get('[data-element-id="module-selection-table"]').should('exist');

      // Re-selecting the already-active academic year row returns to normal mode,
      // discarding the in-progress adding-cycle draft — cycle 2 (never given a selected
      // module) disappears from the now-filtered list again. Clicked via its Nombre cell
      // specifically, not the whole <tr>: Cypress clicks the row's bounding-box center,
      // which on this row lands on the wide "Marcar en curso" button rather than plain
      // row background, firing set-current instead of row-select.
      cy.contains('[data-element-id^="academic-year-table-row-"]', yearName).find('td').first().click();
      cy.get(`[data-element-id="training-cycle-table-row-${cycle1Id}"]`).should('exist');
      cy.contains('[data-element-id^="training-cycle-table-row-"]', cycle2Name).should('not.exist');
      cy.get('[data-element-id="module-table"]').should('exist');
      cy.get('[data-element-id="module-selection-table"]').should('not.exist');
    });

    cy.get('@yearApi.all').should('have.length', 0);
    cy.get('@cycleApi.all').should('have.length', 0);
    cy.get('@moduleApi.all').should('have.length', 0);
  });

  it('A2: rejects deleting a cycle whose module is referenced by the active academic year, naming it', () => {
    const yearName = uniqueAcademicYearName('AY-Block');

    buildYearWithOneCycleAndModule(yearName, 'AY-Block').then((cycleId) => {
      cy.get(`[data-element-id="training-cycle-table-row-${cycleId}-delete"]`).click();
      cy.get('[data-element-id="training-cycle-delete-blocked-message"]').should('be.visible').and('contain.text', yearName);
      cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).should('exist');
    });

    cy.get('@yearApi.all').should('have.length', 0);
    cy.get('@cycleApi.all').should('have.length', 0);
    cy.get('@moduleApi.all').should('have.length', 0);
  });
});
