/// <reference types="cypress" />
// UC-06: calendario_modulo is generated when módulos are saved (Año académico)
// (views/calendario/use-cases.md). Cross-view side effect — Año académico's existing
// "Guardar selección" flow (both creating a new academic year and extending an existing
// one) must snapshot the real, Postgres-seeded key_dates into calendario_modulo. Verified
// via the real HTTP API end to end, not a stub.

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
interface CalendarioModuloEntry {
  id: string;
  category: string;
}

describe('UC-06: calendario_modulo generated when módulos are saved', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('creating an academic year with a módulo generates its full key_dates snapshot', () => {
    const startYear = currentSchoolYearStartYear() + 4;
    const cycleName = `E2E UC06 Create Cycle ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;

      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: 'Módulo A', course: 1 }).then(
        ({ body: moduleBody }) => {
          const moduleId = (moduleBody as CatalogModule).id;

          cy.request('POST', '/api/academic-years/selection', { startYear, moduleIds: [moduleId] }).then(({ body }) => {
            const academicYearId = (body as { academicYear: { id: string } }).academicYear.id;

            cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
              const academicYearModuleId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;

              cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`).then(({ body: calBody }) => {
                const entries = (calBody as { entries: CalendarioModuloEntry[] }).entries;
                // 43 rows from the six key_dates categories + 8 computed final_exams rows
                // (2 per "Último día para poner notas" entry — 4 currently seeded: 1ª, 2ª(2º),
                // 2ª(1º), 3ª(1º) — see views/calendario/use-cases.md UC-08).
                expect(entries.length).to.eq(51);
                expect(entries.filter((e) => e.category === 'final_exams')).to.have.length(8);

                cy.request('DELETE', `/api/academic-year-modules/${academicYearModuleId}`);
                cy.request('DELETE', `/api/academic-years/${academicYearId}`);
                cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
              });
            });
          });
        },
      );
    });
  });

  it('extending an existing academic year with a second módulo generates its snapshot too, without duplicating the first', () => {
    const startYear = currentSchoolYearStartYear() + 5;
    const cycleName = `E2E UC06 Extend Cycle ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;

      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: 'Módulo B', course: 1 }).then(({ body: mod1 }) => {
        const module1Id = (mod1 as CatalogModule).id;

        cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: 'Módulo C', course: 1 }).then(({ body: mod2 }) => {
          const module2Id = (mod2 as CatalogModule).id;

          cy.request('POST', '/api/academic-years/selection', { startYear, moduleIds: [module1Id] }).then(({ body }) => {
            const academicYearId = (body as { academicYear: { id: string } }).academicYear.id;

            cy.request('POST', `/api/academic-years/${academicYearId}/modules`, { moduleIds: [module2Id] }).then(() => {
              cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
                const modules = (modulesBody as { modules: { id: string; catalogModuleId: string }[] }).modules;
                const firstAym = modules.find((module) => module.catalogModuleId === module1Id)!.id;
                const secondAym = modules.find((module) => module.catalogModuleId === module2Id)!.id;

                cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${firstAym}`).then(({ body: cal1 }) => {
                  // 43 + 8 final_exams, same derivation as the create-mode test above.
                  expect((cal1 as { entries: CalendarioModuloEntry[] }).entries.length).to.eq(51);
                });
                cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${secondAym}`).then(({ body: cal2 }) => {
                  expect((cal2 as { entries: CalendarioModuloEntry[] }).entries.length).to.eq(51);

                  cy.request('DELETE', `/api/academic-year-modules/${firstAym}`);
                  cy.request('DELETE', `/api/academic-year-modules/${secondAym}`);
                  cy.request('DELETE', `/api/academic-years/${academicYearId}`);
                  cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
                });
              });
            });
          });
        });
      });
    });
  });
});
