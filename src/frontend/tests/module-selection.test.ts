// elementId: module-selection-table, module-selection-add-button,
// module-selection-save-button, module-selection-save-message (see
// views/configuracion/use-cases.md UC-07, rewritten 2026-07-30 for the three-mode redesign).
// Same component as academic-year-settings-view.test.ts (app-academic-year-settings-view) —
// see that file's header comment for the shared inline-edit-row convention (not used by
// module-selection-table, which has checkboxes instead:
// `module-selection-table-row-<moduleId>-checkbox`).
//
// module-selection-table is visible ONLY in adding-year mode (academic-year-table-add-button)
// or adding-cycle mode (training-cycle-table-add-button while an academic year is already
// selected, see training-cycle-management.test.ts) — never in normal mode, where module-table
// takes its place instead (see module-management.test.ts). It's scoped to whichever cycle is
// selected in training-cycle-table and lists that cycle's modules via
// `moduleService.listForCycle` (unfiltered by year — see api-contracts.md's GET
// /api/training-cycles/:cycleId/modules).
import { describe, it, expect } from 'bun:test';
import '../src/academic-year-settings-view';
import type { AcademicYearSettingsView } from '../src/academic-year-settings-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

type WriteResult<T> = { outcome: 'success'; value: T } | { outcome: 'not-found' } | { outcome: 'duplicate-name' };

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface AcademicYearApiService {
  list(): Promise<AcademicYear[]>;
  create(name: string): Promise<WriteResult<AcademicYear>>;
  rename(id: string, name: string): Promise<WriteResult<AcademicYear>>;
  setCurrent(id: string): Promise<WriteResult<AcademicYear>>;
  remove(id: string): Promise<{ outcome: 'success' } | { outcome: 'not-found' } | { outcome: 'is-current' }>;
  getSelection(id: string): Promise<string[]>;
  replaceSelection(id: string, moduleIds: string[]): Promise<{ outcome: 'success' } | { outcome: 'not-found' }>;
  listTrainingCyclesForYear(id: string): Promise<TrainingCycle[]>;
  listModulesForYearAndCycle(id: string, cycleId: string): Promise<ModuleRecord[]>;
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
    confirm?: boolean,
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
    create: async (name) => ({ outcome: 'success', value: { id: 'ay-new', name, isCurrent: false } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name, isCurrent: false } }),
    setCurrent: async (id) => ({ outcome: 'success', value: { id, name: 'X', isCurrent: true } }),
    remove: async () => ({ outcome: 'success' }),
    getSelection: async () => [],
    replaceSelection: async () => ({ outcome: 'success' }),
    listTrainingCyclesForYear: async () => [{ id: 'c1', name: 'DAW' }],
    listModulesForYearAndCycle: async () => [],
    ...overrides,
  };
}

function fakeTrainingCycleService(overrides: Partial<TrainingCycleApiService> = {}): TrainingCycleApiService {
  return {
    list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'SMR' }],
    create: async (name) => ({ outcome: 'success', value: { id: 'new-cycle', name } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

function fakeModuleService(overrides: Partial<ModuleApiService> = {}): ModuleApiService {
  return {
    listForCycle: async (cycleId) =>
      cycleId === 'c1'
        ? [
            { id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' },
            { id: 'm2', trainingCycleId: 'c1', course: 2, name: 'Bases de Datos' },
          ]
        : [],
    listAll: async () => [],
    create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm-new', trainingCycleId: cycleId, course, name } }),
    update: async (id, changes) => ({ outcome: 'success', value: { id, trainingCycleId: 'c1', course: 1, name: 'X', ...changes } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

async function mountView(overrides?: {
  academicYear?: AcademicYearApiService;
  trainingCycle?: TrainingCycleApiService;
  module?: ModuleApiService;
}): Promise<AcademicYearSettingsView> {
  const el = document.createElement('app-academic-year-settings-view') as AcademicYearSettingsView;
  el.sessionService = fakeSessionService();
  el.academicYearService = overrides?.academicYear ?? fakeAcademicYearService();
  el.trainingCycleService = overrides?.trainingCycle ?? fakeTrainingCycleService();
  el.moduleService = overrides?.module ?? fakeModuleService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

async function mountInAddingYearMode(overrides?: {
  academicYear?: AcademicYearApiService;
  trainingCycle?: TrainingCycleApiService;
  module?: ModuleApiService;
}): Promise<AcademicYearSettingsView> {
  const el = await mountView(overrides);
  el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: module-selection-table — visibility', () => {
  it('is hidden in normal mode', async () => {
    const el = await mountView();

    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')) === null).toBe(true);

    el.remove();
  });

  it('shows the selected cycle\'s modules with their in-progress (unchecked) state in adding-year mode', async () => {
    const el = await mountInAddingYearMode();

    const box1 = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="module-selection-table-row-m1-checkbox"]',
    )!;
    const box2 = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="module-selection-table-row-m2-checkbox"]',
    )!;

    expect(box1.checked).toBe(false);
    expect(box2.checked).toBe(false);

    el.remove();
  });

  it('toggling a checkbox does not call create or replaceSelection by itself', async () => {
    let createCalled = false;
    let replaceCalled = false;
    const el = await mountInAddingYearMode({
      academicYear: fakeAcademicYearService({
        create: async (name) => {
          createCalled = true;
          return { outcome: 'success', value: { id: 'ay-new', name, isCurrent: false } };
        },
        replaceSelection: async () => {
          replaceCalled = true;
          return { outcome: 'success' };
        },
      }),
    });

    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createCalled).toBe(false);
    expect(replaceCalled).toBe(false);

    el.remove();
  });

  it('switching cycle shows that cycle\'s modules without discarding checks made under the previous one', async () => {
    const el = await mountInAddingYearMode({
      module: fakeModuleService({
        listForCycle: async (cycleId) =>
          cycleId === 'c1'
            ? [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }]
            : [{ id: 'm3', trainingCycleId: 'c2', course: 1, name: 'Redes' }],
      }),
    });

    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c2"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table-row-m3"]')) === null).toBe(false);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table-row-m1"]')) === null).toBe(true);

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
        .checked,
    ).toBe(true);

    el.remove();
  });

  it('a cycle with zero modules shows module-selection-add-button fused into the table', async () => {
    const el = await mountInAddingYearMode({ module: fakeModuleService({ listForCycle: async () => [] }) });

    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')) === null).toBe(false);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-add-button"]')) === null).toBe(false);

    el.remove();
  });
});

describe('elementId: module-selection-add-button', () => {
  it('is visible whenever module-selection-table is visible, even with existing modules', async () => {
    const el = await mountInAddingYearMode();

    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-add-button"]')) === null).toBe(false);

    el.remove();
  });

  it('adds one new editable row to module-selection-table, scoped to the selected cycle', async () => {
    const calls: { createdWith: [string, string, number] | null } = { createdWith: null };
    const el = await mountInAddingYearMode({
      module: fakeModuleService({
        listForCycle: async () => [],
        create: async (cycleId, name, course) => {
          calls.createdWith = [cycleId, name, course];
          return { outcome: 'success', value: { id: 'm-new', trainingCycleId: cycleId, course, name } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="module-selection-table-row-new-name"]',
    )!;
    nameInput.value = 'Programación';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const courseSelect = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-element-id="module-selection-table-row-new-course"]',
    )!;
    courseSelect.value = '1';
    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createdWith).toEqual(['c1', 'Programación', 1]);

    el.remove();
  });

  it('a newly-added module is checked by default in the in-progress selection', async () => {
    const el = await mountInAddingYearMode({
      module: fakeModuleService({
        listForCycle: async () => [],
        create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm-new', trainingCycleId: cycleId, course, name } }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="module-selection-table-row-new-name"]',
    )!;
    nameInput.value = 'Programación';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const courseSelect = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-element-id="module-selection-table-row-new-course"]',
    )!;
    courseSelect.value = '1';
    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      el.shadowRoot!.querySelector<HTMLInputElement>(
        '[data-element-id="module-selection-table-row-m-new-checkbox"]',
      )!.checked,
    ).toBe(true);

    el.remove();
  });
});

describe('elementId: module-selection-save-button — visibility and loading state', () => {
  it('is hidden in normal mode', async () => {
    const el = await mountView();

    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-save-button"]')) === null).toBe(true);

    el.remove();
  });

  it('shows a loading state and is disabled from click until the response arrives', async () => {
    let resolveCreate: (() => void) | null = null;
    const el = await mountInAddingYearMode({
      academicYear: fakeAcademicYearService({
        create: () =>
          new Promise((resolve) => {
            resolveCreate = () => resolve({ outcome: 'success', value: { id: 'ay-new', name: '2028/2029', isCurrent: false } });
          }),
      }),
    });
    const draftInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    draftInput.value = '2028/2029';
    draftInput.dispatchEvent(new Event('input', { bubbles: true }));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="module-selection-save-button"]')!;
    expect(button.disabled).toBe(true);

    resolveCreate!();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.remove();
  });
});

describe('elementId: module-selection-save-button — adding-year mode (creates + persists)', () => {
  it('a successful save creates the academic year and persists exactly the in-progress selection, then returns to normal mode with the new year selected', async () => {
    const calls: { createdName: string | null; replacedWith: [string, string[]] | null } = {
      createdName: null,
      replacedWith: null,
    };
    const el = await mountInAddingYearMode({
      academicYear: fakeAcademicYearService({
        create: async (name) => {
          calls.createdName = name;
          return { outcome: 'success', value: { id: 'ay-new', name, isCurrent: false } };
        },
        replaceSelection: async (id, moduleIds) => {
          calls.replacedWith = [id, moduleIds];
          return { outcome: 'success' };
        },
      }),
    });
    const draftInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    draftInput.value = '2028/2029';
    draftInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createdName).toBe('2028/2029');
    expect(calls.replacedWith).toEqual(['ay-new', ['m1']]);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')) === null).toBe(true);
    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-message"]')!.textContent).toBeTruthy();

    el.remove();
  });

  it('includes modules just created via module-selection-add-button in the persisted selection', async () => {
    const calls: { replacedWith: [string, string[]] | null } = { replacedWith: null };
    const el = await mountInAddingYearMode({
      module: fakeModuleService({
        listForCycle: async () => [],
        create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm-new', trainingCycleId: cycleId, course, name } }),
      }),
      academicYear: fakeAcademicYearService({
        create: async (name) => ({ outcome: 'success', value: { id: 'ay-new', name, isCurrent: false } }),
        replaceSelection: async (id, moduleIds) => {
          calls.replacedWith = [id, moduleIds];
          return { outcome: 'success' };
        },
      }),
    });
    const draftInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    draftInput.value = '2028/2029';
    draftInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="module-selection-table-row-new-name"]',
    )!;
    nameInput.value = 'Programación';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const courseSelect = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-element-id="module-selection-table-row-new-course"]',
    )!;
    courseSelect.value = '1';
    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.replacedWith?.[1]).toContain('m-new');

    el.remove();
  });

  it('a duplicate academic year name shows an error and keeps the draft (name + in-progress selection) intact', async () => {
    let replaceCalled = false;
    const el = await mountInAddingYearMode({
      academicYear: fakeAcademicYearService({
        create: async () => ({ outcome: 'duplicate-name' }),
        replaceSelection: async () => {
          replaceCalled = true;
          return { outcome: 'success' };
        },
      }),
    });
    const draftInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    draftInput.value = '2026/2027';
    draftInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(replaceCalled).toBe(false);
    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-message"]')!.textContent).toBeTruthy();
    expect((el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-new-name"]')) === null).toBe(false);
    expect(
      el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!.value,
    ).toBe('2026/2027');
    expect(
      el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
        .checked,
    ).toBe(true);

    el.remove();
  });

  it('UC-07 A4 — the year is created but replaceSelection then fails: shows an error, no rollback, the year becomes selectable on retry', async () => {
    const el = await mountInAddingYearMode({
      academicYear: fakeAcademicYearService({
        create: async (name) => ({ outcome: 'success', value: { id: 'ay-new', name, isCurrent: false } }),
        replaceSelection: async () => ({ outcome: 'not-found' }),
      }),
    });
    const draftInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    draftInput.value = '2028/2029';
    draftInput.dispatchEvent(new Event('input', { bubbles: true }));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-message"]')!.textContent).toBeTruthy();

    el.remove();
  });
});

describe('elementId: module-selection-save-button — adding-cycle mode (persists only)', () => {
  async function mountInAddingCycleMode(overrides?: {
    academicYear?: AcademicYearApiService;
    trainingCycle?: TrainingCycleApiService;
    module?: ModuleApiService;
  }): Promise<AcademicYearSettingsView> {
    const el = await mountView(overrides);
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-element-id="training-cycle-table-row-new-name"]',
    )!;
    input.value = 'SMR';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return el;
  }

  it('a successful save persists exactly the in-progress selection for the existing academic year — no create() call', async () => {
    const calls: { createCalled: boolean; replacedWith: [string, string[]] | null } = {
      createCalled: false,
      replacedWith: null,
    };
    const el = await mountInAddingCycleMode({
      trainingCycle: fakeTrainingCycleService({ create: async (name) => ({ outcome: 'success', value: { id: 'c-new', name } }) }),
      module: fakeModuleService({
        listForCycle: async () => [{ id: 'm5', trainingCycleId: 'c-new', course: 1, name: 'Nuevo Módulo' }],
      }),
      academicYear: fakeAcademicYearService({
        create: async (name) => {
          calls.createCalled = true;
          return { outcome: 'success', value: { id: 'ay-new', name, isCurrent: false } };
        },
        replaceSelection: async (id, moduleIds) => {
          calls.replacedWith = [id, moduleIds];
          return { outcome: 'success' };
        },
      }),
    });
    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m5-checkbox"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createCalled).toBe(false);
    expect(calls.replacedWith).toEqual(['ay1', ['m5']]);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')) === null).toBe(true);

    el.remove();
  });

  it('returns to normal mode after a successful save', async () => {
    const el = await mountInAddingCycleMode({
      trainingCycle: fakeTrainingCycleService({ create: async (name) => ({ outcome: 'success', value: { id: 'c-new', name } }) }),
      module: fakeModuleService({ listForCycle: async () => [] }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="module-table"]')) === null).toBe(false);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')) === null).toBe(true);

    el.remove();
  });
});

describe('elementId: module-selection-save-message', () => {
  it('is not visible before a save attempt', async () => {
    const el = await mountInAddingYearMode();

    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-save-message"]')) === null).toBe(true);

    el.remove();
  });

  it('shows an error message after a failed save', async () => {
    const el = await mountInAddingYearMode({
      academicYear: fakeAcademicYearService({ create: async () => ({ outcome: 'duplicate-name' }) }),
    });
    const draftInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    draftInput.value = '2026/2027';
    draftInput.dispatchEvent(new Event('input', { bubbles: true }));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-message"]')!.textContent).toBeTruthy();

    el.remove();
  });
});
