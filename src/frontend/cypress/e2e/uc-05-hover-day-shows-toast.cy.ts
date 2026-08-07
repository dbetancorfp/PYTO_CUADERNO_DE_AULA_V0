/// <reference types="cypress" />
// UC-05: See event details on hover (views/calendario/use-cases.md)

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

  it('shows calendario-day-toast on hover with the event name, and dismisses it on mouseleave', () => {
    const targetStartYear = currentSchoolYearStartYear() + TARGET_OFFSET;
    const cycleName = `E2E Toast Cycle ${Date.now()}`;
    const moduleName = `E2E Toast Module ${Date.now()}`;

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

                // calendario-view.ts delegates via mouseover/mouseout (bubbling), not
                // mouseenter/mouseleave — verified live in Chrome that real pointer movement
                // never fires mouseenter/mouseleave through a capture-phase ShadowRoot
                // listener, only mouseover/mouseout/mousemove do.
                cy.get(`[data-element-id="calendario-month-${targetStartYear}-12-day-25"]`).trigger('mouseover', { bubbles: true });
                cy.get('[data-element-id="calendario-day-toast"]').should('be.visible').and('contain.text', 'Vacaciones de Navidad.');

                cy.get(`[data-element-id="calendario-month-${targetStartYear}-12-day-25"]`).trigger('mouseout', { bubbles: true });
                cy.get('[data-element-id="calendario-day-toast"]').should('not.exist');

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
