/// <reference types="cypress" />
// UC-05: Manage training cycles

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-05: Manage training cycles', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ano-academico');
  });

  it('adds a new training cycle and it appears in the table', () => {
    const name = `E2E Cycle ${Date.now()}`;

    cy.intercept('POST', '/api/training-cycles').as('createCycle');
    cy.get('[data-element-id="training-cycle-table-add-button"]').click();
    cy.get('[data-element-id="training-cycle-table-row-new-name"]').type(name);
    cy.get('[data-element-id="training-cycle-table-row-new-save"]').click();

    cy.wait('@createCycle').then(({ response }) => {
      expect(response?.statusCode).to.eq(201);
      const cycleId = (response?.body as { id: string }).id;
      cy.contains(`[data-element-id="training-cycle-table-row-${cycleId}"]`, name).should('exist');

      cy.request('DELETE', `/api/training-cycles/${cycleId}`);
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
      .then(() => {
        cy.reload();
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}-delete"]`).click();
        cy.get('[data-element-id="training-cycle-delete-blocked-message"]').should('contain.text', yearName);
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).should('exist');

        // cleanup: clear the selection so the cycle (and, separately, the year) can be removed
        return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [] });
      })
      .then(() => {
        cy.request('DELETE', `/api/training-cycles/${cycleId}`);
        cy.request('DELETE', `/api/academic-years/${yearId}`);
      });
  });
});
