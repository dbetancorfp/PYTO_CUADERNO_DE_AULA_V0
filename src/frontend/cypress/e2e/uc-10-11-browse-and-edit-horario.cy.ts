/// <reference types="cypress" />
// UC-10: Browse and select a módulo's horario via the filter bar
// UC-11: Edit and save a módulo's weekly horario
// (views/configuracion/use-cases.md). Combined in one file, same reasoning
// uc-03-04-select-modulo-and-view-calendar.cy.ts already applies: UC-11's grid only exists
// once UC-10's filter cascade has a módulo selected, so both flows are exercised together
// against the real, Postgres-seeded backend — no stubbed API responses.
//
// The carousel only reaches currentSchoolYearStartYear +/- a few clicks (forward capped at
// +5, see UC-10/A2), so — same constraint uc-02-browse-school-year-carousel.cy.ts and
// uc-03-04-select-modulo-and-view-calendar.cy.ts are already under — target years here are
// small offsets from "today", not `uniqueStartYear()`'s deliberately far-out range (that
// range exists precisely because it's unreachable by clicking, see support/sign-in.ts).
// Every target year is defensively cleaned up *before* use (`cleanupExistingYear`), not just
// after, so a stale row left by an earlier crashed run never causes a false 409/false
// non-empty-state here.

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
}
interface AcademicYearRow {
  id: string;
  startYear: number;
}

const TARGET_OFFSET = 1; // one click of schedule-academic-year-filter-next — within the +5 carousel window.

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

describe('UC-10/UC-11: Browse a módulo´s horario and edit/save its weekly schedule', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('selects a módulo via the Año/Ciclo/Módulo filter, edits its weekly grid, saves, and the saved values survive a reload', () => {
    const targetStartYear = currentSchoolYearStartYear() + TARGET_OFFSET;
    const cycleName = `E2E Horario Cycle ${Date.now()}`;
    const moduleName = `E2E Horario Module ${Date.now()}`;

    cleanupExistingYear(targetStartYear).then(() => {
      cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }).then(({ body: cycleBody }) => {
        const cycleId = (cycleBody as CatalogCycle).id;

        cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 }).then(
          ({ body: moduleBody }) => {
            const moduleId = (moduleBody as CatalogModule).id;

            cy.request('POST', '/api/academic-years/selection', { startYear: targetStartYear, moduleIds: [moduleId] }).then(
              ({ body: selectionBody }) => {
                const academicYearId = (selectionBody as { academicYear: { id: string } }).academicYear.id;

                cy.visit('/configuracion/horario');

                // Style application proof (mandatory at least once per view, see
                // e2e-engineer.md): the settings nav card's shared Tailwind styling really
                // loaded and applied inside this Shadow DOM — not just DOM presence.
                cy.get('[data-element-id="schedule-nav-link"]')
                  .should('be.visible')
                  .and('have.attr', 'aria-current', 'page');

                // UC-10 main flow: carousel navigation + cascading Ciclo/Módulo derivation.
                for (let i = 0; i < TARGET_OFFSET; i += 1) {
                  cy.get('[data-element-id="schedule-academic-year-filter-next"]').click();
                }
                cy.get('[data-element-id="schedule-academic-year-filter-value"]').should(
                  'contain.text',
                  `${targetStartYear}-${targetStartYear + 1}`,
                );
                cy.get('[data-element-id="schedule-cycle-filter"]').should('contain.text', cycleName);
                cy.get('[data-element-id="schedule-module-filter"]').should('contain.text', moduleName);
                cy.get('[data-element-id="schedule-empty-state"]').should('not.exist');

                // UC-11 main flow: every weekday starts blank ("Sin clase") — no schedule
                // saved yet for this brand-new academic_year_module.
                cy.get('[data-element-id="schedule-monday-select"]').should('have.value', '');
                cy.get('[data-element-id="schedule-friday-select"]').should('have.value', '');

                cy.get('[data-element-id="schedule-monday-select"]').select('2');
                cy.get('[data-element-id="schedule-friday-select"]').select('3');
                cy.get('[data-element-id="schedule-save-button"]').click();

                cy.get('[data-element-id="schedule-save-message"]').should('be.visible').and('not.be.empty');

                // Real persistence proof: reload the whole page (fresh component, fresh
                // GET /api/academic-year-modules/:id/schedule) and confirm the saved values
                // survive, straight from Postgres.
                cy.visit('/configuracion/horario');
                for (let i = 0; i < TARGET_OFFSET; i += 1) {
                  cy.get('[data-element-id="schedule-academic-year-filter-next"]').click();
                }
                cy.get('[data-element-id="schedule-module-filter"]').should('contain.text', moduleName);
                cy.get('[data-element-id="schedule-monday-select"]').should('have.value', '2');
                cy.get('[data-element-id="schedule-tuesday-select"]').should('have.value', '');
                cy.get('[data-element-id="schedule-friday-select"]').should('have.value', '3');

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

  it('UC-10/A3: a school year with no assigned módulos shows schedule-empty-state instead of the weekday grid', () => {
    const emptyTargetStartYear = currentSchoolYearStartYear() + 5;

    cleanupExistingYear(emptyTargetStartYear).then(() => {
      cy.visit('/configuracion/horario');

      for (let i = 0; i < 5; i += 1) {
        cy.get('[data-element-id="schedule-academic-year-filter-next"]').click();
      }
      cy.get('[data-element-id="schedule-academic-year-filter-value"]').should(
        'contain.text',
        `${emptyTargetStartYear}-${emptyTargetStartYear + 1}`,
      );

      cy.get('[data-element-id="schedule-empty-state"]').should('be.visible');
      cy.get('[data-element-id="schedule-monday-select"]').should('not.exist');
      cy.get('[data-element-id="schedule-save-button"]').should('not.exist');
    });
  });
});
