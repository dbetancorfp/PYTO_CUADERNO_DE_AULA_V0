/// <reference types="cypress" />
// UC-06: Manage academic years (local state — not wired)
//
// Rewritten 2026-08-04: this screen's former backing tables (training_cycles, modules,
// academic_years, academic_year_modules) were dropped and are not recreated in this pass —
// every element here now operates on local component state only, scoped to the page's
// lifetime (a fresh LocalAcademicYearStore per bootstrap, see main.ts). No HTTP request is
// ever made by any interaction on this screen, and nothing persists across a reload — so,
// unlike the previous (now superseded) version of this file, no test here seeds or cleans
// up state via cy.request: every fixture is built through the UI itself, and state resets
// for free on the next cy.visit()/cy.reload().

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

/** Extracts the local-state row id (e.g. `cycle-1`) from a captured `data-element-id`
 * attribute of the form `<tableId>-row-<id>`. */
function rowIdFrom(tableId: string, elementId: string): string {
  return elementId.slice(`${tableId}-row-`.length);
}

describe('UC-06: Manage academic years', () => {
  beforeEach(() => {
    signInAsE2eUser();
    // These paths backed the old, now-dropped tables — asserting zero calls proves the
    // local-state stub never talks to a server, per functional-spec.json's "No network
    // request is made by any interaction on this element".
    cy.intercept('/api/academic-years**').as('yearApi');
    cy.intercept('/api/training-cycles**').as('cycleApi');
    cy.intercept('/api/modules**').as('moduleApi');
    cy.visit('/configuracion/ano-academico');
  });

  it('builds a year with a module selection entirely through the UI, then marks it current and blocks its deletion', () => {
    const yearName = uniqueAcademicYearName('AY-Local');
    const cycleName = `E2E Local Cycle ${Date.now()}`;
    const moduleName = `E2E Local Module ${Date.now()}`;

    cy.get('[data-element-id="academic-year-table"]').should('contain.text', 'Todavía no has creado ningún año académico.');

    cy.get('[data-element-id="academic-year-table-add-button"]').click();
    // No independent save button on the draft row — only a name input and Cancelar.
    cy.get('[data-element-id="academic-year-table-row-new-save"]').should('not.exist');
    cy.get('[data-element-id="academic-year-table-row-new-cancel"]').should('exist');
    cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);

    cy.get('[data-element-id="training-cycle-table-add-button"]').click();
    cy.get('[data-element-id="training-cycle-table-row-new-name"]').type(cycleName);
    cy.get('[data-element-id="training-cycle-table-row-new-save"]').click();

    cy.contains('[data-element-id^="training-cycle-table-row-"]', cycleName)
      .invoke('attr', 'data-element-id')
      .then((cycleRowElementId) => {
        const cycleId = rowIdFrom('training-cycle-table', cycleRowElementId as string);
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).click();

        cy.get('[data-element-id="module-selection-add-button"]').click();
        cy.get('[data-element-id="module-selection-table-row-new-name"]').type(moduleName);
        cy.get('[data-element-id="module-selection-table-row-new-course"]').select('1');
        cy.get('[data-element-id="module-selection-table-row-new-save"]').click();

        // New selection modules are pre-checked automatically.
        cy.contains('[data-element-id^="module-selection-table-row-"]', moduleName)
          .find('input[type="checkbox"]')
          .should('be.checked');

        cy.get('[data-element-id="module-selection-save-button"]').click();

        cy.get('[data-element-id="module-selection-save-message"]').should(
          'contain.text',
          'Año académico y selección de módulos guardados',
        );
        cy.get('[data-element-id="module-selection-table"]').should('not.exist');
        cy.contains('[data-element-id="module-table"]', moduleName).should('exist');

        cy.contains('[data-element-id^="academic-year-table-row-"]', yearName)
          .invoke('attr', 'data-element-id')
          .then((yearRowElementId) => {
            const yearId = rowIdFrom('academic-year-table', yearRowElementId as string);

            cy.get(`[data-element-id="academic-year-table-row-${yearId}-set-current"]`).click();
            cy.contains(`[data-element-id="academic-year-table-row-${yearId}"]`, 'En curso').should('exist');

            cy.get(`[data-element-id="academic-year-table-row-${yearId}-delete"]`).click();
            cy.get('[data-element-id="academic-year-delete-blocked-message"]').should('be.visible');
            cy.get(`[data-element-id="academic-year-table-row-${yearId}"]`).should('exist');
          });
      });

    cy.get('@yearApi.all').should('have.length', 0);
    cy.get('@cycleApi.all').should('have.length', 0);
    cy.get('@moduleApi.all').should('have.length', 0);
  });

  it('A1: rejects a duplicate name inline, keeping the draft open, and no network request is ever made', () => {
    const yearName = uniqueAcademicYearName('AY-Dup');

    cy.get('[data-element-id="academic-year-table-add-button"]').click();
    cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);
    cy.get('[data-element-id="module-selection-save-button"]').click();
    cy.get('[data-element-id="module-selection-save-message"]').should('contain.text', 'guardados');

    cy.get('[data-element-id="academic-year-table-add-button"]').click();
    cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);
    cy.get('[data-element-id="module-selection-save-button"]').click();

    cy.get('[data-element-id="module-selection-save-message"]').should(
      'contain.text',
      'Ya existe un año académico con ese nombre',
    );
    cy.get('[data-element-id="academic-year-table-row-new-name"]').should('have.value', yearName);
    cy.get('[data-element-id="academic-year-table"]').find(`td:contains("${yearName}")`).should('have.length', 1);

    cy.get('@yearApi.all').should('have.length', 0);
    cy.get('@cycleApi.all').should('have.length', 0);
    cy.get('@moduleApi.all').should('have.length', 0);
  });
});
