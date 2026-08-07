/// <reference types="cypress" />
// UC-02: Browse and select a school year via the carousel (views/calendario/use-cases.md)

import { signInAsE2eUser } from './support/sign-in';

/** Mirrors calendario-view.ts's currentSchoolYearStartYear — month >= 9 (Sept-Dec, 0-indexed
 * getMonth() >= 8) falls in the current calendar year's school year; earlier months fall in
 * the school year that started the previous calendar year. Computed here (not hardcoded) so
 * this spec stays correct whenever it actually runs. */
function currentSchoolYearStartYear(): number {
  const today = new Date();
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
}

interface AcademicYearRow {
  id: string;
  startYear: number;
}

describe('UC-02: Browse school year carousel', () => {
  beforeEach(() => {
    signInAsE2eUser();
  });

  it('defaults to the current school year and advances/retreats via the arrows', () => {
    const startYear = currentSchoolYearStartYear();

    // Backward navigation is data-gated (UC-02/A1: only years the teacher has actually
    // taught are reachable going back) — seed a real academic_years row for the current
    // school year itself so "next then prev" has real data to return to. Delete any stale
    // row first (e.g. left over from a crashed prior run against this persistent dev DB)
    // so creation is always a clean 201, never a 409 DUPLICATE_NAME.
    cy.request('GET', '/api/academic-years').then(({ body }) => {
      const existing = (body as { academicYears: AcademicYearRow[] }).academicYears.find((y) => y.startYear === startYear);
      const removeStaleRow = existing ? cy.request('DELETE', `/api/academic-years/${existing.id}`) : cy.wrap(null);

      removeStaleRow.then(() => {
        cy.request('POST', '/api/academic-years/selection', { startYear, moduleIds: [] }).then(({ body: selectionBody }) => {
          const rowId = (selectionBody as { academicYear: { id: string } }).academicYear.id;

          cy.visit('/calendario');

          cy.get('[data-element-id="academic-year-filter-value"]').should('contain.text', `${startYear}-${startYear + 1}`);

          cy.get('[data-element-id="academic-year-filter-next"]').click();
          cy.get('[data-element-id="academic-year-filter-value"]').should('contain.text', `${startYear + 1}-${startYear + 2}`);

          cy.get('[data-element-id="academic-year-filter-prev"]').click();
          cy.get('[data-element-id="academic-year-filter-value"]').should('contain.text', `${startYear}-${startYear + 1}`);

          cy.request('DELETE', `/api/academic-years/${rowId}`);
        });
      });
    });
  });

  it('A2: academic-year-filter-next disables once the forward limit (current + 5) is reached', () => {
    cy.visit('/calendario');

    for (let i = 0; i < 5; i += 1) {
      cy.get('[data-element-id="academic-year-filter-next"]').click();
    }

    const startYear = currentSchoolYearStartYear();
    cy.get('[data-element-id="academic-year-filter-value"]').should('contain.text', `${startYear + 5}-${startYear + 6}`);
    cy.get('[data-element-id="academic-year-filter-next"]').should('be.disabled');
  });
});
