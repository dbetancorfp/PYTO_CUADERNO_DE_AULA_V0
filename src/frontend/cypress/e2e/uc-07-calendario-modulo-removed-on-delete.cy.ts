/// <reference types="cypress" />
// UC-07: calendario_modulo is removed when a módulo is unassigned (Año académico)
// (views/calendario/use-cases.md). The DB's ON DELETE CASCADE (calendario_modulo ->
// academic_year_modules) must actually remove the snapshot when DELETE
// /api/academic-year-modules/:id runs — verified via the real HTTP API end to end.

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

describe('UC-07: calendario_modulo removed when a módulo is unassigned', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('deleting a módulo assignment removes its calendario_modulo snapshot (GET 404s afterward)', () => {
    const startYear = currentSchoolYearStartYear() - 1; // within the backward window once created
    const cycleName = `E2E UC07 Cycle ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;

      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: 'Módulo borrable', course: 1 }).then(
        ({ body: moduleBody }) => {
          const moduleId = (moduleBody as CatalogModule).id;

          cy.request('POST', '/api/academic-years/selection', { startYear, moduleIds: [moduleId] }).then(({ body }) => {
            const academicYearId = (body as { academicYear: { id: string } }).academicYear.id;

            cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
              const academicYearModuleId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;

              cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`).then(({ body: before }) => {
                // course 1: 33 course-applicable key_dates rows (2026-08-10 course filter,
                // UC-06/A1), +1 from the "Inicio curso"/"Fin de curso" split (2026-08-10,
                // UC-06/A2) = 34, + 6 final_exams (3 applicable evaluaciones, see UC-08) = 40.
                expect((before as { entries: unknown[] }).entries.length).to.eq(40);

                cy.request('DELETE', `/api/academic-year-modules/${academicYearModuleId}`).its('status').should('eq', 204);

                cy.request({
                  method: 'GET',
                  url: `/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`,
                  failOnStatusCode: false,
                }).its('status').should('eq', 404);

                cy.request('DELETE', `/api/academic-years/${academicYearId}`);
                cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
              });
            });
          });
        },
      );
    });
  });
});
