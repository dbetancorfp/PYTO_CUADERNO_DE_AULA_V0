// elementId: module-table, module-table-add-button, module-delete-blocked-message,
// module-edit-confirm-modal (see views/configuracion/use-cases.md UC-06, rewritten
// 2026-07-30 for the three-mode redesign). Same component as
// academic-year-settings-view.test.ts (app-academic-year-settings-view) — see that file's
// header comment for the shared inline-edit-row convention.
//
// `module-cycle-select` is removed (functional-spec.json's appOverview) —
// training-cycle-table's own row click is what selects the cycle now; every test below
// selects a cycle by clicking a training-cycle-table row instead of a <select>.
// module-table is normal-mode only: hidden entirely during adding-year/adding-cycle mode
// (module-selection-table takes its place, see module-selection.test.ts).
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
type ModuleUpdateResult =
  | { outcome: 'success'; value: ModuleRecord }
  | { outcome: 'not-found' }
  | { outcome: 'duplicate-name' }
  | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] };
type ModuleDeleteResult =
  | { outcome: 'success' }
  | { outcome: 'not-found' }
  | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] };
interface ModuleApiService {
  listForCycle(cycleId: string): Promise<ModuleRecord[]>;
  listAll(): Promise<(ModuleRecord & { trainingCycleName: string })[]>;
  create(cycleId: string, name: string, course: number): Promise<WriteResult<ModuleRecord>>;
  update(id: string, changes: { name?: string; course?: number }, confirm?: boolean): Promise<ModuleUpdateResult>;
  remove(id: string): Promise<ModuleDeleteResult>;
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
    listTrainingCyclesForYear: async () => [{ id: 'c1', name: 'DAW' }],
    listModulesForYearAndCycle: async () => [],
    ...overrides,
  };
}

function fakeTrainingCycleService(overrides: Partial<TrainingCycleApiService> = {}): TrainingCycleApiService {
  return {
    list: async () => [{ id: 'c1', name: 'DAW' }],
    create: async (name) => ({ outcome: 'success', value: { id: 'new-cycle', name } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

function fakeModuleService(overrides: Partial<ModuleApiService> = {}): ModuleApiService {
  return {
    listForCycle: async () => [],
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

describe('elementId: module-table — visibility and mode', () => {
  it('is hidden while adding-year mode is active', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="module-table"]')) === null).toBe(true);

    el.remove();
  });

  it('is hidden while adding-cycle mode is active', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="training-cycle-table-row-new-name"]')!;
    input.value = 'SMR';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="module-table"]')) === null).toBe(true);

    el.remove();
  });

  it('shows nothing and prompts to pick/create a cycle when no cycle is selected', async () => {
    const el = await mountView({ academicYear: fakeAcademicYearService({ listTrainingCyclesForYear: async () => [] }) });

    expect(el.shadowRoot!.querySelector('[data-element-id="module-table"]')!.textContent).toBeTruthy();
    expect((el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')) === null).toBe(true);

    el.remove();
  });

  it("shows one row per module of the selected cycle that's selected for the selected academic year", async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        listModulesForYearAndCycle: async () => [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')!.textContent).toContain(
      'Programación',
    );

    el.remove();
  });
});

describe('elementId: module-table-add-button', () => {
  it('is disabled while no cycle is selected', async () => {
    const el = await mountView({ academicYear: fakeAcademicYearService({ listTrainingCyclesForYear: async () => [] }) });

    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="module-table-add-button"]')!;

    expect(button.disabled).toBe(true);

    el.remove();
  });

  it('adding a row and saving a unique (name, course) persists it and selects it for the active academic year', async () => {
    const calls: { createdWith: [string, string, number] | null; putWith: [string, string[]] | null } = {
      createdWith: null,
      putWith: null,
    };
    const el = await mountView({
      module: fakeModuleService({
        create: async (cycleId, name, course) => {
          calls.createdWith = [cycleId, name, course];
          return { outcome: 'success', value: { id: 'm-new', trainingCycleId: cycleId, course, name } };
        },
      }),
      academicYear: fakeAcademicYearService({
        replaceSelection: async (id, moduleIds) => {
          calls.putWith = [id, moduleIds];
          return { outcome: 'success' };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-table-row-new-name"]')!;
    nameInput.value = 'Programación';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const courseSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-table-row-new-course"]')!;
    courseSelect.value = '1';
    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createdWith).toEqual(['c1', 'Programación', 1]);
    expect(calls.putWith?.[0]).toBe('ay1');
    expect(calls.putWith?.[1]).toContain('m-new');

    el.remove();
  });
});

describe('elementId: module-edit-confirm-modal', () => {
  async function mountWithOneModule(update: ModuleApiService['update']): Promise<AcademicYearSettingsView> {
    return mountView({
      module: fakeModuleService({
        update,
      }),
      academicYear: fakeAcademicYearService({
        listModulesForYearAndCycle: async () => [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }],
      }),
    });
  }

  it('is not visible on first load', async () => {
    const el = await mountView();

    expect((el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')) === null).toBe(true);

    el.remove();
  });

  it('opens naming the referencing academic year(s) when saving an edit to a referenced module', async () => {
    const el = await mountWithOneModule(async () => ({
      outcome: 'has-dependents',
      academicYears: [{ id: 'ay1', name: '2026/2027' }],
    }));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-table-row-m1-name"]')!;
    nameInput.value = 'Programación II';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const modal = el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]');
    expect((modal) === null).toBe(false);
    expect(modal!.textContent).toContain('2026/2027');

    el.remove();
  });

  it('does not open for an unreferenced module — saves immediately', async () => {
    let updateCalled = false;
    const el = await mountWithOneModule(async (id, changes) => {
      updateCalled = true;
      return { outcome: 'success', value: { id, trainingCycleId: 'c1', course: 1, name: 'Programación', ...changes } };
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-table-row-m1-name"]')!;
    nameInput.value = 'Programación II';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateCalled).toBe(true);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')) === null).toBe(true);

    el.remove();
  });

  it('confirming the modal re-sends the edit with confirm:true and closes it on success', async () => {
    const calls: { updateCalls: [string, { name?: string; course?: number }, boolean | undefined][] } = { updateCalls: [] };
    const el = await mountWithOneModule(async (id, changes, confirm) => {
      calls.updateCalls.push([id, changes, confirm]);
      if (confirm !== true) {
        return { outcome: 'has-dependents', academicYears: [{ id: 'ay1', name: '2026/2027' }] };
      }
      return { outcome: 'success', value: { id, trainingCycleId: 'c1', course: 1, name: 'Programación', ...changes } };
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-table-row-m1-name"]')!;
    nameInput.value = 'Programación II';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-edit-confirm-modal-confirm"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.updateCalls.length).toBe(2);
    expect(calls.updateCalls[1]![2]).toBe(true);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')) === null).toBe(true);

    el.remove();
  });

  it('cancelling the modal does not re-send the edit and reverts the row without saving', async () => {
    let updateCallCount = 0;
    const el = await mountWithOneModule(async () => {
      updateCallCount += 1;
      return { outcome: 'has-dependents', academicYears: [{ id: 'ay1', name: '2026/2027' }] };
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-table-row-m1-name"]')!;
    nameInput.value = 'Programación II';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateCallCount).toBe(1);

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-edit-confirm-modal-cancel"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateCallCount).toBe(1);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')) === null).toBe(true);
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')!.textContent).toContain('Programación');
    expect((el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1-name"]')) === null).toBe(true);

    el.remove();
  });

  it('saving a duplicate (name, course) within the cycle is rejected, no crash', async () => {
    const el = await mountWithOneModule(async () => ({ outcome: 'duplicate-name' }));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-table-row-m1-name"]')!;
    nameInput.value = 'Bases de Datos';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')) === null).toBe(false);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')) === null).toBe(true);
    expect(el.shadowRoot!.textContent).toContain('Ya existe un módulo con ese nombre y curso en este ciclo');

    el.remove();
  });
});

describe('elementId: module-delete-blocked-message', () => {
  it('shows when deleting a module referenced by an academic year', async () => {
    const el = await mountView({
      module: fakeModuleService({
        remove: async () => ({ outcome: 'has-dependents', academicYears: [{ id: 'ay1', name: '2026/2027' }] }),
      }),
      academicYear: fakeAcademicYearService({
        listModulesForYearAndCycle: async () => [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }],
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="module-delete-blocked-message"]')!.textContent).toContain(
      '2026/2027',
    );

    el.remove();
  });

  it('deleting an unreferenced module succeeds and it disappears from the table', async () => {
    const el = await mountView({
      module: fakeModuleService({ remove: async () => ({ outcome: 'success' }) }),
      academicYear: fakeAcademicYearService({
        listModulesForYearAndCycle: async () => [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }],
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')) === null).toBe(true);

    el.remove();
  });
});
