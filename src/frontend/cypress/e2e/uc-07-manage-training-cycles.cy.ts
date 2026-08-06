/// <reference types="cypress" />
// UC-07: Pick training cycles for an academic year
//
// Rewritten 2026-08-06 for the 2026-08-05 backend redesign. Cycles come exclusively from
// the shared, global `catalog_cycles` table (UC-04) — this UC is only about which of them a
// teacher picks for a given year. Closes two gaps `reviewer` flagged as real but untested at
// the unit level (see views/configuracion/review-report.md "Criteria without verifiable
// coverage"): extend-mode pre-checking/disabling already-assigned módulos, and unchecking a
// cycle discarding its checked módulos — both need a real DOM + real backend to prove.

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

describe('UC-07: Pick training cycles for an academic year', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('normal mode filters to assigned cycles only; extending pre-checks and disables already-assigned módulos', () => {
    const cycleAName = `E2E UC07 Cycle A ${Date.now()}`;
    const cycleBName = `E2E UC07 Cycle B ${Date.now()}`;
    const moduleA1Name = `E2E UC07 Module A1 ${Date.now()}`;
    const moduleA2Name = `E2E UC07 Module A2 ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleAName }).then(({ body: cycleABody }) => {
      const cycleAId = (cycleABody as CatalogCycle).id;
      cy.request('POST', `/api/catalog/training-cycles/${cycleAId}/modules`, { name: moduleA1Name, course: 1 }).then(({ body: moduleA1Body }) => {
        const moduleA1Id = (moduleA1Body as CatalogModule).id;
        cy.request('POST', `/api/catalog/training-cycles/${cycleAId}/modules`, { name: moduleA2Name, course: 2 }).then(({ body: moduleA2Body }) => {
          const moduleA2Id = (moduleA2Body as CatalogModule).id;
          cy.request('POST', '/api/catalog/training-cycles', { name: cycleBName }).then(({ body: cycleBBody }) => {
            const cycleBId = (cycleBBody as CatalogCycle).id;

            // Year starts with only módulo A1 (course 1) assigned — módulo A2 and cycle B are not.
            cy.request('POST', '/api/academic-years/selection', { startYear: uniqueStartYear(), moduleIds: [moduleA1Id] }).then(({ body }) => {
              const year = (body as { academicYear: AcademicYear }).academicYear;
              cy.visit('/configuracion/ano-academico');

              cy.get(`[data-element-id="academic-year-table-row-${year.id}"]`).click('left');

              // UC-07 criterion: normal mode shows only cycles with >=1 assigned módulo.
              cy.get(`[data-element-id="training-cycle-table-row-${cycleAId}"]`).should('exist');
              cy.get(`[data-element-id="training-cycle-table-row-${cycleBId}"]`).should('not.exist');

              // Enter extend mode via UC-06 A6.
              cy.get('[data-element-id="training-cycle-table-add-cycle-button"]').click();
              cy.get(`[data-element-id="training-cycle-table-row-${cycleAId}-checkbox"]`).should('exist');
              cy.get(`[data-element-id="training-cycle-table-row-${cycleBId}-checkbox"]`).should('exist');

              cy.get(`[data-element-id="training-cycle-table-row-${cycleAId}-checkbox"]`).click();

              // Already-assigned módulo A1 loads pre-checked and disabled; A2 loads unchecked and enabled.
              cy.get(`[data-element-id="module-selection-table-row-${moduleA1Id}-checkbox"]`)
                .should('be.checked')
                .and('be.disabled');
              cy.get(`[data-element-id="module-selection-table-row-${moduleA2Id}-checkbox"]`)
                .should('not.be.checked')
                .and('not.be.disabled');

              // Cleanup: no save happened, so only the year's original assignment + the year itself remain.
              cy.request('GET', `/api/academic-years/${year.id}/modules`).then(({ body: modulesBody }) => {
                const assignmentId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;
                cy.request('DELETE', `/api/academic-year-modules/${assignmentId}`);
                cy.request('DELETE', `/api/academic-years/${year.id}`);
                cy.request('DELETE', `/api/catalog/training-cycles/${cycleAId}`);
                cy.request('DELETE', `/api/catalog/training-cycles/${cycleBId}`);
              });
            });
          });
        });
      });
    });
  });

  it('A1: unchecking a cycle in adding mode discards its checked módulos, and extending saves and returns to normal mode with the year selected', () => {
    const cycleAName = `E2E UC07alt Cycle A ${Date.now()}`;
    const cycleBName = `E2E UC07alt Cycle B ${Date.now()}`;
    const moduleAName = `E2E UC07alt Module A ${Date.now()}`;
    const moduleBName = `E2E UC07alt Module B ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleAName }).then(({ body: cycleABody }) => {
      const cycleAId = (cycleABody as CatalogCycle).id;
      cy.request('POST', `/api/catalog/training-cycles/${cycleAId}/modules`, { name: moduleAName, course: 1 }).then(({ body: moduleABody }) => {
        const moduleAId = (moduleABody as CatalogModule).id;
        cy.request('POST', '/api/catalog/training-cycles', { name: cycleBName }).then(({ body: cycleBBody }) => {
          const cycleBId = (cycleBBody as CatalogCycle).id;
          cy.request('POST', `/api/catalog/training-cycles/${cycleBId}/modules`, { name: moduleBName, course: 1 }).then(({ body: moduleBBody }) => {
            const moduleBId = (moduleBBody as CatalogModule).id;

            cy.request('POST', '/api/academic-years/selection', { startYear: uniqueStartYear(), moduleIds: [] }).then(({ body }) => {
              const year = (body as { academicYear: AcademicYear }).academicYear;
              cy.visit('/configuracion/ano-academico');

              cy.get(`[data-element-id="academic-year-table-row-${year.id}"]`).click('left');
              cy.get('[data-element-id="training-cycle-table-add-cycle-button"]').click();

              cy.get(`[data-element-id="training-cycle-table-row-${cycleAId}-checkbox"]`).click();
              cy.get(`[data-element-id="training-cycle-table-row-${cycleBId}-checkbox"]`).click();
              cy.get(`[data-element-id="module-selection-table-row-${moduleBId}-checkbox"]`).click();

              // A1 — unchecking cycle B discards its checked módulo from the in-progress selection.
              cy.get(`[data-element-id="training-cycle-table-row-${cycleBId}-checkbox"]`).click();
              cy.get(`[data-element-id="module-selection-table-row-${moduleBId}-checkbox"]`).should('not.exist');

              cy.get(`[data-element-id="module-selection-table-row-${moduleAId}-checkbox"]`).click();

              cy.intercept('POST', `/api/academic-years/${year.id}/modules`).as('extend');
              cy.get('[data-element-id="module-selection-save-button"]').click();
              cy.wait('@extend').then(({ response }) => {
                expect(response?.statusCode).to.eq(200);
                expect((response?.body as { addedCount: number }).addedCount).to.eq(1);
              });

              cy.get('[data-element-id="module-selection-save-message"]').should('contain.text', 'Selección de módulos guardada');
              cy.get('[data-element-id="module-selection-table"]').should('not.exist');
              cy.get(`[data-element-id="academic-year-table-row-${year.id}"]`).should('have.class', 'bg-slate-100');
              cy.contains('[data-element-id="training-cycle-table"]', cycleAName).should('exist');
              cy.contains('[data-element-id="training-cycle-table"]', cycleBName).should('not.exist');

              cy.request('GET', `/api/academic-years/${year.id}/modules`).then(({ body: modulesBody }) => {
                const assignmentId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;
                cy.request('DELETE', `/api/academic-year-modules/${assignmentId}`);
                cy.request('DELETE', `/api/academic-years/${year.id}`);
                cy.request('DELETE', `/api/catalog/training-cycles/${cycleAId}`);
                cy.request('DELETE', `/api/catalog/training-cycles/${cycleBId}`);
              });
            });
          });
        });
      });
    });
  });
});
