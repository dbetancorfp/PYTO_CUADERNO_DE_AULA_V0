/// <reference types="cypress" />
// UC-09: Build and commit an academic year's módulo selection
//
// Rewritten 2026-08-06 for the 2026-08-05 backend redesign. New-year flow:
// `POST /api/academic-years/selection` (draft start year + every checked cycle × checked
// módulo, one request). Extend-existing flow: `POST /api/academic-years/:id/modules` — see
// uc-07-manage-training-cycles.cy.ts's alt-flow test, which already exercises that flow end
// to end (extend mode is entered via UC-06 A6/UC-07, so it's tested alongside it there
// rather than duplicated here).

import { signInAsE2eUser, uniqueStartYear } from './support/sign-in';

interface CatalogCycle {
  id: string;
}
interface CatalogModule {
  id: string;
}

describe("UC-09: Build and commit an academic year's módulo selection", () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('toggling a checkbox does not persist by itself; a click persists the draft year and every checked módulo in one request', () => {
    const cycleName = `E2E UC09 Cycle ${Date.now()}`;
    const moduleName = `E2E UC09 Module ${Date.now()}`;
    const startYear = uniqueStartYear();

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;
      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(({ body: moduleBody }) => {
        const moduleId = (moduleBody as CatalogModule).id;
        cy.visit('/configuracion/ano-academico');

        cy.get('[data-element-id="academic-year-table-add-button"]').click();
        // A2 — nothing checked yet: module-selection-table shows a prompt, save-button has nothing to submit.
        cy.get('[data-element-id="module-selection-table"]').should('contain.text', 'Marca un ciclo');
        cy.get('[data-element-id="module-selection-save-button"]').should('exist');

        cy.get('[data-element-id="academic-year-table-row-new-name"]').type(String(startYear));
        cy.get(`[data-element-id="training-cycle-table-row-${cycleId}-checkbox"]`).click();

        cy.intercept('POST', '/api/academic-years/selection').as('createSelection');
        cy.get(`[data-element-id="module-selection-table-row-${moduleId}-checkbox"]`).click();
        // Toggling alone must not have fired the request yet.
        cy.get('@createSelection.all').should('have.length', 0);

        cy.get('[data-element-id="module-selection-save-button"]').click();
        cy.wait('@createSelection').then(({ request, response }) => {
          expect(request.body).to.deep.equal({ startYear, moduleIds: [moduleId] });
          expect(response?.statusCode).to.eq(201);
        });

        cy.get('[data-element-id="module-selection-save-message"]').should('be.visible');
        // Returns to normal mode with the newly-created year selected.
        cy.get('[data-element-id="module-selection-table"]').should('not.exist');
        cy.get('[data-element-id="module-selection-save-button"]').should('not.exist');
        cy.contains('[data-element-id^="academic-year-table-row-"]', `${startYear}-${startYear + 1}`).should('have.class', 'bg-slate-100');

        cy.request('GET', '/api/academic-years').then(({ body }) => {
          const created = (body as { academicYears: { id: string; startYear: number }[] }).academicYears.find((y) => y.startYear === startYear)!;
          cy.request('GET', `/api/academic-years/${created.id}/modules`).then(({ body: modulesBody }) => {
            const assignmentId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;
            cy.request('DELETE', `/api/academic-year-modules/${assignmentId}`);
            cy.request('DELETE', `/api/academic-years/${created.id}`);
            cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
          });
        });
      });
    });
  });

  it('A1: a duplicate start year on save shows academic-year-toast and keeps adding mode open', () => {
    const existingStartYear = uniqueStartYear();

    cy.request('POST', '/api/academic-years/selection', { startYear: existingStartYear, moduleIds: [] }).then(({ body }) => {
      const existingYear = (body as { academicYear: { id: string } }).academicYear;
      cy.visit('/configuracion/ano-academico');

      cy.get('[data-element-id="academic-year-table-add-button"]').click();
      cy.get('[data-element-id="academic-year-table-row-new-name"]').type(String(existingStartYear));

      cy.intercept('POST', '/api/academic-years/selection').as('createSelection');
      cy.get('[data-element-id="module-selection-save-button"]').click();
      cy.wait('@createSelection').its('response.statusCode').should('eq', 409);

      cy.get('[data-element-id="academic-year-toast"]').should('be.visible');
      cy.get('[data-element-id="academic-year-table-row-new-name"]').should('have.value', String(existingStartYear));
      cy.get('[data-element-id="module-selection-save-button"]').should('exist');

      cy.request('DELETE', `/api/academic-years/${existingYear.id}`);
    });
  });
});
