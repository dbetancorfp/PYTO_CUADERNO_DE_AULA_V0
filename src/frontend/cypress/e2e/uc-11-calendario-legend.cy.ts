/// <reference types="cypress" />
// UC-11: See the color legend for the selected módulo's calendar (views/calendario/use-cases.md,
// 2026-08-10). Real end-to-end proof that calendario_modulo.type flows from Postgres-seeded
// key_dates through the seeding pass to calendario-legend's swatches and calendario-months's
// day-cell colors — UC-11's canonical color table applied against real data, not a stub. Also
// proves the same-day weekend rule: neutral gray only when uncovered, real color (never
// darkened) when a real entry covers the day.

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
  catalogModuleId: string;
}
interface CalendarioModuloEntry {
  id: string;
  category: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string | null;
}

// currentSchoolYearStartYear + 0 — the other calendario specs already occupy +1 (UC-09/10),
// +2 (UC-03/04), +3 (UC-05, UC-08), +4 and +5 (UC-06); this is the only untaken offset within
// the +5 carousel window.
const TARGET_OFFSET = 0;

// Mirrors views/calendario/use-cases.md UC-11's canonical table — only the rows this spec
// asserts against directly, kept in sync manually (same convention the other calendario
// specs already use for expected counts/dates derived from the real seed data).
const ROW_1_HEX = 'rgb(42, 120, 214)'; // academic_key_dates / Curso escolar
const ROW_3_HEX = 'rgb(237, 161, 0)'; // holidays / Vacaciones
const WEEKEND_GRAY = 'rgb(203, 213, 225)';

function dayElementIdFor(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `calendario-month-${year}-${month}-day-${day}`;
}

function isWeekendIso(isoDate: string): boolean {
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

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

describe('UC-11: See the color legend for the selected módulo´s calendar', () => {
  const targetStartYear = currentSchoolYearStartYear() + TARGET_OFFSET;
  const cycleName = `E2E UC11 Cycle ${Date.now()}`;
  const moduleName = `E2E UC11 Module ${Date.now()}`;
  let academicYearId: string;
  let cycleId: string;
  let academicYearModuleId: string;
  let entries: CalendarioModuloEntry[];

  before(() => {
    signInAsE2eUser();

    cleanupExistingYear(targetStartYear)
      .then(() => cy.request('POST', '/api/catalog/training-cycles', { name: cycleName }))
      .then(({ body }) => {
        cycleId = (body as CatalogCycle).id;
        return cy.request('POST', `/api/catalog/training-cycles/${cycleId}/modules`, { name: moduleName, course: 1 });
      })
      .then(({ body }) => {
        const moduleId = (body as CatalogModule).id;
        return cy.request('POST', '/api/academic-years/selection', { startYear: targetStartYear, moduleIds: [moduleId] });
      })
      .then(({ body }) => {
        academicYearId = (body as { academicYear: { id: string } }).academicYear.id;
        return cy.request('GET', `/api/academic-years/${academicYearId}/modules`);
      })
      .then(({ body }) => {
        academicYearModuleId = (body as { modules: AcademicYearModule[] }).modules[0]!.id;
        return cy.request('GET', `/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`);
      })
      .then(({ body }) => {
        entries = (body as { entries: CalendarioModuloEntry[] }).entries;
      });
  });

  after(() => {
    cy.request('DELETE', `/api/academic-year-modules/${academicYearModuleId}`);
    cy.request('DELETE', `/api/academic-years/${academicYearId}`);
    cy.request('DELETE', `/api/catalog/training-cycles/${cycleId}`);
  });

  beforeEach(() => {
    signInAsE2eUser();
  });

  it('renders the legend in canonical order below the filters row, each swatch matching the real day-cell color for the same (category,type)', () => {
    // Real end-to-end type propagation, proven against real Postgres-seeded key_dates: at
    // least one non-final_exams entry carries a real type, and every final_exams entry has
    // type null (computed, no key_dates row to copy from).
    expect(entries.some((e) => e.category !== 'final_exams' && typeof e.type === 'string')).to.eq(true);
    expect(entries.filter((e) => e.category === 'final_exams').every((e) => e.type === null)).to.eq(true);

    cy.visit('/calendario');
    for (let i = 0; i < TARGET_OFFSET; i += 1) {
      cy.get('[data-element-id="academic-year-filter-next"]').click();
    }
    cy.get('[data-element-id="academic-year-filter-value"]').should('contain.text', `${targetStartYear}-${targetStartYear + 1}`);
    cy.get('[data-element-id="module-filter"]').should('contain.text', moduleName);

    // Legend renders directly below the filters row, horizontal, wrapping.
    cy.get('[data-element-id="calendario-legend"]').should('exist');
    cy.get('[data-element-id="calendario-legend"]').should('have.css', 'flex-wrap', 'wrap');
    cy.get('[data-element-id="cycle-filter"]').then(($filters) => {
      cy.get('[data-element-id="calendario-legend"]').then(($legend) => {
        // DOCUMENT_POSITION_FOLLOWING on $legend relative to $filters means $legend comes
        // after $filters in the DOM — i.e. the legend renders below the filters row.
        // eslint-disable-next-line no-bitwise
        expect($filters[0]!.compareDocumentPosition($legend[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(0);
      });
    });

    // Canonical order: legend item row numbers strictly increase regardless of the order
    // calendario_modulo rows happen to be in (real seeded data, not a hand-ordered fixture).
    cy.get('[data-element-id^="calendario-legend-item-"]').then(($items) => {
      const rowNumbers = [...$items].map((el) => Number(el.getAttribute('data-element-id')!.split('-').pop()));
      const sorted = [...rowNumbers].sort((a, b) => a - b);
      expect(rowNumbers).to.deep.equal(sorted);
      expect(rowNumbers.length).to.be.greaterThan(0);
    });

    // Each swatch's color exactly matches the real day-cell color for the same
    // (category,type) — single source of truth, checked against real seeded data.
    const cursoEscolar = entries.find((e) => e.category === 'academic_key_dates' && e.type === 'Curso escolar');
    expect(cursoEscolar, 'a real "Curso escolar" academic_key_dates entry').to.exist;
    cy.get('[data-element-id="calendario-legend-item-1"]').should('have.css', 'background-color', ROW_1_HEX);
    cy.get(`[data-element-id="${dayElementIdFor(cursoEscolar!.startDate)}"]`).should('have.css', 'background-color', ROW_1_HEX);

    const vacaciones = entries.find((e) => e.category === 'holidays' && e.type === 'Vacaciones');
    expect(vacaciones, 'a real "Vacaciones" holidays entry').to.exist;
    cy.get('[data-element-id="calendario-legend-item-3"]').should('have.css', 'background-color', ROW_3_HEX);
    cy.get(`[data-element-id="${dayElementIdFor(vacaciones!.startDate)}"]`).should('have.css', 'background-color', ROW_3_HEX);
  });

  it('colors a plain uncovered weekend day neutral gray, and a weekend day covered by a real entry with that entry´s real color, never darkened', () => {
    cy.visit('/calendario');
    for (let i = 0; i < TARGET_OFFSET; i += 1) {
      cy.get('[data-element-id="academic-year-filter-next"]').click();
    }
    cy.get('[data-element-id="module-filter"]').should('contain.text', moduleName);

    // A1 — a covered weekend: find a real entry whose start or end boundary lands on a
    // Saturday/Sunday (guaranteed to exist among 51 real multi-week ranges — Vacaciones de
    // Navidad, Curso escolar, FEOE alternancia days, etc.) and assert its cell renders that
    // entry's real color, never the neutral gray and never a darkened tone.
    const coveredWeekendEntry = entries.find((e) => isWeekendIso(e.startDate) || isWeekendIso(e.endDate));
    expect(coveredWeekendEntry, 'at least one real entry with a weekend boundary day').to.exist;
    const weekendDate = isWeekendIso(coveredWeekendEntry!.startDate) ? coveredWeekendEntry!.startDate : coveredWeekendEntry!.endDate;
    cy.get(`[data-element-id="${dayElementIdFor(weekendDate)}"]`)
      .should('have.attr', 'data-calendario-day-categories')
      .and('include', coveredWeekendEntry!.category);
    cy.get(`[data-element-id="${dayElementIdFor(weekendDate)}"]`)
      .should('have.css', 'background-color')
      .and('not.eq', WEEKEND_GRAY)
      .and('not.eq', 'rgb(185, 28, 28)'); // pre-2026-08-10 darkened weekend+public_holidays red

    // A4 — a plain uncovered weekend day (no data-calendario-day-categories at all) renders
    // the neutral gray, not the old uncolored/red weekend background.
    cy.get('[data-element-id*="-day-"]:not([data-calendario-day-categories])').then(($cells) => {
      const uncoveredWeekendCell = [...$cells].find((cell) => isWeekendIso(cell.getAttribute('data-element-id')!.replace(/^calendario-month-(\d{4})-(\d{2})-day-(\d{2})$/, '$1-$2-$3')));
      expect(uncoveredWeekendCell, 'at least one plain uncovered weekend day cell in the rendered 10-month grid').to.exist;
      cy.wrap(uncoveredWeekendCell).should('have.css', 'background-color', WEEKEND_GRAY);
    });
  });
});
