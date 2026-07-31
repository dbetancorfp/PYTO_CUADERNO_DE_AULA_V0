/// <reference types="cypress" />
// UC-07: Build and save an academic year's module selection
//
// Rewritten 2026-07-31 for the three-mode Año académico redesign: `module-selection-table`
// is no longer always visible once an academic year is selected — it only appears in
// adding-year/adding-cycle mode (see UC-04/UC-05). The successful create+persist path is
// already exercised end to end by uc-04's main-flow test; this file covers the two
// alternative flows most specific to `module-selection-save-button` itself: a cycle with
// zero modules (the fused add-button, UC-07 A1) and a duplicate academic year name (UC-07
// A2).

import { signInAsE2eUser, uniqueAcademicYearName } from './support/sign-in';

describe('UC-07: Build and save an academic year\'s module selection', () => {
  beforeEach(() => {
    signInAsE2eUser();
    cy.visit('/configuracion/ano-academico');
  });

  it('is hidden in normal mode, and A1: a cycle with zero modules shows the fused add-button', () => {
    const cycleName = `E2E Empty Cycle ${Date.now()}`;

    cy.get('[data-element-id="module-selection-table"]').should('not.exist');

    cy.request('POST', '/api/training-cycles', { name: cycleName }).then(({ body }) => {
      const cycleId = (body as { id: string }).id;

      cy.get('[data-element-id="academic-year-table-add-button"]').click();
      cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).click();

      cy.get('[data-element-id="module-selection-table"]').should('exist');
      cy.get('[data-element-id="module-selection-add-button"]').should('be.visible');
      cy.get('[data-element-id="module-selection-table"]').should('contain.text', 'todavía no tiene módulos');

      cy.request('DELETE', `/api/training-cycles/${cycleId}`);
    });
  });

  it('A2: a duplicate academic year name shows an error and keeps the draft intact', () => {
    const existingYearName = uniqueAcademicYearName('AY-Dup');

    cy.request('POST', '/api/academic-years', { name: existingYearName }).then(({ body }) => {
      const existingYearId = (body as { id: string }).id;
      cy.reload();

      cy.get('[data-element-id="academic-year-table-add-button"]').click();
      cy.get('[data-element-id="academic-year-table-row-new-name"]').type(existingYearName);

      cy.intercept('POST', '/api/academic-years').as('createYear');
      cy.get('[data-element-id="module-selection-save-button"]').click();
      cy.wait('@createYear').its('response.statusCode').should('eq', 409);

      cy.get('[data-element-id="module-selection-save-message"]').should('be.visible');
      cy.get('[data-element-id="academic-year-table-row-new-name"]').should('have.value', existingYearName);
      cy.get('[data-element-id="module-selection-table"]').should('exist');

      cy.request('DELETE', `/api/academic-years/${existingYearId}`);
    });
  });
});
