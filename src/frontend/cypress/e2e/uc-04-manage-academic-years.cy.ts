/// <reference types="cypress" />
// UC-04: Manage academic years
//
// Rewritten 2026-07-31 for the three-mode Año académico redesign: `academic-year-table` no
// longer creates a year by itself — `academic-year-table-add-button` only opens a draft
// name row with no independent save button (see use-cases.md UC-04 A4); creation happens
// together with the module selection via `module-selection-save-button` (UC-07's main
// flow), which is exactly what this file's first test exercises end to end.

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-04: Manage academic years', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ano-academico');
  });

  it('adding-year mode: creates the year and persists the module selection in one save, then marks it current', () => {
    const cycleName = `E2E AY Cycle ${Date.now()}`;
    const moduleName = `E2E AY Module ${Date.now()}`;
    const yearName = uniqueAcademicYearName('AY-A');
    let cycleId: string;
    let moduleId: string;

    cy.request('POST', '/api/training-cycles', { name: cycleName })
      .then(({ body }) => {
        cycleId = (body as { id: string }).id;
        return cy.request('POST', `/api/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 });
      })
      .then(({ body }) => {
        moduleId = (body as { id: string }).id;
        cy.reload();

        cy.get('[data-element-id="academic-year-table-add-button"]').click();
        // No independent save button on the draft row — only a name input and Cancelar.
        cy.get('[data-element-id="academic-year-table-row-new-save"]').should('not.exist');
        cy.get('[data-element-id="academic-year-table-row-new-cancel"]').should('exist');
        cy.get('[data-element-id="academic-year-table-row-new-name"]').type(yearName);

        // adding-year mode shows the complete, unfiltered cycle list.
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).click();
        cy.contains(`[data-element-id="module-selection-table-row-${moduleId}"]`, moduleName).should('exist');
        cy.get(`[data-element-id="module-selection-table-row-${moduleId}-checkbox"]`).check();

        cy.intercept('POST', '/api/academic-years').as('createYear');
        cy.get('[data-element-id="module-selection-save-button"]').click();

        cy.wait('@createYear').then(({ response }) => {
          expect(response?.statusCode).to.eq(201);
          const yearId = (response?.body as { id: string }).id;

          // Back in normal mode, the new year is selected — module-selection-table is gone.
          cy.get('[data-element-id="module-selection-table"]').should('not.exist');
          cy.get('[data-element-id="module-selection-save-message"]').should('be.visible');
          cy.contains(`[data-element-id="academic-year-table-row-${yearId}"]`, yearName).should('exist');
          cy.contains(`[data-element-id="module-table-row-${moduleId}"]`, moduleName).should('exist');

          cy.get(`[data-element-id="academic-year-table-row-${yearId}-set-current"]`).click();
          cy.contains(`[data-element-id="academic-year-table-row-${yearId}"]`, 'En curso').should('exist');

          cy.get(`[data-element-id="academic-year-table-row-${yearId}-delete"]`).click();
          cy.get('[data-element-id="academic-year-delete-blocked-message"]').should('be.visible');

          // cleanup: mark a throwaway year current to unmark this one, so it can be deleted —
          // the API has no way to unset "current" without marking a different row, so at
          // least one academic year is always left current once any has ever been marked.
          cy.request('POST', '/api/academic-years', { name: uniqueAcademicYearName('AY-Clean') }).then(({ body }) => {
            const cleanupId = (body as { id: string }).id;
            cy.request('PATCH', `/api/academic-years/${cleanupId}`, { isCurrent: true });
            cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [] });
            cy.request('DELETE', `/api/academic-years/${yearId}`);
          });
        });
      })
      .then(() => {
        cy.request('DELETE', `/api/modules/${moduleId}`);
        cy.request('DELETE', `/api/training-cycles/${cycleId}`);
      });
  });

  it('cancelling the draft row discards the name and in-progress selection, restoring the previous view', () => {
    const yearName = uniqueAcademicYearName('AY-B');
    let yearId: string;

    cy.request('POST', '/api/academic-years', { name: yearName })
      .then(({ body }) => {
        yearId = (body as { id: string }).id;
        return cy.request('PATCH', `/api/academic-years/${yearId}`, { isCurrent: true });
      })
      .then(() => {
        cy.reload();
        cy.contains(`[data-element-id="academic-year-table-row-${yearId}"]`, 'En curso').should('exist');

        cy.get('[data-element-id="academic-year-table-add-button"]').click();
        cy.get('[data-element-id="academic-year-table-row-new-name"]').type('Descartado');
        cy.get('[data-element-id="academic-year-table-row-new-cancel"]').click();

        cy.get('[data-element-id="academic-year-table-row-new-name"]').should('not.exist');
        cy.get('[data-element-id="module-selection-table"]').should('not.exist');
        cy.get('[data-element-id="module-table"]').should('exist');
        cy.contains(`[data-element-id="academic-year-table-row-${yearId}"]`, 'En curso').should('exist');

        // cleanup: mark a throwaway year current to unmark this one, so it can be deleted —
        // the API has no way to unset "current" without marking a different row.
        cy.request('POST', '/api/academic-years', { name: uniqueAcademicYearName('AY-Clean') }).then(({ body }) => {
          const cleanupId = (body as { id: string }).id;
          cy.request('PATCH', `/api/academic-years/${cleanupId}`, { isCurrent: true });
          cy.request('DELETE', `/api/academic-years/${yearId}`);
        });
      });
  });
});
