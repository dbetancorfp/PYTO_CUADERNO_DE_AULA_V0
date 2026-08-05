/// <reference types="cypress" />
// UC-09: Build and commit an academic year's module selection (local state — not wired)
//
// Rewritten 2026-08-04 — see UC-06's header comment for the redesign context shared by this
// whole screen. module-selection-table only exists in adding-year/adding-cycle mode;
// toggling a checkbox is purely in-progress local state until module-selection-save-button
// commits it.

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe("UC-09: Build and commit an academic year's module selection", () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.intercept('/api/academic-years**').as('yearApi');
    cy.intercept('/api/training-cycles**').as('cycleApi');
    cy.intercept('/api/modules**').as('moduleApi');
    cy.visit('/configuracion/ano-academico');
  });

  it('is hidden in normal mode; toggling a checkbox does not commit anything until the save button is clicked', () => {
    const yearName = uniqueAcademicYearName('AY-Sel');
    const cycleName = `E2E Sel Cycle ${Date.now()}`;
    const moduleName = `E2E Sel Module ${Date.now()}`;

    cy.get('[data-element-id="module-selection-table"]').should('not.exist');

    cy.get('[data-element-id="academic-year-table-add-button"]').click();
    cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);
    cy.get('[data-element-id="training-cycle-table-add-button"]').click();
    cy.get('[data-element-id="training-cycle-table-row-new-name"]').type(cycleName);
    cy.get('[data-element-id="training-cycle-table-row-new-save"]').click();

    cy.contains('[data-element-id^="training-cycle-table-row-"]', cycleName).click();

    // A1 — a freshly-created cycle with no modules yet still shows module-selection-table,
    // with the add button as the way in ("fuses into the table").
    cy.get('[data-element-id="module-selection-table"]').should('contain.text', 'todavía no tiene módulos');
    cy.get('[data-element-id="module-selection-add-button"]').should('be.visible');

    cy.get('[data-element-id="module-selection-add-button"]').click();
    cy.get('[data-element-id="module-selection-table-row-new-name"]').type(moduleName);
    cy.get('[data-element-id="module-selection-table-row-new-course"]').select('1');
    cy.get('[data-element-id="module-selection-table-row-new-save"]').click();

    cy.contains('[data-element-id^="module-selection-table-row-"]', moduleName).as('newModuleRow');
    cy.get('@newModuleRow').find('input[type="checkbox"]').should('be.checked');

    // Toggling off, then back on: neither click persists or shows a result by itself —
    // the screen stays in adding-year mode with no save message yet.
    cy.get('@newModuleRow').find('input[type="checkbox"]').uncheck();
    cy.get('@newModuleRow').find('input[type="checkbox"]').should('not.be.checked');
    cy.get('[data-element-id="module-selection-save-message"]').should('not.exist');
    cy.get('[data-element-id="module-selection-table"]').should('exist');

    cy.get('@newModuleRow').find('input[type="checkbox"]').check();
    cy.get('[data-element-id="module-selection-save-message"]').should('not.exist');

    cy.get('[data-element-id="module-selection-save-button"]').click();

    cy.get('[data-element-id="module-selection-save-message"]').should('be.visible').and('contain.text', 'guardados');
    cy.get('[data-element-id="module-selection-table"]').should('not.exist');
    cy.contains('[data-element-id="module-table"]', moduleName).should('exist');

    cy.get('@yearApi.all').should('have.length', 0);
    cy.get('@cycleApi.all').should('have.length', 0);
    cy.get('@moduleApi.all').should('have.length', 0);
  });

  it('A1 variant: an empty selection can still be saved, returning to normal mode with the save button hidden again', () => {
    const yearName = uniqueAcademicYearName('AY-Empty');

    cy.get('[data-element-id="academic-year-table-add-button"]').click();
    cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);
    cy.get('[data-element-id="module-selection-save-button"]').should('be.visible').click();

    cy.get('[data-element-id="module-selection-save-message"]').should('be.visible').and('contain.text', 'guardados');
    cy.get('[data-element-id="module-selection-table"]').should('not.exist');
    cy.get('[data-element-id="module-selection-save-button"]').should('not.exist');
    cy.contains('[data-element-id^="academic-year-table-row-"]', yearName).should('exist');

    cy.get('@yearApi.all').should('have.length', 0);
    cy.get('@cycleApi.all').should('have.length', 0);
    cy.get('@moduleApi.all').should('have.length', 0);
  });
});
