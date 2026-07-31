/// <reference types="cypress" />
// UC-05: Manage training cycles
//
// Rewritten 2026-07-31 for the three-mode Año académico redesign: in normal mode
// `training-cycle-table` only shows cycles with a module already selected for the active
// academic year, and saving `training-cycle-table-add-button`'s draft while normal mode is
// active switches the screen into adding-cycle mode (UC-05 A5) instead of just appending a
// row — this file's main-flow test exercises exactly that transition.

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-05: Manage training cycles', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ano-academico');
  });

  it('adding-cycle mode: saving a new cycle while a year is selected switches module-table off / module-selection-table on', () => {
    const yearName = uniqueAcademicYearName('AY-C');
    const cycleName = `E2E Adding Cycle ${Date.now()}`;
    const moduleName = `E2E Adding Module ${Date.now()}`;
    let yearId: string;

    cy.request('POST', '/api/academic-years', { name: yearName })
      .then(({ body }) => {
        yearId = (body as { id: string }).id;
        return cy.request('PATCH', `/api/academic-years/${yearId}`, { isCurrent: true });
      })
      .then(() => {
        cy.reload();
        cy.contains(`[data-element-id="academic-year-table-row-${yearId}"]`, 'En curso').should('exist');
        cy.get('[data-element-id="module-table"]').should('exist');
        cy.get('[data-element-id="module-selection-table"]').should('not.exist');

        cy.intercept('POST', '/api/training-cycles').as('createCycle');
        cy.get('[data-element-id="training-cycle-table-add-button"]').click();
        cy.get('[data-element-id="training-cycle-table-row-new-name"]').type(cycleName);
        cy.get('[data-element-id="training-cycle-table-row-new-save"]').click();

        cy.wait('@createCycle').then(({ response }) => {
          expect(response?.statusCode).to.eq(201);
          const cycleId = (response?.body as { id: string }).id;

          cy.get('[data-element-id="module-table"]').should('not.exist');
          cy.get('[data-element-id="module-selection-table"]').should('exist');
          cy.intercept('POST', `/api/training-cycles/${cycleId}/modules`).as('createModule');
          cy.get('[data-element-id="module-selection-add-button"]').click();
          cy.get('[data-element-id="module-selection-table-row-new-name"]').type(moduleName);
          cy.get('[data-element-id="module-selection-table-row-new-course"]').select('1');
          cy.get('[data-element-id="module-selection-table-row-new-save"]').click();
          cy.get(`[data-element-id="module-selection-table-row-new"]`).should('not.exist');

          cy.wait('@createModule').then(({ response: moduleResponse }) => {
            const moduleId = (moduleResponse?.body as { id: string }).id;

            cy.intercept('PUT', `/api/academic-years/${yearId}/modules`).as('saveSelection');
            cy.get('[data-element-id="module-selection-save-button"]').click();
            cy.wait('@saveSelection').its('response.statusCode').should('eq', 200);

            cy.get('[data-element-id="module-selection-table"]').should('not.exist');
            cy.contains(`[data-element-id="training-cycle-table-row-${cycleId}"]`, cycleName).should('exist');
            cy.contains(`[data-element-id="module-table-row-${moduleId}"]`, moduleName).should('exist');

            cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [] });
            cy.request('POST', '/api/academic-years', { name: uniqueAcademicYearName('AY-Clean') }).then(({ body }) => {
              const cleanupId = (body as { id: string }).id;
              cy.request('PATCH', `/api/academic-years/${cleanupId}`, { isCurrent: true });
              cy.request('DELETE', `/api/academic-years/${yearId}`);
              cy.request('DELETE', `/api/modules/${moduleId}`);
              cy.request('DELETE', `/api/training-cycles/${cycleId}`);
            });
          });
        });
      });
  });

  it('rejects deleting a cycle whose module is referenced by an academic year, naming it', () => {
    const cycleName = `E2E Cycle Blocked ${Date.now()}`;
    const yearName = uniqueAcademicYearName('AY-Cyc');
    let cycleId: string;
    let yearId: string;

    cy.request('POST', '/api/training-cycles', { name: cycleName })
      .then(({ body }) => {
        cycleId = (body as { id: string }).id;
        return cy.request('POST', `/api/training-cycles/${cycleId}/modules`, { name: 'E2E Module', course: 1 });
      })
      .then(({ body: moduleBody }) => {
        const moduleId = (moduleBody as { id: string }).id;
        return cy.request('POST', '/api/academic-years', { name: yearName }).then(({ body: yearBody }) => {
          yearId = (yearBody as { id: string }).id;
          return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [moduleId] });
        });
      })
      .then(() => cy.request('PATCH', `/api/academic-years/${yearId}`, { isCurrent: true }))
      .then(() => {
        cy.reload();
        // Normal mode: this cycle is shown (it has a module selected for the current year).
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}-delete"]`).click();
        cy.get('[data-element-id="training-cycle-delete-blocked-message"]').should('contain.text', yearName);
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).should('exist');

        // cleanup: clear the selection so the cycle (and, separately, the year) can be removed
        return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [] });
      })
      .then(() => {
        cy.request('DELETE', `/api/training-cycles/${cycleId}`);
        cy.request('POST', '/api/academic-years', { name: uniqueAcademicYearName('AY-Clean') }).then(({ body }) => {
          const cleanupId = (body as { id: string }).id;
          cy.request('PATCH', `/api/academic-years/${cleanupId}`, { isCurrent: true });
          cy.request('DELETE', `/api/academic-years/${yearId}`);
        });
      });
  });
});
