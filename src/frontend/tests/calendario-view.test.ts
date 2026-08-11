// elementId: calendario-heading, back-to-dashboard-link, academic-year-filter-prev,
// academic-year-filter-value, academic-year-filter-next, cycle-filter, module-filter,
// calendario-months, calendario-empty-state, calendario-day-tooltip, calendario-legend
// (see views/calendario/use-cases.md UC-01..UC-05, UC-10, UC-11). Read-only screen —
// renders exclusively from calendario_modulo (via calendarioModuloService), never
// key_dates directly.
//
// calendario-day-tooltip (2026-08-10) replaces the earlier calendario-day-toast: a pure
// Tailwind `group`/`group-hover:block` CSS tooltip, always present in the DOM for a
// covered day (absent entirely for an uncovered one) rather than a JS-driven element
// toggled by mouseover/mouseout — real `:hover` reveal is Cypress's job (happy-dom has no
// real `:hover` state), this only pins DOM presence/absence, content and the Tailwind
// classes the reveal mechanism depends on.
//
// Testing seam: `today` is a settable property (defaults to `new Date()`) so
// currentSchoolYearStartYear (month >= 9 -> current calendar year, else -> current calendar
// year - 1) is deterministic in tests instead of depending on the real wall-clock date —
// same setter-injection style the project already uses for services, applied to make a
// date-dependent pure computation testable.
//
// Day cells carry `data-calendario-day-categories` (comma-joined category names covering
// that day, e.g. "holidays" or "evaluations,feoe_project_days") as the test hook for the
// category-resolution logic; the exact color per (category,type) pair (UC-11's table,
// 2026-08-10) is asserted directly against the `style` attribute's hex, since that table is
// the single source of truth both calendario-months and calendario-legend read from.
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
  type: string | null;
}

interface CalendarioModuloApiService {
  findForModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]>;
}

interface EvaluationWorkingDaysEntry {
  evaluationNumber: number;
  workingDays: number;
}

interface EvaluationWorkingDaysApiService {
  findForModule(academicYearModuleId: string): Promise<EvaluationWorkingDaysEntry[]>;
}

interface CalendarioHorarioEntry {
  date: string;
  hours: number;
}

interface CalendarioHorarioApiService {
  findForModule(academicYearModuleId: string): Promise<CalendarioHorarioEntry[]>;
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

function fakeEvaluationWorkingDaysService(overrides: Partial<EvaluationWorkingDaysApiService> = {}): EvaluationWorkingDaysApiService {
  return {
    findForModule: async () => [],
    ...overrides,
  };
}

function fakeCalendarioHorarioService(overrides: Partial<CalendarioHorarioApiService> = {}): CalendarioHorarioApiService {
  return {
    findForModule: async () => [],
    ...overrides,
  };
}

async function mountView(overrides?: {
  academicYear?: AcademicYearApiService;
  calendarioModulo?: CalendarioModuloApiService;
  evaluationWorkingDays?: EvaluationWorkingDaysApiService;
  calendarioHorario?: CalendarioHorarioApiService;
  today?: Date;
}): Promise<CalendarioView> {
  const el = document.createElement('app-calendario-view') as CalendarioView;
  el.sessionService = fakeSessionService();
  el.academicYearService = overrides?.academicYear ?? fakeAcademicYearService();
  el.calendarioModuloService = overrides?.calendarioModulo ?? fakeCalendarioModuloService();
  el.evaluationWorkingDaysService = overrides?.evaluationWorkingDays ?? fakeEvaluationWorkingDaysService();
  el.calendarioHorarioService = overrides?.calendarioHorario ?? fakeCalendarioHorarioService();
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

function dayStyle(el: CalendarioView, monthId: string, day: string): string | null {
  return el.shadowRoot!.querySelector(`[data-element-id="${monthId}-day-${day}"]`)?.getAttribute('style') ?? null;
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

describe('elementId: evaluation-working-days-summary', () => {
  it('renders one line per evaluationNumber present, exact text, in a column at the far right', async () => {
    const el = await mountView({
      evaluationWorkingDays: fakeEvaluationWorkingDaysService({
        findForModule: async () => [
          { evaluationNumber: 1, workingDays: 56 },
          { evaluationNumber: 2, workingDays: 121 },
        ],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-1"]')!.textContent).toBe('Días laborables 1ª evaluación: 56');
    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-2"]')!.textContent).toBe('Días laborables 2ª evaluación: 121');
    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-3"]')).toBeNull();

    el.remove();
  });

  it('renders all three lines when all three evaluaciones have data', async () => {
    const el = await mountView({
      evaluationWorkingDays: fakeEvaluationWorkingDaysService({
        findForModule: async () => [
          { evaluationNumber: 1, workingDays: 56 },
          { evaluationNumber: 2, workingDays: 121 },
          { evaluationNumber: 3, workingDays: 186 },
        ],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-3"]')!.textContent).toBe('Días laborables 3ª evaluación: 186');

    el.remove();
  });

  it('renders no lines at all when the selected módulo has zero calendario_evaluation_working_days rows', async () => {
    const el = await mountView({
      evaluationWorkingDays: fakeEvaluationWorkingDaysService({ findForModule: async () => [] }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-1"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-2"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-3"]')).toBeNull();

    el.remove();
  });

  it('changing module-filter reloads the summary for the newly selected academic_year_module_id', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
      evaluationWorkingDays: fakeEvaluationWorkingDaysService({
        findForModule: async (academicYearModuleId: string) =>
          academicYearModuleId === 'am2' ? [{ evaluationNumber: 1, workingDays: 30 }] : [{ evaluationNumber: 1, workingDays: 56 }],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-1"]')!.textContent).toBe('Días laborables 1ª evaluación: 56');

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="cycle-filter"]')!;
    cycleSelect.value = 'c2';
    cycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="evaluation-working-days-1"]')!.textContent).toBe('Días laborables 1ª evaluación: 30');

    el.remove();
  });
});

describe('elementId: calendario-months, calendario-empty-state', () => {
  it('renders exactly 10 month cards, September of the selected year through June of the next', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-22', endDate: '2026-01-07', type: null }],
      }),
    });

    const months = el.shadowRoot!.querySelectorAll('[data-element-id^="calendario-month-"]:not([data-element-id*="-day-"])');
    expect(months).toHaveLength(10);
    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2026-06"]')).not.toBeNull();

    el.remove();
  });

  it('colors every day of a <=30-day range, including both boundary days, using the entry´s (category,type) color', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-22', endDate: '2026-01-07', type: 'Vacaciones' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2025-12', '22')).toBe('holidays');
    expect(dayCategories(el, 'calendario-month-2025-12', '25')).toBe('holidays');
    expect(dayCategories(el, 'calendario-month-2026-01', '07')).toBe('holidays');
    expect(dayCategories(el, 'calendario-month-2025-12', '20')).toBeNull();
    expect(dayStyle(el, 'calendario-month-2025-12', '22')).toContain('#eda100');
    expect(dayStyle(el, 'calendario-month-2025-12', '25')).toContain('#eda100');
    expect(dayStyle(el, 'calendario-month-2026-01', '07')).toContain('#eda100');

    el.remove();
  });

  it('colors only the start and end day of a >30-day range, not the days in between', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-01', endDate: '2026-07-31', type: 'Curso escolar' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2025-09', '01')).toBe('academic_key_dates');
    expect(dayCategories(el, 'calendario-month-2025-10', '15')).toBeNull();
    expect(dayCategories(el, 'calendario-month-2026-06', '15')).toBeNull();
    expect(dayStyle(el, 'calendario-month-2025-09', '01')).toContain('#2a78d6');

    el.remove();
  });

  it('a day covered by more than one entry at once shows a split background (one band per (category,type))', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'public_holidays', name: 'Festivo.', startDate: '2026-03-01', endDate: '2026-03-01', type: 'Festivo nacional' },
          { id: 'cm2', category: 'evaluations', name: 'Evaluación.', startDate: '2026-03-01', endDate: '2026-03-01', type: 'Último dia para poner nota' },
        ],
      }),
    });

    const categories = dayCategories(el, 'calendario-month-2026-03', '01')!.split(',');
    expect(categories).toContain('public_holidays');
    expect(categories).toContain('evaluations');
    const style = dayStyle(el, 'calendario-month-2026-03', '01')!;
    expect(style).toContain('linear-gradient');
    expect(style).toContain('#eb6834');
    expect(style).toContain('#e87ba4');

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

describe('elementId: calendario-months (per-(category,type) color table — UC-11, 2026-08-10)', () => {
  it('colors each (category,type) pair per UC-11´s canonical table, across every category family', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' },
          { id: 'cm2', category: 'academic_key_dates', name: 'Presentación de proyectos.', startDate: '2025-09-03', endDate: '2025-09-03', type: 'Presentación de proyectos' },
          { id: 'cm3', category: 'holidays', name: 'Vacaciones.', startDate: '2025-10-05', endDate: '2025-10-05', type: 'Vacaciones' },
          { id: 'cm4', category: 'public_holidays', name: 'Festivo nacional.', startDate: '2025-10-06', endDate: '2025-10-06', type: 'Festivo nacional' },
          { id: 'cm5', category: 'public_holidays', name: 'Festivo autonómico.', startDate: '2025-10-07', endDate: '2025-10-07', type: 'Festivo autonómico' },
          { id: 'cm6', category: 'free_disposal_days', name: 'Libre disposición.', startDate: '2025-11-10', endDate: '2025-11-10', type: 'Libre disposición' },
          { id: 'cm7', category: 'evaluations', name: '1ª Evaluación - Último día para poner notas.', startDate: '2025-11-11', endDate: '2025-11-11', type: 'Último dia para poner nota' },
          { id: 'cm8', category: 'evaluations', name: 'Sesión de evaluación.', startDate: '2025-11-12', endDate: '2025-11-12', type: 'Sesión evaluación' },
          { id: 'cm9', category: 'feoe_project_days', name: 'Día de alternancia.', startDate: '2025-11-13', endDate: '2025-11-13', type: 'Día de alternancia' },
          { id: 'cm10', category: 'final_exams', name: '1ª Evaluación - Examen final.', startDate: '2025-12-01', endDate: '2025-12-01', type: null },
          { id: 'cm11', category: 'final_exams', name: '1ª Evaluación - Examen de recuperación final.', startDate: '2025-12-02', endDate: '2025-12-02', type: null },
        ],
      }),
    });

    const expectations: Array<[string, string, string]> = [
      ['calendario-month-2025-09', '02', '#2a78d6'],
      ['calendario-month-2025-09', '03', '#75a7e4'],
      ['calendario-month-2025-10', '05', '#eda100'],
      ['calendario-month-2025-10', '06', '#eb6834'],
      ['calendario-month-2025-10', '07', '#ef8961'],
      ['calendario-month-2025-11', '10', '#1baf7a'],
      ['calendario-month-2025-11', '11', '#e87ba4'],
      ['calendario-month-2025-11', '12', '#ee9cbb'],
      ['calendario-month-2025-11', '13', '#4a3aa7'],
      ['calendario-month-2025-12', '01', '#008300'],
      ['calendario-month-2025-12', '02', '#59ae59'],
    ];
    for (const [monthId, day, hex] of expectations) {
      expect(dayStyle(el, monthId, day)).toContain(hex);
    }

    el.remove();
  });

  it('a (category,type) pair not in UC-11´s table falls back to that category´s own row-1 hex, distinct from other types in the same category', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'public_holidays', name: 'Festivo inventado.', startDate: '2025-10-08', endDate: '2025-10-08', type: 'Tipo que no existe' },
          { id: 'cm2', category: 'public_holidays', name: 'Festivo autonómico.', startDate: '2025-10-07', endDate: '2025-10-07', type: 'Festivo autonómico' },
        ],
      }),
    });

    expect(dayStyle(el, 'calendario-month-2025-10', '08')).toContain('#eb6834');
    expect(dayStyle(el, 'calendario-month-2025-10', '07')).toContain('#ef8961');

    el.remove();
  });

  it('a plain Saturday/Sunday with no calendario_modulo entry is colored neutral gray', async () => {
    // 2025-12-06/07 is a Saturday/Sunday not covered by the fixture's one entry (which
    // starts on the 22nd) — an unrelated entry keeps calendario-months rendered instead of
    // calendario-empty-state.
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-22', endDate: '2026-01-07', type: 'Vacaciones' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2025-12', '06')).toBeNull();
    expect(dayStyle(el, 'calendario-month-2025-12', '06')).toContain('#cbd5e1');
    expect(dayStyle(el, 'calendario-month-2025-12', '07')).toContain('#cbd5e1');

    el.remove();
  });

  it('a Saturday/Sunday covered by an entry is colored that entry´s real color, not darkened and not gray', async () => {
    // 2025-12-07 is a Sunday.
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'public_holidays', name: 'Festivo de fin de semana.', startDate: '2025-12-07', endDate: '2025-12-07', type: 'Festivo nacional' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2025-12', '07')).toBe('public_holidays');
    expect(dayStyle(el, 'calendario-month-2025-12', '07')).toContain('#eb6834');
    expect(dayStyle(el, 'calendario-month-2025-12', '07')).not.toContain('#cbd5e1');
    expect(dayStyle(el, 'calendario-month-2025-12', '07')).not.toContain('#b91c1c');

    el.remove();
  });

  it('a Saturday covered by an evaluations entry is colored that entry´s real color, not gray', async () => {
    // 2026-03-07 is a Saturday.
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'evaluations', name: 'Sesión de evaluación de sábado.', startDate: '2026-03-07', endDate: '2026-03-07', type: 'Último dia para poner nota' },
        ],
      }),
    });

    expect(dayCategories(el, 'calendario-month-2026-03', '07')).toBe('evaluations');
    expect(dayStyle(el, 'calendario-month-2026-03', '07')).toContain('#e87ba4');
    expect(dayStyle(el, 'calendario-month-2026-03', '07')).not.toContain('#cbd5e1');

    el.remove();
  });
});

describe('elementId: calendario-day-tooltip (UC-05, 2026-08-10)', () => {
  it('renders a tooltip child with the exact event name for a marked day', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-25', endDate: '2025-12-25', type: 'Vacaciones' }],
      }),
    });

    const tooltip = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-12-day-25-tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain('Vacaciones de Navidad.');

    el.remove();
  });

  it('lists every applicable event name, one per line, when a day has more than one entry', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'public_holidays', name: 'Festivo.', startDate: '2026-03-01', endDate: '2026-03-01', type: 'Festivo nacional' },
          { id: 'cm2', category: 'evaluations', name: 'Evaluación.', startDate: '2026-03-01', endDate: '2026-03-01', type: 'Último dia para poner nota' },
        ],
      }),
    });

    const tooltipText = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2026-03-day-01-tooltip"]')!.textContent!;
    expect(tooltipText).toContain('Festivo.');
    expect(tooltipText).toContain('Evaluación.');

    el.remove();
  });

  it('renders no tooltip node at all for a day with no covering calendario_modulo entry (A1)', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-25', endDate: '2025-12-25', type: 'Vacaciones' }],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-12-day-20-tooltip"]')).toBeNull();

    el.remove();
  });

  it('is positioned to the right of its day cell via Tailwind group/group-hover classes, never a fixed screen corner', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-12-25', endDate: '2025-12-25', type: 'Vacaciones' }],
      }),
    });

    const dayCell = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-12-day-25"]')!;
    const tooltip = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-12-day-25-tooltip"]')!;

    expect(dayCell.className).toContain('group');
    expect(dayCell.className).toContain('relative');
    expect(tooltip.className).toContain('hidden');
    expect(tooltip.className).toContain('group-hover:block');
    expect(tooltip.className).toContain('absolute');
    expect(tooltip.className).toContain('left-full');
    expect(tooltip.className).not.toContain('fixed');

    el.remove();
  });
});

describe('elementId: calendario-legend (UC-11, 2026-08-10)', () => {
  it('renders one swatch+label per color-table row present, in the table´s canonical order regardless of data order', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        // Fed out of canonical order (13, 1, 9, 4) — legend must still render 1, 4, 9, 13.
        findForModule: async () => [
          { id: 'cm1', category: 'final_exams', name: '1ª Evaluación - Examen final.', startDate: '2025-12-01', endDate: '2025-12-01', type: null },
          { id: 'cm2', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' },
          { id: 'cm3', category: 'evaluations', name: '1ª Evaluación - Último día para poner notas.', startDate: '2025-11-11', endDate: '2025-11-11', type: 'Último dia para poner nota' },
          { id: 'cm4', category: 'public_holidays', name: 'Festivo.', startDate: '2025-10-06', endDate: '2025-10-06', type: 'Festivo nacional' },
        ],
      }),
    });

    const items = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-element-id^="calendario-legend-item-"]')];
    expect(items.map((item) => item.dataset.elementId)).toEqual([
      'calendario-legend-item-1',
      'calendario-legend-item-4',
      'calendario-legend-item-9',
      'calendario-legend-item-13',
    ]);
    expect(items[0]!.textContent).toContain('Curso escolar');
    expect(items[1]!.textContent).toContain('Festivo nacional');
    expect(items[2]!.textContent).toContain('Último día para poner notas');
    expect(items[3]!.textContent).toContain('Examen final');

    el.remove();
  });

  it('shows exactly one swatch per color-table row even when several entries match it', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' },
          { id: 'cm2', category: 'academic_key_dates', name: 'Curso escolar (bis)', startDate: '2026-06-30', endDate: '2026-06-30', type: 'Curso escolar' },
        ],
      }),
    });

    const items = el.shadowRoot!.querySelectorAll('[data-element-id^="calendario-legend-item-"]');
    expect(items).toHaveLength(1);

    el.remove();
  });

  it('a módulo with zero calendario_modulo rows renders no legend swatches at all', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({ findForModule: async () => [] }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-legend"]')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('[data-element-id^="calendario-legend-item-"]')).toHaveLength(0);

    el.remove();
  });

  it('a módulo missing some color-table rows´ data shows only the rows it has, no placeholder for absent ones', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'free_disposal_days', name: 'Libre disposición.', startDate: '2025-11-10', endDate: '2025-11-10', type: 'Libre disposición' },
        ],
      }),
    });

    const items = el.shadowRoot!.querySelectorAll('[data-element-id^="calendario-legend-item-"]');
    expect(items).toHaveLength(1);
    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-legend-item-8"]')).not.toBeNull();

    el.remove();
  });

  it('each swatch´s color exactly matches calendario-months´s color for that same (category,type)', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' },
        ],
      }),
    });

    const dayColor = dayStyle(el, 'calendario-month-2025-09', '02');
    const legendItem = el.shadowRoot!.querySelector('[data-element-id="calendario-legend-item-1"]')!;

    expect(dayColor).toContain('#2a78d6');
    expect(legendItem.getAttribute('style')).toContain('#2a78d6');

    el.remove();
  });

  it('calendario-legend renders directly below the filters row, laid out horizontally with wrapping, never scrolling', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [
          { id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' },
        ],
      }),
    });

    const legend = el.shadowRoot!.querySelector('[data-element-id="calendario-legend"]')!;
    expect(legend.className).toContain('flex');
    expect(legend.className).toContain('flex-wrap');

    el.remove();
  });
});

describe('elementId: calendario-months, calendario-day-tooltip, calendario-legend (Horario overlay — UC-12/UC-13, 2026-08-11)', () => {
  it('a day covered by a calendario_horario entry carries data-calendario-horario="true" and a #06b6d4 ring', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioHorario: fakeCalendarioHorarioService({ findForModule: async () => [{ date: '2025-09-08', hours: 2 }] }),
    });

    const dayCell = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-08"]')!;
    expect(dayCell.getAttribute('data-calendario-horario')).toBe('true');
    expect(dayCell.outerHTML).toContain('#06b6d4');

    el.remove();
  });

  it('a day with no calendario_horario entry has no data-calendario-horario attribute', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioHorario: fakeCalendarioHorarioService({ findForModule: async () => [{ date: '2025-09-08', hours: 2 }] }),
    });

    const dayCell = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-09"]')!;
    expect(dayCell.getAttribute('data-calendario-horario')).toBeNull();

    el.remove();
  });

  it('the ring renders together with an existing (category,type) fill on the same day, not replacing it', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-09-08', endDate: '2025-09-08', type: 'Vacaciones' }],
      }),
      calendarioHorario: fakeCalendarioHorarioService({ findForModule: async () => [{ date: '2025-09-08', hours: 2 }] }),
    });

    const dayCell = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-08"]')!;
    expect(dayCell.getAttribute('data-calendario-horario')).toBe('true');
    expect(dayStyle(el, 'calendario-month-2025-09', '08')).toContain('#eda100');
    expect(dayCell.outerHTML).toContain('#06b6d4');

    el.remove();
  });

  it('a day with only a calendario_horario entry (no calendario_modulo) still renders a calendario-day-tooltip, with just the Horario line', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioHorario: fakeCalendarioHorarioService({ findForModule: async () => [{ date: '2025-09-08', hours: 2 }] }),
    });

    const tooltip = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-08-tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain('Horario: 2 horas');

    el.remove();
  });

  it('a day with both a calendario_modulo entry and a calendario_horario entry lists the event name(s) first, "Horario: N horas" last', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2025-09-08', endDate: '2025-09-08', type: 'Vacaciones' }],
      }),
      calendarioHorario: fakeCalendarioHorarioService({ findForModule: async () => [{ date: '2025-09-08', hours: 3 }] }),
    });

    const tooltipText = el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-08-tooltip"]')!.textContent!;
    const eventIndex = tooltipText.indexOf('Vacaciones de Navidad.');
    const horarioIndex = tooltipText.indexOf('Horario: 3 horas');
    expect(eventIndex).toBeGreaterThanOrEqual(0);
    expect(horarioIndex).toBeGreaterThan(eventIndex);

    el.remove();
  });

  it('a day with no calendario_modulo entry and no calendario_horario entry has no tooltip node at all', async () => {
    const el = await mountView({ today: new Date('2026-08-07T12:00:00Z') });

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-08-tooltip"]')).toBeNull();

    el.remove();
  });

  it('calendario-legend shows a "Horario" item, last, when the módulo has at least one calendario_horario row', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' }],
      }),
      calendarioHorario: fakeCalendarioHorarioService({ findForModule: async () => [{ date: '2025-09-08', hours: 2 }] }),
    });

    const items = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-element-id^="calendario-legend-item-"]')];
    expect(items.at(-1)!.dataset.elementId).toBe('calendario-legend-item-horario');
    expect(items.at(-1)!.textContent).toContain('Horario');

    el.remove();
  });

  it('calendario-legend shows no "Horario" item when the módulo has zero calendario_horario rows, even with calendario_modulo data', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' }],
      }),
      calendarioHorario: fakeCalendarioHorarioService({ findForModule: async () => [] }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-legend-item-horario"]')).toBeNull();

    el.remove();
  });

  it('changing module-filter reloads the horario overlay for the newly selected módulo', async () => {
    const el = await mountView({
      today: new Date('2026-08-07T12:00:00Z'),
      academicYear: fakeAcademicYearService({ listModules: async () => [MODULE_DAW, MODULE_DAM] }),
      calendarioModulo: fakeCalendarioModuloService({
        findForModule: async () => [{ id: 'cm1', category: 'academic_key_dates', name: 'Curso escolar', startDate: '2025-09-02', endDate: '2025-09-02', type: 'Curso escolar' }],
      }),
      calendarioHorario: fakeCalendarioHorarioService({
        findForModule: async (academicYearModuleId: string) =>
          academicYearModuleId === 'am2' ? [{ date: '2025-09-08', hours: 1 }] : [],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-08"]')!.getAttribute('data-calendario-horario')).toBeNull();

    const cycleSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="cycle-filter"]')!;
    cycleSelect.value = 'c2';
    cycleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="calendario-month-2025-09-day-08"]')!.getAttribute('data-calendario-horario')).toBe('true');

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
