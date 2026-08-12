/// <reference types="cypress" />
// UC-12: calendario_horario is generated when a módulo's weekly schedule is saved (Horario)
// UC-13: See a módulo's horario overlaid on its calendar
// (views/calendario/use-cases.md). Exercises the real cross-view side effect end to end:
// saving a weekly schedule through Configuración → Horario's real UI (schedule-save-button,
// already unit/e2e-tested on its own screen by uc-10-11-browse-and-edit-horario.cy.ts)
// really populates calendario_horario, and /calendario really renders the ring/legend/
// tooltip from it — not a stub, same pattern uc-03-04-select-modulo-and-view-calendar.cy.ts
// already proves for calendario_modulo's own UC-06 side effect.
//
// Same `:hover` limitation as uc-05-hover-day-shows-toast.cy.ts: Cypress's
// `.trigger('mouseover')` never activates a real CSS `:hover`, so the tooltip's content is
// asserted directly against the real DOM node (always present, hidden by default), not
// through a simulated reveal.

import { signInAsE2eUser } from './support/sign-in';

function currentSchoolYearStartYear(): number {
  const today = new Date();
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
}

/** First Monday on/after this course-1 módulo's real "Inicio curso" date (16 September,
 * per the real key_dates seed — see calendario-horario.service.ts's `teachingPeriod`,
 * 2026-08-12 bugfix: the walk range is [Inicio curso, Fin de curso], never a fixed 1
 * September window). Computed here client-side so the spec stays correct whenever it
 * actually runs. */
function firstMondayOfSchoolYear(startYear: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(startYear, 8, 16)); // 16 September, UTC — Inicio curso
  while (date.getUTCDay() !== 1) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

interface CatalogCycle {
  id: string;
}
interface CatalogModule {
  id: string;
}
interface AcademicYearModule {
  id: string;
}
interface AcademicYearRow {
  id: string;
  startYear: number;
}

const TARGET_OFFSET = 4; // distinct from uc-10-11's (1/5), uc-03-04's (2), uc-05's (3).

function cleanupExistingYear(startYear: number): Cypress.Chainable<unknown> {
  return cy.request('GET', '/api/academic-years').then(({ body }) => {
    const existing = (body as { academicYears: AcademicYearRow[] }).academicYears.find((year) => year.startYear === startYear);
    if (!existing) return cy.wrap(null);

    return cy.request('GET', `/api/academic-years/${existing.id}/modules`).then(({ body: modulesBody }) => {
      const modules = (modulesBody as { modules: AcademicYearModule[] }).modules;
      const deletions = modules.map((module) => cy.request('DELETE', `/api/academic-year-modules/${module.id}`));
      return Cypress.Promise.all(deletions).then(() => cy.request('DELETE', `/api/academic-years/${existing.id}`));
    });
  });
}

describe('UC-12/UC-13: Saving Horario overlays a módulo\'s calendar with a ring, legend item and tooltip line', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('clicking schedule-save-button in Configuración → Horario populates calendario_horario, rendered on /calendario', () => {
    const targetStartYear = currentSchoolYearStartYear() + TARGET_OFFSET;
    const cycleName = `E2E Horario Overlay Cycle ${Date.now()}`;
    const moduleName = `E2E Horario Overlay Module ${Date.now()}`;
    const monday = firstMondayOfSchoolYear(targetStartYear);
    const mondayMonthId = `calendario-month-${monday.year}-${pad2(monday.month)}`;
    const mondayDayId = `${mondayMonthId}-day-${pad2(monday.day)}`;

    cleanupExistingYear(targetStartYear).then(() => {
      cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
        const cycleId = (cycleBody as CatalogCycle).id;

        cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(
          ({ body: moduleBody }) => {
            const moduleId = (moduleBody as CatalogModule).id;

            cy.request('POST', '/api/academic-years/selection', { startYear: targetStartYear, moduleIds: [moduleId] }).then(
              ({ body: selectionBody }) => {
                const academicYearId = (selectionBody as { academicYear: { id: string } }).academicYear.id;

                // UC-12 main flow: real UI, real save button — not a bare API PUT.
                cy.visit('/configuracion/horario');
                for (let i = 0; i < TARGET_OFFSET; i += 1) {
                  cy.get('[data-element-id="schedule-academic-year-filter-next"]').click();
                }
                cy.get('[data-element-id="schedule-module-filter"]').should('contain.text', moduleName);
                cy.get('[data-element-id="schedule-monday-select"]').select('2');
                cy.get('[data-element-id="schedule-save-button"]').click();
                cy.get('[data-element-id="schedule-save-message"]').should('be.visible').and('not.be.empty');

                // Real side-effect proof: calendario_horario was regenerated server-side —
                // GET it back directly before even touching /calendario.
                cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
                  const academicYearModuleId = (modulesBody as { modules: AcademicYearModule[] }).modules[0]!.id;
                  cy.request('GET', `/api/calendario-horario?academicYearModuleId=${academicYearModuleId}`).then(
                    ({ body: horarioBody }) => {
                      const entries = (horarioBody as { entries: { date: string; hours: number }[] }).entries;
                      expect(entries.some((entry) => entry.hours === 2)).to.be.true;
                    },
                  );
                });

                // UC-13 main flow: /calendario renders the ring/legend/tooltip from it.
                cy.visit('/calendario');
                for (let i = 0; i < TARGET_OFFSET; i += 1) {
                  cy.get('[data-element-id="academic-year-filter-next"]').click();
                }
                cy.get('[data-element-id="module-filter"]').should('contain.text', moduleName);

                cy.get(`[data-element-id="${mondayDayId}"]`)
                  .should('have.attr', 'data-calendario-horario', 'true')
                  .and('have.attr', 'style')
                  .and('include', '#06b6d4');

                cy.get('[data-element-id="calendario-legend-item-horario"]').should('exist').and('contain.text', 'Horario');

                cy.get(`[data-element-id="${mondayDayId}-tooltip"]`).should('exist').and('contain.text', 'Horario: 2 horas');

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
