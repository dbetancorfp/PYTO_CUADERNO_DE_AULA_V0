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
  name: string;
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
                // course 1: 33 course-applicable key_dates rows (2026-08-10 course filter,
                // UC-06/A1), +1 from the "Inicio curso"/"Fin de curso" split (2026-08-10,
                // UC-06/A2) = 34, + 6 computed final_exams rows (2 per "Último día para
                // poner notas" entry — 3 applicable to course 1: 1ª, 2ª(1º), 3ª(1º); 2ª(2º)
                // is excluded, it belongs to course 2 — see UC-08) = 40.
                expect(entries.length).to.eq(40);
                expect(entries.filter((e) => e.category === 'final_exams')).to.have.length(6);

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
                  // course 1: 40 rows, same derivation as the create-mode test above.
                  expect((cal1 as { entries: CalendarioModuloEntry[] }).entries.length).to.eq(40);
                });
                cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${secondAym}`).then(({ body: cal2 }) => {
                  expect((cal2 as { entries: CalendarioModuloEntry[] }).entries.length).to.eq(40);

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

  it('a course-1 and a course-2 módulo saved together never leak each other´s course-specific key_dates entries (2026-08-10 bugfix, UC-06/A1)', () => {
    const startYear = currentSchoolYearStartYear() + 2;
    const cycleName = `E2E UC06 Course-Filter Cycle ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;

      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: 'Módulo Curso 1', course: 1 }).then(({ body: mod1 }) => {
        const module1Id = (mod1 as CatalogModule).id;

        cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: 'Módulo Curso 2', course: 2 }).then(({ body: mod2 }) => {
          const module2Id = (mod2 as CatalogModule).id;

          cy.request('POST', '/api/academic-years/selection', { startYear, moduleIds: [module1Id, module2Id] }).then(({ body }) => {
            const academicYearId = (body as { academicYear: { id: string } }).academicYear.id;

            cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
              const modules = (modulesBody as { modules: { id: string; catalogModuleId: string }[] }).modules;
              const course1Aym = modules.find((module) => module.catalogModuleId === module1Id)!.id;
              const course2Aym = modules.find((module) => module.catalogModuleId === module2Id)!.id;

              cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${course1Aym}`).then(({ body: cal1 }) => {
                const entries1 = (cal1 as { entries: CalendarioModuloEntry[] }).entries;
                const names1 = entries1.map((e) => e.name);
                expect(entries1.length, 'course-1 módulo total rows').to.eq(40);
                expect(names1, 'course-1 snapshot never contains a course-2-only entry').to.not.include('Inicio curso: 2º de Grado Superior de FP.');
                expect(names1, 'course-1 snapshot never contains a course-2 Fin de curso entry').to.not.include('Fin de curso: 2º de Grado Superior de FP.');
                expect(names1.some((n) => n.includes('(2º)')), 'course-1 snapshot never contains a (2º)-tagged entry').to.eq(false);
                expect(names1, 'course-1 snapshot keeps its own course-start entry').to.include('Inicio curso: 1º de Grado Superior de FP.');
                expect(names1, 'course-1 snapshot keeps its own split Fin de curso entry (UC-06/A2)').to.include('Fin de curso: 1º de Grado Superior de FP.');
              });

              cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${course2Aym}`).then(({ body: cal2 }) => {
                const entries2 = (cal2 as { entries: CalendarioModuloEntry[] }).entries;
                const names2 = entries2.map((e) => e.name);
                expect(entries2.length, 'course-2 módulo total rows').to.eq(36);
                expect(names2, 'course-2 snapshot never contains a course-1-only entry').to.not.include('Inicio curso: 1º de Grado Superior de FP.');
                expect(names2, 'course-2 snapshot never contains a course-1 Fin de curso entry').to.not.include('Fin de curso: 1º de Grado Superior de FP.');
                expect(names2.some((n) => n.includes('(1º)')), 'course-2 snapshot never contains a (1º)-tagged entry').to.eq(false);
                expect(names2, 'course-2 snapshot keeps its own course-start entry').to.include('Inicio curso: 2º de Grado Superior de FP.');
                expect(names2, 'course-2 snapshot keeps its own split Fin de curso entry (UC-06/A2)').to.include('Fin de curso: 2º de Grado Superior de FP.');

                cy.request('DELETE', `/api/academic-year-modules/${course1Aym}`);
                cy.request('DELETE', `/api/academic-year-modules/${course2Aym}`);
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
