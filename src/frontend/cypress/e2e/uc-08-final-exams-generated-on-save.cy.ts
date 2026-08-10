/// <reference types="cypress" />
// UC-08: final_exams dates are computed when calendario_modulo is generated (Año académico)
// (views/calendario/use-cases.md). Cross-view side effect, same nature as UC-06 — Año
// académico's existing "Guardar selección" flow must also compute the "Examen final"/
// "Examen de recuperación final" pair for every "Último día para poner notas" entry,
// verified via the real HTTP API end to end (business-day math against real, Postgres-seeded
// key_dates), plus a real-browser style-application proof that final_exams days render
// their UC-11 color — "Examen final." rows #008300, "Examen de recuperación final." rows
// #59ae59 (2026-08-10, replaces the earlier uniform light-green scheme).

import { signInAsE2eUser } from './support/sign-in';

function currentSchoolYearStartYear(): number {
  const today = new Date();
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
}

function dayElementIdFor(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `calendario-month-${year}-${month}-day-${day}`;
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
  startDate: string;
  endDate: string;
}

const TARGET_OFFSET = 3; // currentSchoolYearStartYear + 3 — distinct from the other calendario specs, within the +5 carousel window.

describe('UC-08: final_exams dates computed when calendario_modulo is generated', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('generates one "Examen de recuperación final"/"Examen final" pair per "Último día para poner notas" entry, and renders them light green', () => {
    const startYear = currentSchoolYearStartYear() + TARGET_OFFSET;
    const cycleName = `E2E UC08 Cycle ${Date.now()}`;
    const moduleName = `E2E UC08 Module ${Date.now()}`;

    cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;

      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(
        ({ body: moduleBody }) => {
          const moduleId = (moduleBody as CatalogModule).id;

          cy.request('POST', '/api/academic-years/selection', { startYear, moduleIds: [moduleId] }).then(({ body }) => {
            const academicYearId = (body as { academicYear: { id: string } }).academicYear.id;

            cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
              const academicYearModuleId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;

              cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`).then(({ body: calBody }) => {
                const entries = (calBody as { entries: CalendarioModuloEntry[] }).entries;
                const finalExams = entries.filter((e) => e.category === 'final_exams');

                // 4 "Último día para poner notas" entries currently seeded (1ª, 2ª(2º),
                // 2ª(1º), 3ª(1º)) -> 2 rows each.
                expect(finalExams).to.have.length(8);
                expect(finalExams.filter((e) => e.name.endsWith('Examen de recuperación final.'))).to.have.length(4);
                expect(finalExams.filter((e) => e.name.endsWith('Examen final.'))).to.have.length(4);
                finalExams.forEach((entry) => expect(entry.startDate).to.eq(entry.endDate));

                const recuperacion1a = finalExams.find((e) => e.name === '1ª Evaluación - Examen de recuperación final.');
                const final1a = finalExams.find((e) => e.name === '1ª Evaluación - Examen final.');
                expect(recuperacion1a, 'recuperación final for 1ª Evaluación').to.exist;
                expect(final1a, '1ª Evaluación - Examen final.').to.exist;
                // The retake exam is always the later date of the pair (computed backward from
                // "Último día de notas", -2 business days — both exams conclude before the grade
                // deadline); the final exam is always earlier still (computed backward from the
                // retake date, a further -4 business days) — see UC-08.
                expect(new Date(final1a!.startDate).getTime()).to.be.lessThan(new Date(recuperacion1a!.startDate).getTime());

                cy.visit('/calendario');
                for (let i = 0; i < TARGET_OFFSET; i += 1) {
                  cy.get('[data-element-id="academic-year-filter-next"]').click();
                }
                cy.get('[data-element-id="academic-year-filter-value"]').should('contain.text', `${startYear}-${startYear + 1}`);
                cy.get('[data-element-id="cycle-filter"]').should('contain.text', cycleName);
                cy.get('[data-element-id="module-filter"]').should('contain.text', moduleName);

                // Style application proof (UC-11 rows 13/14): every final_exams day cell
                // carries the category in its data attribute and renders its real, per-name-
                // suffix color, not just in the resolution logic a unit test already covers.
                cy.get('[data-calendario-day-categories*="final_exams"]').should('have.length', 8);

                const examenFinalEntries = finalExams.filter((e) => e.name.endsWith('Examen final.'));
                const recuperacionEntries = finalExams.filter((e) => e.name.endsWith('Examen de recuperación final.'));
                examenFinalEntries.forEach((entry) => {
                  cy.get(`[data-element-id="${dayElementIdFor(entry.startDate)}"]`).should('have.css', 'background-color', 'rgb(0, 131, 0)');
                });
                recuperacionEntries.forEach((entry) => {
                  cy.get(`[data-element-id="${dayElementIdFor(entry.startDate)}"]`).should('have.css', 'background-color', 'rgb(89, 174, 89)');
                });

                // Cleanup.
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
});
