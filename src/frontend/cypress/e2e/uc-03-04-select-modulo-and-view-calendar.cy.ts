/// <reference types="cypress" />
// UC-03: Select a ciclo / UC-04: Select a módulo and view its calendar
// (views/calendario/use-cases.md). Exercises the real cross-view side effect end to end:
// assigning a módulo via Año académico's existing POST /api/academic-years/selection (see
// UC-06) really populates calendario_modulo from the live, Postgres-seeded key_dates (43
// rows + 8 computed final_exams rows, see UC-08), and this screen renders it — not a stub.

import { signInAsE2eUser } from './support/sign-in';

function currentSchoolYearStartYear(): number {
  const today = new Date();
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
}

interface CatalogCycle {
  id: string;
}
interface CatalogModule {
  id: string;
}
interface AcademicYearModule {
  id: string;
  catalogModuleId: string;
}

const TARGET_OFFSET = 2; // currentSchoolYearStartYear + 2 — within the +5 carousel window.

function cleanupExistingYear(startYear: number): Cypress.Chainable<unknown> {
  return cy.request('GET', '/api/academic-years').then(({ body }) => {
    const existing = (body as { academicYears: { id: string; startYear: number }[] }).academicYears.find(
      (year) => year.startYear === startYear,
    );
    if (!existing) return cy.wrap(null);

    return cy.request('GET', `/api/academic-years/${existing.id}/modules`).then(({ body: modulesBody }) => {
      const modules = (modulesBody as { modules: AcademicYearModule[] }).modules;
      const deletions = modules.map((module) => cy.request('DELETE', `/api/academic-year-modules/${module.id}`));
      return Cypress.Promise.all(deletions).then(() => cy.request('DELETE', `/api/academic-years/${existing.id}`));
    });
  });
}

describe('UC-03/UC-04: Select a ciclo/módulo and view its calendar', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('renders the assigned módulo´s real calendario_modulo snapshot, with long-range boundary-only coloring', () => {
    const targetStartYear = currentSchoolYearStartYear() + TARGET_OFFSET;
    const cycleName = `E2E Calendario Cycle ${Date.now()}`;
    const moduleName = `E2E Calendario Module ${Date.now()}`;

    cleanupExistingYear(targetStartYear).then(() => {
      cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
        const cycleId = (cycleBody as CatalogCycle).id;

        cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(
          ({ body: moduleBody }) => {
            const moduleId = (moduleBody as CatalogModule).id;

            cy.request('POST', '/api/academic-years/selection', { startYear: targetStartYear, moduleIds: [moduleId] }).then(
              ({ body: selectionBody }) => {
                const academicYearId = (selectionBody as { academicYear: { id: string } }).academicYear.id;

                cy.visit('/calendario');
                for (let i = 0; i < TARGET_OFFSET; i += 1) {
                  cy.get('[data-element-id="academic-year-filter-next"]').click();
                }
                cy.get('[data-element-id="academic-year-filter-value"]').should(
                  'contain.text',
                  `${targetStartYear}-${targetStartYear + 1}`,
                );

                cy.get('[data-element-id="cycle-filter"]').should('contain.text', cycleName);
                cy.get('[data-element-id="module-filter"]').should('contain.text', moduleName);

                cy.get('[data-element-id="calendario-months"]').should('exist');
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-09"]`).should('exist');
                cy.get(`[data-element-id="calendario-month-${targetStartYear + 1}-06"]`).should('exist');

                // A1 — short range (Vacaciones de Navidad, 22/12-07/01): every day colored,
                // including both boundaries. Real seeded key_dates data, not a fixture — real
                // (category,type) is (holidays, "Vacaciones") -> UC-11 row 3, #eda100.
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-12-day-25"]`)
                  .should('have.attr', 'data-calendario-day-categories')
                  .and('include', 'holidays');
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-12-day-25"]`).should(
                  'have.css',
                  'background-color',
                  'rgb(237, 161, 0)',
                );

                // A1 — long range (Curso escolar, 01/09-31/07, ~330 days): only its own
                // start/end day count, not a day in the middle.
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-09-day-01"]`)
                  .should('have.attr', 'data-calendario-day-categories')
                  .and('include', 'academic_key_dates');
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-11-day-15"]`).should(
                  'not.have.attr',
                  'data-calendario-day-categories',
                );

                // Cleanup.
                cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
                  const assignmentId = (modulesBody as { modules: AcademicYearModule[] }).modules[0]!.id;
                  cy.request('DELETE', `/api/academic-year-modules/${assignmentId}`);
                  cy.request('DELETE', `/api/academic-years/${academicYearId}`);
                  cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
                });
              },
            );
          },
        );
      });
    });
  });
});
