/// <reference types="cypress" />
// UC-06: Manage modules within a training cycle

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-06: Manage modules within a training cycle', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ano-academico');
  });

  it('is disabled with no cycle chosen, then choosing a cycle reloads module-table and a new module can be added', () => {
    const cycleName = `E2E Module Cycle ${Date.now()}`;
    const moduleName = `E2E Module ${Date.now()}`;

    cy.get('[data-element-id="module-table-add-button"]').should('be.disabled');

    cy.request('POST', '/api/training-cycles', { name: cycleName }).then(({ body }) => {
      const cycleId = (body as { id: string }).id;
      cy.reload();

      cy.get('[data-element-id="module-cycle-select"]').select(cycleId);
      cy.get('[data-element-id="module-table-add-button"]').should('not.be.disabled');

      cy.intercept('POST', `/api/training-cycles/${cycleId}/modules`).as('createModule');
      cy.get('[data-element-id="module-table-add-button"]').click();
      cy.get('[data-element-id="module-table-row-new-name"]').type(moduleName);
      cy.get('[data-element-id="module-table-row-new-course"]').select('1');
      cy.get('[data-element-id="module-table-row-new-save"]').click();

      cy.wait('@createModule').then(({ response }) => {
        expect(response?.statusCode).to.eq(201);
        const moduleId = (response?.body as { id: string }).id;
        cy.contains(`[data-element-id="module-table-row-${moduleId}"]`, moduleName).should('exist');

        cy.request('DELETE', `/api/modules/${moduleId}`);
      });
      cy.request('DELETE', `/api/training-cycles/${cycleId}`);
    });
  });

  it('opens module-edit-confirm-modal for a referenced module, and confirming persists the edit', () => {
    const cycleName = `E2E Confirm Cycle ${Date.now()}`;
    const yearName = uniqueAcademicYearName('AY-Conf');
    let cycleId: string;
    let moduleId: string;
    let yearId: string;

    cy.request('POST', '/api/training-cycles', { name: cycleName })
      .then(({ body }) => {
        cycleId = (body as { id: string }).id;
        return cy.request('POST', `/api/training-cycles/${cycleId}/modules`, { name: 'E2E Confirm Module', course: 1 });
      })
      .then(({ body }) => {
        moduleId = (body as { id: string }).id;
        return cy.request('POST', '/api/academic-years', { name: yearName });
      })
      .then(({ body }) => {
        yearId = (body as { id: string }).id;
        return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [moduleId] });
      })
      .then(() => {
        cy.reload();
        cy.get('[data-element-id="module-cycle-select"]').select(cycleId);

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
        cy.request('DELETE', `/api/academic-years/${yearId}`);
      });
  });
});
