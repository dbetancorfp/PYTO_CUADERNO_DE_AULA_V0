// elementId: academic-year-filter-prev/-value/-next, cycle-filter, module-filter (and the
// schedule-* prefixed equivalents in views/configuracion). Shared school-year carousel +
// Ciclo/Módulo cascade extracted from calendario-view.ts/schedule-settings-view.ts
// (2026-08-12, closes a SonarCloud duplication finding — see review-report.md).
import { describe, it, expect } from 'bun:test';
import { render } from 'lit-html';
import {
  canGoToNextYear,
  canGoToPreviousYear,
  currentSchoolYearStartYear,
  distinctCyclesFromYearModules,
  FORWARD_YEAR_WINDOW,
  modulesForSelectedCycle,
  renderYearCycleModuleFilters,
} from '../src/academic-year-cycle-module-cascade';
import type { AcademicYear, AcademicYearModuleDetail } from '../src/academic-year-api-service';

function makeYear(overrides: Partial<AcademicYear> = {}): AcademicYear {
  return { id: 'y1', startYear: 2026, isCurrent: false, ...overrides };
}

function makeModule(overrides: Partial<AcademicYearModuleDetail> = {}): AcademicYearModuleDetail {
  return {
    id: 'm1',
    catalogModuleId: 'cm1',
    catalogTrainingCycleId: 'c1',
    catalogTrainingCycleName: 'DAW',
    course: 1,
    name: 'Programación',
    ...overrides,
  };
}

describe('currentSchoolYearStartYear', () => {
  it('resolves September or later to that calendar year', () => {
    expect(currentSchoolYearStartYear(new Date(2026, 8, 1))).toBe(2026);
  });

  it('resolves before September to the previous calendar year', () => {
    expect(currentSchoolYearStartYear(new Date(2026, 7, 31))).toBe(2025);
  });
});

describe('canGoToPreviousYear / canGoToNextYear', () => {
  it('allows going back when an earlier academic_years row exists', () => {
    expect(canGoToPreviousYear([makeYear({ startYear: 2025 })], 2026)).toBe(true);
  });

  it('does not allow going back when no earlier row exists', () => {
    expect(canGoToPreviousYear([makeYear({ startYear: 2026 })], 2026)).toBe(false);
  });

  it('allows going forward within FORWARD_YEAR_WINDOW of the current school year', () => {
    expect(canGoToNextYear(2026, 2026)).toBe(true);
    expect(canGoToNextYear(2026 + FORWARD_YEAR_WINDOW - 1, 2026)).toBe(true);
  });

  it('does not allow going forward past FORWARD_YEAR_WINDOW of the current school year', () => {
    expect(canGoToNextYear(2026 + FORWARD_YEAR_WINDOW, 2026)).toBe(false);
  });
});

describe('distinctCyclesFromYearModules', () => {
  it('returns distinct cycles in first-seen order', () => {
    const modules = [
      makeModule({ catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW' }),
      makeModule({ catalogTrainingCycleId: 'c2', catalogTrainingCycleName: 'DAM' }),
      makeModule({ catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW' }),
    ];

    expect(distinctCyclesFromYearModules(modules)).toEqual([
      { id: 'c1', name: 'DAW' },
      { id: 'c2', name: 'DAM' },
    ]);
  });

  it('returns an empty array when there are no módulos', () => {
    expect(distinctCyclesFromYearModules([])).toEqual([]);
  });
});

describe('modulesForSelectedCycle', () => {
  it('returns an empty array when no cycle is selected', () => {
    expect(modulesForSelectedCycle([makeModule()], null)).toEqual([]);
  });

  it('filters to the selected cycle and sorts by course then name', () => {
    const modules = [
      makeModule({ id: 'm-b2', catalogTrainingCycleId: 'c1', course: 2, name: 'Zebra' }),
      makeModule({ id: 'm-other', catalogTrainingCycleId: 'c2', course: 1, name: 'Ajeno' }),
      makeModule({ id: 'm-a1', catalogTrainingCycleId: 'c1', course: 1, name: 'Alfa' }),
      makeModule({ id: 'm-b1', catalogTrainingCycleId: 'c1', course: 1, name: 'Beta' }),
    ];

    expect(modulesForSelectedCycle(modules, 'c1').map((module) => module.id)).toEqual(['m-a1', 'm-b1', 'm-b2']);
  });
});

describe('renderYearCycleModuleFilters', () => {
  function renderInto(params: Parameters<typeof renderYearCycleModuleFilters>[0]): HTMLElement {
    const container = document.createElement('div');
    render(renderYearCycleModuleFilters(params), container);
    return container;
  }

  it('renders with the given idPrefix on every data-element-id', () => {
    const container = renderInto({
      idPrefix: 'schedule-',
      yearLabel: '2026-2027',
      canGoToPreviousYear: true,
      canGoToNextYear: true,
      cycles: [{ id: 'c1', name: 'DAW' }],
      selectedCycleId: 'c1',
      modules: [makeModule({ id: 'm1', name: 'Programación' })],
      selectedModuleId: 'm1',
    });

    expect(container.querySelector('[data-element-id="schedule-academic-year-filter-prev"]')).not.toBeNull();
    expect(container.querySelector('[data-element-id="schedule-academic-year-filter-value"]')?.textContent).toBe('2026-2027');
    expect(container.querySelector('[data-element-id="schedule-academic-year-filter-next"]')).not.toBeNull();
    expect(container.querySelector('[data-element-id="schedule-cycle-filter"]')).not.toBeNull();
    expect(container.querySelector('[data-element-id="schedule-module-filter"]')).not.toBeNull();
  });

  it('renders with an empty idPrefix (calendario)', () => {
    const container = renderInto({
      idPrefix: '',
      yearLabel: '2026-2027',
      canGoToPreviousYear: false,
      canGoToNextYear: false,
      cycles: [],
      selectedCycleId: null,
      modules: [],
      selectedModuleId: null,
    });

    expect(container.querySelector('[data-element-id="academic-year-filter-prev"]')).not.toBeNull();
    expect(container.querySelector('[data-element-id="cycle-filter"]')).not.toBeNull();
    expect(container.querySelector('[data-element-id="module-filter"]')).not.toBeNull();
  });

  it('disables the previous/next buttons per canGoToPreviousYear/canGoToNextYear', () => {
    const container = renderInto({
      idPrefix: '',
      yearLabel: '2026-2027',
      canGoToPreviousYear: false,
      canGoToNextYear: false,
      cycles: [],
      selectedCycleId: null,
      modules: [],
      selectedModuleId: null,
    });

    expect((container.querySelector('[data-element-id="academic-year-filter-prev"]') as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector('[data-element-id="academic-year-filter-next"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables cycle-filter/module-filter when their option lists are empty', () => {
    const container = renderInto({
      idPrefix: '',
      yearLabel: '2026-2027',
      canGoToPreviousYear: true,
      canGoToNextYear: true,
      cycles: [],
      selectedCycleId: null,
      modules: [],
      selectedModuleId: null,
    });

    expect((container.querySelector('[data-element-id="cycle-filter"]') as HTMLSelectElement).disabled).toBe(true);
    expect((container.querySelector('[data-element-id="module-filter"]') as HTMLSelectElement).disabled).toBe(true);
  });

  it('marks the selected cycle/módulo option as selected', () => {
    const container = renderInto({
      idPrefix: '',
      yearLabel: '2026-2027',
      canGoToPreviousYear: true,
      canGoToNextYear: true,
      cycles: [
        { id: 'c1', name: 'DAW' },
        { id: 'c2', name: 'DAM' },
      ],
      selectedCycleId: 'c2',
      modules: [makeModule({ id: 'm1', name: 'A' }), makeModule({ id: 'm2', name: 'B' })],
      selectedModuleId: 'm2',
    });

    const cycleSelect = container.querySelector('[data-element-id="cycle-filter"]') as HTMLSelectElement;
    const moduleSelect = container.querySelector('[data-element-id="module-filter"]') as HTMLSelectElement;
    expect(cycleSelect.value).toBe('c2');
    expect(moduleSelect.value).toBe('m2');
  });
});
