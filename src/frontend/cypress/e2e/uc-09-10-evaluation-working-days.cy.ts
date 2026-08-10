/// <reference types="cypress" />
// UC-09: calendario_evaluation_working_days is computed when calendario_modulo is
// generated / UC-10: See working-days-per-evaluación summary for the selected módulo
// (views/calendario/use-cases.md). Verifies the real end-to-end chain (real Postgres-seeded
// key_dates -> real business-day math -> real HTTP -> real render), plus the one acceptance
// criterion reviewer explicitly deferred here: evaluation-working-days-summary sits at the
// far right of the filters row without growing that row's height (real Tailwind layout,
// not observable in a unit test's happy-dom environment).

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
interface WorkingDaysEntry {
  evaluationNumber: number;
  workingDays: number;
}
interface AcademicYearModule {
  id: string;
  catalogModuleId: string;
}

const TARGET_OFFSET = 1; // currentSchoolYearStartYear + 1 — distinct from the other calendario specs.

// A real teacher's own manual use of the app (same shared dev Postgres, no separate test
// DB) can land on the same nearby school year this spec targets — defensive cleanup before
// creating, same guard uc-03-04's spec already uses, so a real pre-existing row never
// causes a false-negative 409 here.
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

describe('UC-09/UC-10: evaluation working-days computed and rendered', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('computes one working-days row per evaluación and renders it at the far right of the filters row, without growing that row', () => {
    const startYear = currentSchoolYearStartYear() + TARGET_OFFSET;
    const cycleName = `E2E UC09-10 Cycle ${Date.now()}`;
    const moduleName = `E2E UC09-10 Module ${Date.now()}`;

    cleanupExistingYear(startYear).then(() => cy.request('POST', '/api/catalog/training-cycles', { name: cycleName })).then(({ body: cycleBody }) => {
      const cycleId = (cycleBody as CatalogCycle).id;

      // course: 1 -> should get all three evaluationNumber rows (1, 2, 3).
      cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(
        ({ body: moduleBody }) => {
          const moduleId = (moduleBody as CatalogModule).id;

          cy.request('POST', '/api/academic-years/selection', { startYear, moduleIds: [moduleId] }).then(
            ({ body: selectionBody }) => {
              const academicYearId = (selectionBody as { academicYear: { id: string } }).academicYear.id;

              cy.request('GET', `/api/academic-years/${academicYearId}/modules`).then(({ body: modulesBody }) => {
                const academicYearModuleId = (modulesBody as { modules: { id: string }[] }).modules[0]!.id;

                // API-level precision check, same style as uc-08's own spec.
                cy.request(
                  'GET',
                  `/api/calendario-evaluation-working-days?academicYearModuleId=${academicYearModuleId}`,
                ).then(({ body: wdBody }) => {
                  const entries = (wdBody as { entries: WorkingDaysEntry[] }).entries;
                  expect(entries).to.have.length(3);
                  const numbers = entries.map((e) => e.evaluationNumber).sort();
                  expect(numbers).to.deep.eq([1, 2, 3]);
                  entries.forEach((entry) => expect(entry.workingDays).to.be.greaterThan(0));

                  cy.visit('/calendario');
                  for (let i = 0; i < TARGET_OFFSET; i += 1) {
                    cy.get('[data-element-id="academic-year-filter-next"]').click();
                  }
                  cy.get('[data-element-id="academic-year-filter-value"]').should(
                    'contain.text',
                    `${startYear}-${startYear + 1}`,
                  );
                  cy.get('[data-element-id="cycle-filter"]').should('contain.text', cycleName);
                  cy.get('[data-element-id="module-filter"]').should('contain.text', moduleName);

                  // UI-level content check: all three lines, exact wording.
                  cy.get('[data-element-id="evaluation-working-days-1"]').should('contain.text', 'Días laborables 1ª evaluación:');
                  cy.get('[data-element-id="evaluation-working-days-2"]').should('contain.text', 'Días laborables 2ª evaluación:');
                  cy.get('[data-element-id="evaluation-working-days-3"]').should('contain.text', 'Días laborables 3ª evaluación:');

                  // Style/layout proof (the criterion reviewer deferred to this pass, then
                  // refined after a real-browser regression report): the summary's own box
                  // sits at the far right of the filters section (its right edge hugs the
                  // section's own right edge), its text starts from the left inside that box
                  // (not right-aligned), and — since the summary is positioned `absolute`
                  // inside the section (see calendario-view.ts) — the section reserves a
                  // constant min-height so the three stacked lines never visually overflow
                  // past the card's own bottom edge.
                  cy.get('[data-element-id="module-filter"]')
                    .closest('section')
                    .then(($section) => {
                      const sectionRect = $section[0]!.getBoundingClientRect();
                      cy.get('[data-element-id="evaluation-working-days-summary"]').then(($summary) => {
                        const summaryRect = $summary[0]!.getBoundingClientRect();
                        expect(sectionRect.right - summaryRect.right, 'summary hugs the section´s right edge').to.be.within(0, 20);
                        expect(sectionRect.height, 'filters section reserves a constant min-height').to.be.within(80, 130);
                        expect(summaryRect.bottom, 'summary stays contained inside the section, no overflow').to.be.at.most(sectionRect.bottom + 1);
                      });
                      cy.get('[data-element-id="evaluation-working-days-1"]').then(($line1) => {
                        cy.get('[data-element-id="evaluation-working-days-2"]').then(($line2) => {
                          const line1Rect = $line1[0]!.getBoundingClientRect();
                          const line2Rect = $line2[0]!.getBoundingClientRect();
                          expect(line1Rect.left, 'lines are left-aligned within their own box, not right-aligned').to.be.closeTo(line2Rect.left, 1);
                        });
                      });
                    });

                  // Cleanup.
                  cy.request('DELETE', `/api/academic-year-modules/${academicYearModuleId}`);
                  cy.request('DELETE', `/api/academic-years/${academicYearId}`);
                  cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
                });
              });
            },
          );
        },
      );
    });
  });
});
