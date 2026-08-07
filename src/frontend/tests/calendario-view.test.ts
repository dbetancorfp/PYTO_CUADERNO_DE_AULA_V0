// elementId: calendario-heading, back-to-dashboard-link, academic-year-filter-prev,
// academic-year-filter-value, academic-year-filter-next, cycle-filter, module-filter,
// calendario-months, calendario-empty-state, calendario-day-toast (see
// views/calendario/use-cases.md UC-01..UC-05). Read-only screen — renders exclusively from
// calendario_modulo (via calendarioModuloService), never key_dates directly.
//
// Testing seam: `today` is a settable property (defaults to `new Date()`) so
// currentSchoolYearStartYear (month >= 9 -> current calendar year, else -> current calendar
// year - 1) is deterministic in tests instead of depending on the real wall-clock date —
// same setter-injection style the project already uses for services, applied to make a
// date-dependent pure computation testable.
//
// Day cells carry `data-calendario-day-categories` (comma-joined category names covering
// that day, e.g. "holidays" or "evaluations,feoe_project_days") as the test hook for the
// color-assignment business rule — real computed color is Cypress's job
// (style-application-proof), this only pins the underlying category-resolution logic.
import { describe, it, expect } from 'bun:test';
import '../src/calendario-view';
import type { CalendarioView } from '../src/calendario-view';

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

interface CalendarioModuloEntry {
  id: string;
  category: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface CalendarioModuloApiService {
  findForModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]>;
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

function fakeCalendarioModuloService(overrides: Partial<CalendarioModuloApiService> = {}): CalendarioModuloApiService {
  return {
    findForModule: async () => [],
    ...overrides,
  };
}

async function mountView(overrides?: {
  academicYear?: AcademicYearApiService;
  calendarioModulo?: CalendarioModuloApiService;
  today?: Date;
}): Promise<CalendarioView> {
  const el = document.createElement('app-calendario-view') as CalendarioView;
  el.sessionService = fakeSessionService();
  el.academicYearService = overrides?.academicYear ?? fakeAcademicYearService();
  el.calendarioModuloService = overrides?.calendarioModulo ?? fakeCalendarioModuloService();
  if (overrides?.today) el.today = overrides.today;
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function dayCategories(el: CalendarioView, monthId: string, day: string): string | null {
  return el.shadowRoot!.querySelector(`[data-element-id="${monthId}-day-${day}"]`)?.getAttribute('data-calendario-day-categories') ?? null;
}

describe('elementId: calendario-heading, back-to-dashboard-link', () => {
  it('calendario-heading renders "Calendario"', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-heading"]')!.textContent).toContain('Calendario');

    el.remove();
  });

  it('clicking back-to-dashboard-link navigates to /dashboard', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="back-to-dashboard-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/dashboard');

    window.history.pushState({}, '', '/calendario');
    el.remove();
  });
});

describe('elementId: academic-year-filter-prev, academic-year-filter-value, academic-year-filter-next', () => {
  it('defaults to the school year containing today (before September)', async () => {
    const el = await mountView({ today: new Date('2026-08-07T12:00:00Z') });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-value"]')!.textContent).toContain('2025-2026');

    el.remove();
  });

  it('defaults to the school year containing today (September onward)', async () => {
    const el = await mountView({ today: new Date('2026-10-15T12:00:00Z') });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-value"]')!.textContent).toContain('2026-2027');

    el.remove();
  });

  it('academic-year-filter-prev is disabled with no earlier academic_years row, enabled once one exists', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      academicYear: fakeAcademicYearService({ list: async () => [{ id: 'y1', startYear: 2025, isCurrent: false }] }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-prev"]')!.hasAttribute('disabled')).toBe(true);

    el.remove();
  });

  it('clicking academic-year-filter-prev when enabled selects the previous year and reloads cycle-filter', async () => {
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

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-prev"]')!.hasAttribute('disabled')).toBe(false);

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-filter-prev"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-value"]')!.textContent).toContain('2024-2025');
    expect(el.shadowRoot!.querySelector('[data-element-id="cycle-filter"]')!.textContent).toContain('DAM');

    el.remove();
  });

  it('clicking academic-year-filter-next advances the year and reloads cycle-filter', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      academicYear: fakeAcademicYearService({
        list: async () => [
          { id: 'y1', startYear: 2025, isCurrent: false },
          { id: 'y2', startYear: 2026, isCurrent: false },
        ],
        listModules: async (id: string) => (id === 'y2' ? [MODULE_DAM] : [MODULE_DAW]),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-filter-next"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-value"]')!.textContent).toContain('2026-2027');
    expect(el.shadowRoot!.querySelector('[data-element-id="cycle-filter"]')!.textContent).toContain('DAM');

    el.remove();
  });

  it('academic-year-filter-next is disabled once the selected year reaches currentSchoolYearStartYear + 5', async () => {
    const el = await mountView({ today: new Date('2026-08-07T12:00:00Z'), academicYear: fakeAcademicYearService({ list: async () => [] }) });

    for (let i = 0; i < 5; i += 1) {
      el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-filter-next"]')!.click();
      await tick();
    }

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-value"]')!.textContent).toContain('2030-2031');
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-filter-next"]')!.hasAttribute('disabled')).toBe(true);

    el.remove();
  });

  it('selecting a future year with no academic_years row shows calendario-empty-state', async () => {
    const el = await mountView({ today: new Date('2026-08-07T12:00:00Z'), academicYear: fakeAcademicYearService({ list: async () => [] }) });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-filter-next"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-empty-state"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-months"]')).toBeNull();

    el.remove();
  });
});

describe('elementId: cycle-filter, module-filter', () => {
  it('cycle-filter lists distinct cycles, first selected by default, deriving module-filter', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
    });

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="cycle-filter"]')!;
    expect(cycleSelect.querySelectorAll('option')).toHaveLength(2);
    expect(cycleSelect.value).toBe('c1');

    const moduleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-filter"]')!;
    expect(moduleSelect.textContent).toContain('Programación');
    expect(moduleSelect.value).toBe('am1');

    el.remove();
  });

  it('changing cycle-filter re-derives module-filter to that cycle´s módulos only', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
    });

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="cycle-filter"]')!;
    cycleSelect.value = 'c2';
    cycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const moduleFilterText = el.shadowRoot!.querySelector('[data-element-id="module-filter"]')!.textContent!;
    expect(moduleFilterText).toContain('Bases de datos');
    expect(moduleFilterText).not.toContain('Programación');

    el.remove();
  });
});

describe('elementId: calendario-months, calendario-empty-state', () => {
  it('renders exactly 10 month cards, September of the selected year through June of the next', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-22', endDate: '2026-01-07' }],
      }),
    });

    const months = el.shadowRoot!.querySelectorAll('[data-element-id^="calendario-month-"]:not([data-element-id*="-day-"])');
    expect(months).toHaveLength(10);
    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2026-06"]')).not.toBeNull();

    el.remove();
  });

  it('colors every day of a <=30-day range, including both boundary days', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-22', endDate: '2026-01-07' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2025-12', '22')).toBe('holidays');
    expect(dayCategories(el, 'calendario-month-2025-12', '25')).toBe('holidays');
    expect(dayCategories(el, 'calendario-month-2026-01', '07')).toBe('holidays');
    expect(dayCategories(el, 'calendario-month-2025-12', '20')).toBeNull();

    el.remove();
  });

  it('colors only the start and end day of a >30-day range, not the days in between', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-01', endDate: '2026-07-31' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2025-09', '01')).toBe('academic_key_dates');
    expect(dayCategories(el, 'calendario-month-2025-10', '15')).toBeNull();
    expect(dayCategories(el, 'calendario-month-2026-06', '15')).toBeNull();

    el.remove();
  });

  it('a day covered only by an evaluations/feoe_project_days range is colored blue (category-tagged)', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'evaluations', name: 'Sesión de evaluación.', startDate: '2026-03-01', endDate: '2026-03-01' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2026-03', '01')).toBe('evaluations');

    el.remove();
  });

  it('a day covered by both a red and a blue category shows both categories', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'public_holidays', name: 'Festivo.', startDate: '2026-03-01', endDate: '2026-03-01' },
          { id: 'cm2', category: 'evaluations', name: 'Evaluación.', startDate: '2026-03-01', endDate: '2026-03-01' },
        ],
      }),
    });

    const categories = dayCategories(el, 'calendario-month-2026-03', '01')!.split(',');
    expect(categories).toContain('public_holidays');
    expect(categories).toContain('evaluations');

    el.remove();
  });

  it('shows calendario-empty-state instead of calendario-months when the módulo has no calendario_modulo rows', async () => {
    const el = await mountView({ today: new Date('2026-08-07T12:00:00Z'), calendarioModulo: fakeCalendarioModuloService({ findForModule: async () => [] }) });

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-empty-state"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-months"]')).toBeNull();

    el.remove();
  });

  it('changing module-filter reloads the calendar for the newly selected academic_year_module_id', async () => {
    const calls: string[] = [];
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async (id: string) => {
          calls.push(id);
          return [];
        },
      }),
    });
    calls.length = 0;

    const moduleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-filter"]')!;
    const options = el.shadowRoot!.querySelectorAll<HTMLOptionElement>('[data-element-id="module-filter"] option');
    moduleSelect.value = options[options.length - 1]!.value;
    moduleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(calls).toHaveLength(1);

    el.remove();
  });
});

describe('elementId: calendario-day-toast', () => {
  it('hovering a marked day shows calendario-day-toast with its event name', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-25', endDate: '2025-12-25' }],
      }),
    });

    el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-12-day-25"]')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-day-toast"]')!.textContent).toContain('Vacaciones de Navidad.');

    el.remove();
  });

  it('shows every applicable event name when a day has more than one entry', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'public_holidays', name: 'Festivo.', startDate: '2026-03-01', endDate: '2026-03-01' },
          { id: 'cm2', category: 'evaluations', name: 'Evaluación.', startDate: '2026-03-01', endDate: '2026-03-01' },
        ],
      }),
    });

    el.shadowRoot!.querySelector('[data-element-id="calendario-month-2026-03-day-01"]')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await tick();

    const toastText = el.shadowRoot!.querySelector('[data-element-id="calendario-day-toast"]')!.textContent!;
    expect(toastText).toContain('Festivo.');
    expect(toastText).toContain('Evaluación.');

    el.remove();
  });

  it('leaving a marked day dismisses calendario-day-toast immediately', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-25', endDate: '2025-12-25' }],
      }),
    });

    const day = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-12-day-25"]')!;
    day.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await tick();
    day.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-day-toast"]')).toBeNull();

    el.remove();
  });
});

describe('unauthenticated', () => {
  it('redirects to /login when there is no valid session', async () => {
    const el = document.createElement('app-calendario-view') as CalendarioView;
    el.sessionService = { getSession: async () => ({ authenticated: false }), logout: async () => {} };
    el.academicYearService = fakeAcademicYearService();
    el.calendarioModuloService = fakeCalendarioModuloService();
    document.body.appendChild(el);
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-heading"]')).toBeNull();

    el.remove();
  });
});
