// elementId: back-to-dashboard-link, teacher-nav-link, training-catalog-nav-link,
// academic-year-nav-link, schedule-nav-link, schedule-academic-year-filter-prev,
// schedule-academic-year-filter-value, schedule-academic-year-filter-next,
// schedule-cycle-filter, schedule-module-filter, schedule-empty-state,
// schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select,
// schedule-thursday-select, schedule-friday-select, schedule-save-button,
// schedule-save-message (see views/configuracion/use-cases.md UC-03/UC-10/UC-11). New
// component, doesn't exist yet — a 4th settings screen (app-schedule-settings-view),
// sibling to teacher/training-catalog/academic-year, reusing Calendario's exact
// Año/Ciclo/Módulo cascading-filter pattern (see calendario-view.test.ts) in front of a
// draft-until-saved 5-weekday hours grid instead of a read-only calendar.
//
// Testing seam: `today` is a settable property (defaults to `new Date()`), same
// current-school-year determinism trick calendario-view.ts already uses.
import { describe, it, expect } from 'bun:test';
import '../src/schedule-settings-view';
import type { ScheduleSettingsView } from '../src/schedule-settings-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

interface AcademicYear {
  id: string;
  startYear: number;
  isCurrent: boolean;
}

interface AcademicYearModuleDetail {
  id: string;
  catalogModuleId: string;
  catalogTrainingCycleId: string;
  catalogTrainingCycleName: string;
  course: number;
  name: string;
}

interface AcademicYearApiService {
  list(): Promise<AcademicYear[]>;
  listModules(id: string): Promise<AcademicYearModuleDetail[]>;
}

interface ScheduleEntry {
  weekday: number;
  hours: number;
}

type SaveScheduleResult =
  | { outcome: 'success'; value: ScheduleEntry[] }
  | { outcome: 'not-found' }
  | { outcome: 'validation-error' };

interface AcademicYearModuleScheduleApiService {
  find(academicYearModuleId: string): Promise<ScheduleEntry[]>;
  save(academicYearModuleId: string, entries: ScheduleEntry[]): Promise<SaveScheduleResult>;
}

function fakeSessionService(): SessionApiService {
  return { getSession: async () => ({ authenticated: true, fullName: 'Ana García' }), logout: async () => {} };
}

const MODULE_DAW: AcademicYearModuleDetail = {
  id: 'am1',
  catalogModuleId: 'm1',
  catalogTrainingCycleId: 'c1',
  catalogTrainingCycleName: 'DAW',
  course: 1,
  name: 'Programación',
};

const MODULE_DAM: AcademicYearModuleDetail = {
  id: 'am2',
  catalogModuleId: 'm2',
  catalogTrainingCycleId: 'c2',
  catalogTrainingCycleName: 'DAM',
  course: 1,
  name: 'Bases de datos',
};

function fakeAcademicYearService(overrides: Partial<AcademicYearApiService> = {}): AcademicYearApiService {
  return {
    list: async () => [{ id: 'y1', startYear: 2025, isCurrent: false }],
    listModules: async () => [MODULE_DAW],
    ...overrides,
  };
}

function fakeScheduleService(overrides: Partial<AcademicYearModuleScheduleApiService> = {}): AcademicYearModuleScheduleApiService {
  return {
    find: async () => [],
    save: async (_id, entries) => ({ outcome: 'success', value: entries }),
    ...overrides,
  };
}

async function mountView(overrides?: {
  academicYear?: AcademicYearApiService;
  schedule?: AcademicYearModuleScheduleApiService;
  today?: Date;
}): Promise<ScheduleSettingsView> {
  const el = document.createElement('app-schedule-settings-view') as ScheduleSettingsView;
  el.sessionService = fakeSessionService();
  el.academicYearService = overrides?.academicYear ?? fakeAcademicYearService();
  el.scheduleService = overrides?.schedule ?? fakeScheduleService();
  if (overrides?.today) el.today = overrides.today;
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function weekdaySelect(el: ScheduleSettingsView, elementId: string): HTMLSelectElement {
  return el.shadowRoot!.querySelector<HTMLSelectElement>(`[data-element-id="${elementId}"]`)!;
}

describe('elementId: back-to-dashboard-link', () => {
  it('clicking back-to-dashboard-link navigates to /dashboard', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="back-to-dashboard-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/dashboard');

    window.history.pushState({}, '', '/configuracion/horario');
    el.remove();
  });
});

describe('elementId: schedule-nav-link, teacher-nav-link, training-catalog-nav-link, academic-year-nav-link', () => {
  it('schedule-nav-link is active and the other three are inactive on this screen', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-nav-link"]')!.getAttribute('aria-current')).toBe('page');
    expect(el.shadowRoot!.querySelector('[data-element-id="teacher-nav-link"]')!.getAttribute('aria-current')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="training-catalog-nav-link"]')!.getAttribute('aria-current')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-nav-link"]')!.getAttribute('aria-current')).toBeNull();

    el.remove();
  });

  it('clicking teacher-nav-link navigates to /configuracion/profesor', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="teacher-nav-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/configuracion/profesor');

    window.history.pushState({}, '', '/configuracion/horario');
    el.remove();
  });

  it('clicking academic-year-nav-link navigates to /configuracion/ano-academico', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-nav-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/configuracion/ano-academico');

    window.history.pushState({}, '', '/configuracion/horario');
    el.remove();
  });
});

describe('elementId: schedule-academic-year-filter-prev, schedule-academic-year-filter-value, schedule-academic-year-filter-next', () => {
  it('defaults to the school year containing today (before September)', async () => {
    const el = await mountView({ today: new Date('2026-08-07T12:00:00Z') });

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-academic-year-filter-value"]')!.textContent).toContain('2025-2026');

    el.remove();
  });

  it('defaults to the school year containing today (September onward)', async () => {
    const el = await mountView({ today: new Date('2026-10-15T12:00:00Z') });

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-academic-year-filter-value"]')!.textContent).toContain('2026-2027');

    el.remove();
  });

  it('schedule-academic-year-filter-prev is disabled with no earlier academic_years row', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      academicYear: fakeAcademicYearService({ list: async () => [{ id: 'y1', startYear: 2025, isCurrent: false }] }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-academic-year-filter-prev"]')!.hasAttribute('disabled')).toBe(true);

    el.remove();
  });

  it('clicking schedule-academic-year-filter-prev when enabled selects the previous year and re-derives schedule-cycle-filter', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      academicYear: fakeAcademicYearService({
        list: async () => [
          { id: 'y0', startYear: 2024, isCurrent: false },
          { id: 'y1', startYear: 2025, isCurrent: false },
        ],
        listModules: async (id: string) => (id === 'y0' ? [MODULE_DAM] : [MODULE_DAW]),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="schedule-academic-year-filter-prev"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-academic-year-filter-value"]')!.textContent).toContain('2024-2025');
    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-cycle-filter"]')!.textContent).toContain('DAM');

    el.remove();
  });

  it('schedule-academic-year-filter-next is disabled once the selected year reaches currentSchoolYearStartYear + 5', async () => {
    const el = await mountView({ today: new Date('2026-08-07T12:00:00Z'), academicYear: fakeAcademicYearService({ list: async () => [] }) });

    for (let i = 0; i < 5; i += 1) {
      el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="schedule-academic-year-filter-next"]')!.click();
      await tick();
    }

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-academic-year-filter-value"]')!.textContent).toContain('2030-2031');
    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-academic-year-filter-next"]')!.hasAttribute('disabled')).toBe(true);

    el.remove();
  });
});

describe('elementId: schedule-cycle-filter, schedule-module-filter, schedule-empty-state', () => {
  it('schedule-cycle-filter lists distinct cycles, first selected by default, deriving schedule-module-filter', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
    });

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="schedule-cycle-filter"]')!;
    expect(cycleSelect.querySelectorAll('option')).toHaveLength(2);
    expect(cycleSelect.value).toBe('c1');

    const moduleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="schedule-module-filter"]')!;
    expect(moduleSelect.textContent).toContain('Programación');
    expect(moduleSelect.value).toBe('am1');

    el.remove();
  });

  it('changing schedule-cycle-filter re-derives schedule-module-filter to that cycle´s módulos only', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
    });

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="schedule-cycle-filter"]')!;
    cycleSelect.value = 'c2';
    cycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const moduleFilterText = el.shadowRoot!.querySelector('[data-element-id="schedule-module-filter"]')!.textContent!;
    expect(moduleFilterText).toContain('Bases de datos');
    expect(moduleFilterText).not.toContain('Programación');

    el.remove();
  });

  it('shows schedule-empty-state instead of the weekday grid when the selected year has no cycles', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ list: async () => [], listModules: async () => [] }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-empty-state"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-monday-select"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-save-button"]')).toBeNull();

    el.remove();
  });
});

describe('elementId: schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select, schedule-thursday-select, schedule-friday-select', () => {
  it('each weekday select offers exactly 4 options: blank/"Sin clase", 1, 2, 3', async () => {
    const el = await mountView();

    expect(weekdaySelect(el, 'schedule-monday-select').querySelectorAll('option')).toHaveLength(4);

    el.remove();
  });

  it('on load, each weekday select reflects its saved value, or blank when no row exists for that weekday', async () => {
    const el = await mountView({
      schedule: fakeScheduleService({
        find: async () => [
          { weekday: 1, hours: 2 },
          { weekday: 5, hours: 3 },
        ],
      }),
    });

    expect(weekdaySelect(el, 'schedule-monday-select').value).toBe('2');
    expect(weekdaySelect(el, 'schedule-tuesday-select').value).toBe('');
    expect(weekdaySelect(el, 'schedule-wednesday-select').value).toBe('');
    expect(weekdaySelect(el, 'schedule-thursday-select').value).toBe('');
    expect(weekdaySelect(el, 'schedule-friday-select').value).toBe('3');

    el.remove();
  });

  it('changing a weekday select does not call scheduleService.save by itself', async () => {
    let saveCalls = 0;
    const el = await mountView({ schedule: fakeScheduleService({ save: async (_id, entries) => { saveCalls += 1; return { outcome: 'success', value: entries }; } }) });

    weekdaySelect(el, 'schedule-monday-select').value = '2';
    weekdaySelect(el, 'schedule-monday-select').dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(saveCalls).toBe(0);

    el.remove();
  });

  it('changing schedule-module-filter discards an unsaved draft and loads the newly selected módulo´s schedule', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
      schedule: fakeScheduleService({
        find: async (academicYearModuleId: string) => (academicYearModuleId === 'am2' ? [{ weekday: 2, hours: 1 }] : []),
      }),
    });

    weekdaySelect(el, 'schedule-monday-select').value = '3';
    weekdaySelect(el, 'schedule-monday-select').dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="schedule-cycle-filter"]')!;
    cycleSelect.value = 'c2';
    cycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(weekdaySelect(el, 'schedule-monday-select').value).toBe('');
    expect(weekdaySelect(el, 'schedule-tuesday-select').value).toBe('1');

    el.remove();
  });
});

describe('elementId: schedule-save-button, schedule-save-message', () => {
  it('clicking schedule-save-button sends exactly one save with all 5 weekdays´ current draft values', async () => {
    const calls: { id: string; entries: ScheduleEntry[] }[] = [];
    const el = await mountView({
      schedule: fakeScheduleService({
        save: async (id: string, entries: ScheduleEntry[]) => {
          calls.push({ id, entries });
          return { outcome: 'success', value: entries };
        },
      }),
    });

    weekdaySelect(el, 'schedule-monday-select').value = '2';
    weekdaySelect(el, 'schedule-monday-select').dispatchEvent(new Event('change', { bubbles: true }));
    weekdaySelect(el, 'schedule-friday-select').value = '1';
    weekdaySelect(el, 'schedule-friday-select').dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="schedule-save-button"]')!.click();
    await tick();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe('am1');
    expect(calls[0]!.entries.slice().sort((a, b) => a.weekday - b.weekday)).toEqual([
      { weekday: 1, hours: 2 },
      { weekday: 5, hours: 1 },
    ]);

    el.remove();
  });

  it('a weekday left blank in the draft is not included in the save payload', async () => {
    const calls: ScheduleEntry[][] = [];
    const el = await mountView({
      schedule: fakeScheduleService({
        save: async (_id: string, entries: ScheduleEntry[]) => {
          calls.push(entries);
          return { outcome: 'success', value: entries };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="schedule-save-button"]')!.click();
    await tick();

    expect(calls[0]).toEqual([]);

    el.remove();
  });

  it('schedule-save-message shows success after a successful save', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="schedule-save-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-save-message"]')!.textContent).toBeTruthy();

    el.remove();
  });

  it('schedule-save-message shows an error after a failed save', async () => {
    const el = await mountView({ schedule: fakeScheduleService({ save: async () => ({ outcome: 'not-found' }) }) });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="schedule-save-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-save-message"]')!.textContent).toBeTruthy();

    el.remove();
  });

  it('schedule-save-message is not visible on first load, before any save attempt', async () => {
    const el = await mountView();

    const message = el.shadowRoot!.querySelector('[data-element-id="schedule-save-message"]');
    expect(message === null || message.textContent === '').toBe(true);

    el.remove();
  });

  it('schedule-save-message hides again as soon as a filter changes after a save', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="schedule-save-button"]')!.click();
    await tick();
    expect(el.shadowRoot!.querySelector('[data-element-id="schedule-save-message"]')!.textContent).toBeTruthy();

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="schedule-cycle-filter"]')!;
    cycleSelect.value = 'c2';
    cycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const message = el.shadowRoot!.querySelector('[data-element-id="schedule-save-message"]');
    expect(message === null || message.textContent === '').toBe(true);

    el.remove();
  });
});
