/// <reference types="cypress" />
// UC-07: Select modules for an academic year

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-07: Select modules for an academic year', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('is disabled with no academic year selected', () => {
    cy.visit('/configuracion/ano-academico');
    cy.get('[data-element-id="module-selection-save-button"]').should('be.disabled');
  });

  it('selecting an academic year shows every module, and saving persists exactly the checked ids', () => {
    const cycleName = `E2E Selection Cycle ${Date.now()}`;
    const yearName = uniqueAcademicYearName('AY-Sel');
    let cycleId: string;
    let moduleId: string;
    let yearId: string;

    cy.request('POST', '/api/training-cycles', { name: cycleName })
      .then(({ body }) => {
        cycleId = (body as { id: string }).id;
        return cy.request('POST', `/api/training-cycles/${cycleId}/modules`, { name: 'E2E Selection Module', course: 1 });
      })
      .then(({ body }) => {
        moduleId = (body as { id: string }).id;
        return cy.request('POST', '/api/academic-years', { name: yearName });
      })
      .then(({ body }) => {
        yearId = (body as { id: string }).id;
        cy.visit('/configuracion/ano-academico');

        // Click the Nombre cell, not the row's bounding-box center — the row also contains
        // the "Marcar en curso"/Editar/Eliminar buttons, and a plain .click() on the <tr>
        // lands wherever its geometric center falls, which can be directly on top of one of
        // those buttons instead of the empty row background.
        cy.get(`[data-element-id="academic-year-table-row-${yearId}"] td`).first().click();
        cy.contains(`[data-element-id="module-selection-table-row-${moduleId}"]`, 'E2E Selection Module').should('exist');
        cy.get(`[data-element-id="module-selection-table-row-${moduleId}-checkbox"]`).should('not.be.checked');

        cy.intercept('PUT', `/api/academic-years/${yearId}/modules`).as('saveSelection');
        cy.get(`[data-element-id="module-selection-table-row-${moduleId}-checkbox"]`).check();
        cy.get('[data-element-id="module-selection-save-button"]').should('not.be.disabled').click();

        cy.wait('@saveSelection').then(({ response }) => {
          expect(response?.statusCode).to.eq(200);
          expect(response?.body).to.deep.equal({ moduleIds: [moduleId] });
        });

        return cy.request('PUT', `/api/academic-years/${yearId}/modules`, { moduleIds: [] });
      })
      .then(() => {
        cy.request('DELETE', `/api/modules/${moduleId}`);
        cy.request('DELETE', `/api/training-cycles/${cycleId}`);
        cy.request('DELETE', `/api/academic-years/${yearId}`);
      });
  });
});
