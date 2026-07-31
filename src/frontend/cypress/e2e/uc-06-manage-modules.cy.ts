/// <reference types="cypress" />
// UC-06: Manage modules within a training cycle
//
// Rewritten 2026-07-31 for the three-mode Año académico redesign: `module-cycle-select` is
// removed — a cycle is selected by clicking its `training-cycle-table` row, and
// `module-table` (normal mode only) shows a cycle's modules that are also selected for the
// active academic year, not every module of the cycle. Both tests below set up a year and
// a cycle with one module already selected for that year, then exercise `module-table`
// from there.

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-06: Manage modules within a training cycle', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('is disabled with no cycle selected, then choosing one enables it and a new module can be added', () => {
    const yearName = uniqueAcademicYearName('AY-Mod');
    const cycleName = `E2E Module Cycle ${Date.now()}`;
    const seedModuleName = `E2E Seed Module ${Date.now()}`;
    const newModuleName = `E2E New Module ${Date.now()}`;
    let yearId: string;
    let cycleId: string;

    cy.request('POST', '/api/academic-years', { name: yearName })
      .then(({ body }) => {
        yearId = (body as { id: string }).id;
        return cy.request('PATCH', `/api/academic-years/${yearId}`, { isCurrent: true });
      })
      .then(() => {
        // A fresh year with no cycles yet: training-cycle-table has no selected row, so
        // module-table-add-button is disabled.
        cy.visit('/configuracion/ano-academico');
        cy.contains(`[data-element-id="academic-year-table-row-${yearId}"]`, 'En curso').should('exist');
        cy.get('[data-element-id="module-table-add-button"]').should('be.disabled');

        return cy.request('POST', '/api/training-cycles', { name: cycleName });
      })
      .then(({ body }) => {
        cycleId = (body as { id: string }).id;
        return cy.request('POST', `/api/training-cycles/${cycleId}/modules`, { name: seedModuleName, course: 1 });
      })
      .then(({ body }) => {
        const seedModuleId = (body as { id: string }).id;
        return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [seedModuleId] }).then(() => ({
          seedModuleId,
        }));
      })
      .then(({ seedModuleId }) => {
        cy.reload();
        cy.contains(`[data-element-id="module-table-row-${seedModuleId}"]`, seedModuleName).should('exist');
        cy.get('[data-element-id="module-table-add-button"]').should('not.be.disabled');

        cy.intercept('POST', `/api/training-cycles/${cycleId}/modules`).as('createModule');
        cy.get('[data-element-id="module-table-add-button"]').click();
        cy.get('[data-element-id="module-table-row-new-name"]').type(newModuleName);
        cy.get('[data-element-id="module-table-row-new-course"]').select('2');
        cy.get('[data-element-id="module-table-row-new-save"]').click();

        cy.wait('@createModule').then(({ response }) => {
          expect(response?.statusCode).to.eq(201);
          const newModuleId = (response?.body as { id: string }).id;
          cy.contains(`[data-element-id="module-table-row-${newModuleId}"]`, newModuleName).should('exist');

          cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [] });
          cy.request('DELETE', `/api/modules/${newModuleId}`);
          cy.request('DELETE', `/api/modules/${seedModuleId}`);
          cy.request('DELETE', `/api/training-cycles/${cycleId}`);
          cy.request('POST', '/api/academic-years', { name: uniqueAcademicYearName('AY-Clean') }).then(({ body }) => {
            const cleanupId = (body as { id: string }).id;
            cy.request('PATCH', `/api/academic-years/${cleanupId}`, { isCurrent: true });
            cy.request('DELETE', `/api/academic-years/${yearId}`);
          });
        });
      });
  });

  it('opens module-edit-confirm-modal for a referenced module, and confirming persists the edit', () => {
    const yearName = uniqueAcademicYearName('AY-Conf');
    const cycleName = `E2E Confirm Cycle ${Date.now()}`;
    let yearId: string;
    let cycleId: string;
    let moduleId: string;

    cy.request('POST', '/api/academic-years', { name: yearName })
      .then(({ body }) => {
        yearId = (body as { id: string }).id;
        return cy.request('PATCH', `/api/academic-years/${yearId}`, { isCurrent: true });
      })
      .then(() => cy.request('POST', '/api/training-cycles', { name: cycleName }))
      .then(({ body }) => {
        cycleId = (body as { id: string }).id;
        return cy.request('POST', `/api/training-cycles/${cycleId}/modules`, { name: 'E2E Confirm Module', course: 1 });
      })
      .then(({ body }) => {
        moduleId = (body as { id: string }).id;
        return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [moduleId] });
      })
      .then(() => {
        cy.visit('/configuracion/ano-academico');
        cy.get(`[data-element-id="module-table-row-${moduleId}-edit"]`).click();
        cy.get(`[data-element-id="module-table-row-${moduleId}-name"]`).clear().type('E2E Confirm Module Renamed');
        cy.get(`[data-element-id="module-table-row-${moduleId}-save"]`).click();

        cy.get('[data-element-id="module-edit-confirm-modal"]').should('be.visible').and('contain.text', yearName);

        cy.intercept('PATCH', `/api/modules/${moduleId}`).as('confirmEdit');
        cy.get('[data-element-id="module-edit-confirm-modal-confirm"]').click();
        cy.wait('@confirmEdit').its('response.statusCode').should('eq', 200);
        cy.get('[data-element-id="module-edit-confirm-modal"]').should('not.exist');
        cy.contains(`[data-element-id="module-table-row-${moduleId}"]`, 'E2E Confirm Module Renamed').should('exist');

        return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [] });
      })
      .then(() => {
        cy.request('DELETE', `/api/modules/${moduleId}`);
        cy.request('DELETE', `/api/training-cycles/${cycleId}`);
        cy.request('POST', '/api/academic-years', { name: uniqueAcademicYearName('AY-Clean') }).then(({ body }) => {
          const cleanupId = (body as { id: string }).id;
          cy.request('PATCH', `/api/academic-years/${cleanupId}`, { isCurrent: true });
          cy.request('DELETE', `/api/academic-years/${yearId}`);
        });
      });
  });
});
