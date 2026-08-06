/// <reference types="cypress" />
// UC-08: Manage a teacher's assigned módulos within a cycle
//
// Rewritten 2026-08-06 for the 2026-08-05 backend redesign — `module-table` only un-assigns
// an `academic_year_modules` row now (Quitar), never touches the underlying `catalog_modules`
// row. Closes two gaps `reviewer` flagged as real but untested at the unit level: módulos
// grouped by curso, and a cycle disappearing from `training-cycle-table` once its last
// módulo is removed — both need a real DOM to prove.

import { signInAsE2eUser, uniqueStartYear } from './support/sign-in';

interface CatalogCycle {
  id: string;
}
interface CatalogModule {
  id: string;
}
interface AcademicYear {
  id: string;
}

describe("UC-08: Manage a teacher's assigned módulos within a cycle", () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('shows assigned módulos grouped by curso; Quitar removes one immediately, and removing the last one drops the cycle from training-cycle-table', () => {
    const cycleName = `E2E UC08 Cycle ${Date.now()}`;
    const module1Name = `E2E UC08 Module Curso1 ${Date.now()}`;
    const module2Name = `E2E UC08 Module Curso2 ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;
      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: module1Name, course: 1 }).then(({ body: module1Body }) => {
        const module1Id = (module1Body as CatalogModule).id;
        cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: module2Name, course: 2 }).then(({ body: module2Body }) => {
          const module2Id = (module2Body as CatalogModule).id;

          cy.request('POST', '/api/academic-years/selection', { startYear: uniqueStartYear(), moduleIds: [module1Id, module2Id] }).then(({ body }) => {
            const year = (body as { academicYear: AcademicYear }).academicYear;
            cy.visit('/configuracion/ano-academico');

            cy.get(`[data-element-id="academic-year-table-row-${year.id}"]`).click('left');
            cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).click();

            // Grouped by curso: both course headers present, in course order.
            cy.get('[data-element-id="module-table"]').should('contain.text', '1º').and('contain.text', '2º');
            cy.get('[data-element-id="module-table"] tbody tr td:contains("º")').first().should('contain.text', '1º');

            cy.request('GET', `/api/academic-years/${year.id}/modules`).then(({ body: modulesBody }) => {
              const modules = (modulesBody as { modules: { id: string; catalogModuleId: string }[] }).modules;
              const assignment1Id = modules.find((m) => m.catalogModuleId === module1Id)!.id;
              const assignment2Id = modules.find((m) => m.catalogModuleId === module2Id)!.id;

              cy.intercept('DELETE', `/api/academic-year-modules/${assignment1Id}`).as('removeModule1');
              cy.get(`[data-element-id="module-table-row-${assignment1Id}-delete"]`).click();
              cy.wait('@removeModule1').its('response.statusCode').should('eq', 204);
              cy.get(`[data-element-id="module-table-row-${assignment1Id}"]`).should('not.exist');
              cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).should('exist');

              cy.intercept('DELETE', `/api/academic-year-modules/${assignment2Id}`).as('removeModule2');
              cy.get(`[data-element-id="module-table-row-${assignment2Id}-delete"]`).click();
              cy.wait('@removeModule2').its('response.statusCode').should('eq', 204);
              cy.get(`[data-element-id="module-table-row-${assignment2Id}"]`).should('not.exist');
              cy.get(`[data-element-id="training-cycle-table-row-${cycleId}"]`).should('not.exist');

              cy.request('DELETE', `/api/academic-years/${year.id}`);
              cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
            });
          });
        });
      });
    });
  });

  it('A1: is hidden while adding mode is active, replaced by module-selection-table', () => {
    cy.visit('/configuracion/ano-academico');

    cy.get('[data-element-id="academic-year-table-add-button"]').click();

    cy.get('[data-element-id="module-table"]').should('not.exist');
    cy.get('[data-element-id="module-selection-table"]').should('exist');
  });
});
