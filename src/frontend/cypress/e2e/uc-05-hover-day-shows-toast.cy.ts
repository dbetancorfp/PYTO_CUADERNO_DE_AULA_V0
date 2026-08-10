/// <reference types="cypress" />
// UC-05: See event details on hover (views/calendario/use-cases.md). 2026-08-10:
// calendario-day-tooltip replaces the earlier calendario-day-toast — a pure Tailwind
// `group`/`group-hover:block` CSS reveal instead of a JS mouseover/mouseout-driven toast.
//
// Genuine `:hover` activation requires real OS-level cursor movement, which Cypress's
// `.trigger('mouseover')` (a synthetic DOM event dispatch) does not produce — asserting a
// visual reveal on top of it would be a pretend mechanism, not a real proof. What *is* real
// and worth proving here: the tooltip node exists in the real DOM with the exact expected
// content, real Tailwind CSS actually compiled/served the `hidden` utility (so it starts
// genuinely `display: none`, not just unstyled), and a day with no event has no tooltip
// node at all. `group-hover:block`'s own CSS-pseudo-class mechanics are Tailwind's own
// extensively-tested library behavior, not this app's code — out of this spec's scope.

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

const TARGET_OFFSET = 3;

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

describe('UC-05: See event details on hover', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('renders a calendario-day-tooltip node with the real event name, hidden by default via real Tailwind CSS', () => {
    const targetStartYear = currentSchoolYearStartYear() + TARGET_OFFSET;
    const cycleName = `E2E Tooltip Cycle ${Date.now()}`;
    const moduleName = `E2E Tooltip Module ${Date.now()}`;

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
                cy.get('[data-element-id="calendario-months"]').should('exist');

                // Real DOM + real content, on a real, Postgres-seeded holidays entry.
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-12-day-25-tooltip"]`)
                  .should('exist')
                  .and('contain.text', 'Vacaciones de Navidad.');

                // Style application proof: real Tailwind CSS compiled the `hidden` utility
                // for this element, so it's genuinely display:none by default in the real
                // browser, not merely absent a class in the DOM.
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-12-day-25-tooltip"]`).should(
                  'have.css',
                  'display',
                  'none',
                );

                // A1 — a day cell with no calendario_modulo entry has no tooltip node.
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-12-day-20-tooltip"]`).should('not.exist');

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
