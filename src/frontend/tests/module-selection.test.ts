// elementId: module-selection-table, module-selection-save-button (see
// views/configuracion/use-cases.md UC-07). Same component as
// academic-year-settings-view.test.ts (app-academic-year-settings-view) — see that file's
// header comment for the shared inline-edit-row convention (not used by this table, which
// has checkboxes instead: `module-selection-table-row-<moduleId>-checkbox`).
import { describe, it, expect } from 'bun:test';
import '../src/academic-year-settings-view';
import type { AcademicYearSettingsView } from '../src/academic-year-settings-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

type WriteResult<T> = { outcome: 'success'; value: T } | { outcome: 'not-found' } | { outcome: 'duplicate-name' };

interface AcademicYearApiService {
  list(): Promise<{ id: string; name: string; isCurrent: boolean }[]>;
  create(name: string): Promise<WriteResult<{ id: string; name: string; isCurrent: boolean }>>;
  rename(id: string, name: string): Promise<WriteResult<{ id: string; name: string; isCurrent: boolean }>>;
  setCurrent(id: string): Promise<WriteResult<{ id: string; name: string; isCurrent: boolean }>>;
  remove(id: string): Promise<{ outcome: 'success' } | { outcome: 'not-found' } | { outcome: 'is-current' }>;
  getSelection(id: string): Promise<string[]>;
  replaceSelection(id: string, moduleIds: string[]): Promise<{ outcome: 'success' } | { outcome: 'not-found' }>;
}

interface TrainingCycle {
  id: string;
  name: string;
}
interface TrainingCycleApiService {
  list(): Promise<TrainingCycle[]>;
  create(name: string): Promise<WriteResult<TrainingCycle>>;
  rename(id: string, name: string): Promise<WriteResult<TrainingCycle>>;
  remove(id: string): Promise<{ outcome: 'success' } | { outcome: 'not-found' } | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] }>;
}

interface ModuleRecord {
  id: string;
  trainingCycleId: string;
  course: number;
  name: string;
}
interface ModuleApiService {
  listForCycle(cycleId: string): Promise<ModuleRecord[]>;
  listAll(): Promise<(ModuleRecord & { trainingCycleName: string })[]>;
  create(cycleId: string, name: string, course: number): Promise<WriteResult<ModuleRecord>>;
  update(
    id: string,
    changes: { name?: string; course?: number },
    confirm?: boolean
  ): Promise<
    | { outcome: 'success'; value: ModuleRecord }
    | { outcome: 'not-found' }
    | { outcome: 'duplicate-name' }
    | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] }
  >;
  remove(id: string): Promise<{ outcome: 'success' } | { outcome: 'not-found' } | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] }>;
}

function fakeSessionService(): SessionApiService {
  return { getSession: async () => ({ authenticated: true, fullName: 'Ana García' }), logout: async () => {} };
}

function fakeAcademicYearService(overrides: Partial<AcademicYearApiService> = {}): AcademicYearApiService {
  return {
    list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
    create: async (name) => ({ outcome: 'success', value: { id: 'x', name, isCurrent: false } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name, isCurrent: false } }),
    setCurrent: async (id) => ({ outcome: 'success', value: { id, name: 'X', isCurrent: true } }),
    remove: async () => ({ outcome: 'success' }),
    getSelection: async () => [],
    replaceSelection: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

function fakeTrainingCycleService(): TrainingCycleApiService {
  return {
    list: async () => [{ id: 'c1', name: 'DAW' }],
    create: async (name) => ({ outcome: 'success', value: { id: 'new-cycle', name } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name } }),
    remove: async () => ({ outcome: 'success' }),
  };
}

function fakeModuleService(overrides: Partial<ModuleApiService> = {}): ModuleApiService {
  return {
    listForCycle: async () => [],
    listAll: async () => [
      { id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación', trainingCycleName: 'DAW' },
      { id: 'm2', trainingCycleId: 'c1', course: 2, name: 'Bases de Datos', trainingCycleName: 'DAW' },
    ],
    create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm-new', trainingCycleId: cycleId, course, name } }),
    update: async (id, changes) => ({ outcome: 'success', value: { id, trainingCycleId: 'c1', course: 1, name: 'X', ...changes } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

async function mountView(academicYear?: AcademicYearApiService, module?: ModuleApiService): Promise<AcademicYearSettingsView> {
  const el = document.createElement('app-academic-year-settings-view') as AcademicYearSettingsView;
  el.sessionService = fakeSessionService();
  el.academicYearService = academicYear ?? fakeAcademicYearService();
  el.trainingCycleService = fakeTrainingCycleService();
  el.moduleService = module ?? fakeModuleService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: module-selection-table', () => {
  it('prompts to pick an academic year when none is selected', async () => {
    const el = await mountView(fakeAcademicYearService({ list: async () => [] }));

    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')!.textContent).toBeTruthy();
    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-table-row-m1"]')).toBeNull();

    el.remove();
  });

  it('selecting an academic year shows every module with its saved selection state checked', async () => {
    const el = await mountView(
      fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        getSelection: async () => ['m1'],
      }),
      fakeModuleService(),
    );

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const checkedBox = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="module-selection-table-row-m1-checkbox"]',
    )!;
    const uncheckedBox = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="module-selection-table-row-m2-checkbox"]',
    )!;

    expect(checkedBox.checked).toBe(true);
    expect(uncheckedBox.checked).toBe(false);

    el.remove();
  });

  it('toggling a checkbox does not call replaceSelection by itself', async () => {
    let called = false;
    const el = await mountView(
      fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        replaceSelection: async () => {
          called = true;
          return { outcome: 'success' };
        },
      }),
    );
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(called).toBe(false);

    el.remove();
  });
});

describe('elementId: module-selection-save-button', () => {
  it('is disabled while no academic year is selected', async () => {
    const el = await mountView(fakeAcademicYearService({ list: async () => [] }));

    expect(
      el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="module-selection-save-button"]')!.disabled,
    ).toBe(true);

    el.remove();
  });

  it('saving persists exactly the checked module ids for the selected academic year', async () => {
    const calls: { savedWith: [string, string[]] | null } = { savedWith: null };
    const el = await mountView(
      fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        replaceSelection: async (id, moduleIds) => {
          calls.savedWith = [id, moduleIds];
          return { outcome: 'success' };
        },
      }),
    );
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
      .click();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.savedWith).toEqual(['ay1', ['m1']]);

    el.remove();
  });
});
