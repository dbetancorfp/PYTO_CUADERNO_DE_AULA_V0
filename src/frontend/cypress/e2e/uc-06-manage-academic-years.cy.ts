/// <reference types="cypress" />
// UC-06: Manage academic years
//
// Rewritten 2026-08-06 for the 2026-08-05 backend redesign: `academic_years` is a real,
// Postgres-persisted, per-teacher table again (`GET/PATCH/DELETE /api/academic-years`,
// `POST /api/academic-years/selection`) — no relation to any local-state stub. Cycles/
// módulos come from the shared, global `catalog_cycles`/`catalog_modules` tables (UC-04/
// UC-05), seeded here via `cy.request` for isolation from other specs.

import { signInAsE2eUser, uniqueStartYear } from './support/sign-in';

interface CatalogCycle {
  id: string;
}
interface CatalogModule {
  id: string;
}
interface AcademicYear {
  id: string;
  startYear: number;
  isCurrent: boolean;
}

function seedCatalogCycleWithModule(cycleName: string, moduleName: string): Cypress.Chainable<{ cycleId: string; moduleId: string }> {
  return cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body }) => {
    const cycleId = (body as CatalogCycle).id;
    return cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(({ body: moduleBody }) => ({
      cycleId,
      moduleId: (moduleBody as CatalogModule).id,
    }));
  });
}

describe('UC-06: Manage academic years', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('creates a year with a módulo selection via the UI, displays it, reloads on selection, and marking it current un-marks the previous one', () => {
    const cycleName = `E2E AY Cycle ${Date.now()}`;
    const moduleName = `E2E AY Module ${Date.now()}`;
    const newStartYear = uniqueStartYear();

    seedCatalogCycleWithModule(cycleName, moduleName).then(({ cycleId, moduleId }) => {
      cy.request('POST', '/api/academic-years/selection', { startYear: uniqueStartYear(), moduleIds: [] }).then(({ body }) => {
        const previousYear = (body as { academicYear: AcademicYear }).academicYear;
        cy.request('PATCH', `/api/academic-years/${previousYear.id}`, { isCurrent: true }).then(() => {
          cy.visit('/configuracion/ano-academico');

          cy.get('[data-element-id="academic-year-table-add-button"]').click();
          cy.get('[data-element-id="academic-year-table-row-new-name"]').type(String(newStartYear));
          cy.get(`[data-element-id="training-cycle-table-row-${cycleId}-checkbox"]`).click();
          cy.get(`[data-element-id="module-selection-table-row-${moduleId}-checkbox"]`).should('not.be.checked').click();

          cy.intercept('POST', '/api/academic-years/selection').as('createSelection');
          cy.get('[data-element-id="module-selection-save-button"]').click();
          cy.wait('@createSelection').its('response.statusCode').should('eq', 201);

          cy.get('[data-element-id="module-selection-save-message"]').should('contain.text', 'Año académico y selección de módulos guardados');
          cy.get('[data-element-id="module-selection-table"]').should('not.exist');

          cy.contains('[data-element-id^="academic-year-table-row-"]', `${newStartYear}-${newStartYear + 1}`)
            .invoke('attr', 'data-element-id')
            .then((elementId) => {
              const newYearId = (elementId as string).slice('academic-year-table-row-'.length);

              // Selecting the newly-created year (auto-selected on save) reloaded training-cycle-table.
              cy.get(`[data-element-id="academic-year-table-row-${newYearId}"]`).should('have.class', 'bg-slate-100');
              cy.contains('[data-element-id="training-cycle-table"]', cycleName).should('exist');

              cy.intercept('PATCH', `/api/academic-years/${newYearId}`).as('setCurrent');
              cy.get(`[data-element-id="academic-year-table-row-${newYearId}-set-current"]`).click();
              cy.wait('@setCurrent').its('response.statusCode').should('eq', 200);
              cy.contains(`[data-element-id="academic-year-table-row-${newYearId}"]`, 'En curso').should('exist');
              cy.contains(`[data-element-id="academic-year-table-row-${previousYear.id}"]`, 'En curso').should('not.exist');

              // A2 — blocked while a módulo is still assigned.
              cy.get(`[data-element-id="academic-year-table-row-${newYearId}-delete"]`).click();
              cy.get('[data-element-id="academic-year-toast"]').should('contain.text', 'módulos');
              cy.get(`[data-element-id="academic-year-table-row-${newYearId}"]`).should('exist');

              // Cleanup: remove the módulo assignment, then delete both years and the cycle.
              cy.request('GET', `/api/academic-years/${newYearId}/modules`).then(({ body: modulesBody }) => {
                const assignmentId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;
                cy.request('DELETE', `/api/academic-year-modules/${assignmentId}`);
                cy.request('DELETE', `/api/academic-years/${newYearId}`);
                cy.request('DELETE', `/api/academic-years/${previousYear.id}`);
                cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
              });
            });
        });
      });
    });
  });

  it('A1: rejects a duplicate start year inline, keeping the row editable, and A3: deletes a year with no módulos assigned', () => {
    const startYearC = uniqueStartYear();
    const startYearD = uniqueStartYear();

    cy.request('POST', '/api/academic-years/selection', { startYear: startYearC, moduleIds: [] }).then(({ body: bodyC }) => {
      const yearC = (bodyC as { academicYear: AcademicYear }).academicYear;
      cy.request('POST', '/api/academic-years/selection', { startYear: startYearD, moduleIds: [] }).then(({ body: bodyD }) => {
        const yearD = (bodyD as { academicYear: AcademicYear }).academicYear;
        cy.visit('/configuracion/ano-academico');

        cy.get(`[data-element-id="academic-year-table-row-${yearC.id}-edit"]`).click();
        cy.get(`[data-element-id="academic-year-table-row-${yearC.id}-name"]`).clear().type(String(startYearD));

        cy.intercept('PATCH', `/api/academic-years/${yearC.id}`).as('rename');
        cy.get(`[data-element-id="academic-year-table-row-${yearC.id}-save"]`).click();
        cy.wait('@rename').its('response.statusCode').should('eq', 409);

        cy.get('[data-element-id="academic-year-toast"]').should('be.visible');
        cy.get(`[data-element-id="academic-year-table-row-${yearC.id}-name"]`).should('have.value', String(startYearD));

        // A3 — no módulos assigned, deletion succeeds outright.
        cy.intercept('DELETE', `/api/academic-years/${yearD.id}`).as('deleteD');
        cy.get(`[data-element-id="academic-year-table-row-${yearD.id}-delete"]`).click();
        cy.wait('@deleteD').its('response.statusCode').should('eq', 204);
        cy.get(`[data-element-id="academic-year-table-row-${yearD.id}"]`).should('not.exist');

        cy.request('DELETE', `/api/academic-years/${yearC.id}`);
      });
    });
  });
});
