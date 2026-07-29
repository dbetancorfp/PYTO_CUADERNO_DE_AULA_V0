// elementId: module-cycle-select, module-table, module-table-add-button,
// module-delete-blocked-message, module-edit-confirm-modal (see
// views/configuracion/use-cases.md UC-06). Same component as
// academic-year-settings-view.test.ts (app-academic-year-settings-view) — see that file's
// header comment for the shared inline-edit-row convention.
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

function fakeAcademicYearService(): AcademicYearApiService {
  return {
    list: async () => [],
    create: async (name) => ({ outcome: 'success', value: { id: 'x', name, isCurrent: false } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name, isCurrent: false } }),
    setCurrent: async (id) => ({ outcome: 'success', value: { id, name: 'X', isCurrent: true } }),
    remove: async () => ({ outcome: 'success' }),
    getSelection: async () => [],
    replaceSelection: async () => ({ outcome: 'success' }),
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

async function mountView(module?: ModuleApiService, trainingCycle?: TrainingCycleApiService): Promise<AcademicYearSettingsView> {
  const el = document.createElement('app-academic-year-settings-view') as AcademicYearSettingsView;
  el.sessionService = fakeSessionService();
  el.academicYearService = fakeAcademicYearService();
  el.trainingCycleService = trainingCycle ?? fakeTrainingCycleService();
  el.moduleService = module ?? fakeModuleService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: module-cycle-select', () => {
  it('lists the teacher\'s training cycles as options', async () => {
    const el = await mountView(undefined, fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'SMR' }] }));

    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-cycle-select"]')!;

    expect(Array.from(select.options).map((o) => o.value)).toEqual(expect.arrayContaining(['c1', 'c2']));

    el.remove();
  });

  it('choosing a cycle reloads module-table with that cycle\'s modules', async () => {
    const calls: { requestedCycleId: string | null } = { requestedCycleId: null };
    const el = await mountView(
      fakeModuleService({
        listForCycle: async (cycleId) => {
          calls.requestedCycleId = cycleId;
          return [{ id: 'm1', trainingCycleId: cycleId, course: 1, name: 'Programación' }];
        },
      }),
    );

    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-cycle-select"]')!;
    select.value = 'c1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.requestedCycleId).toBe('c1');
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')).not.toBeNull();

    el.remove();
  });
});

describe('elementId: module-table-add-button', () => {
  it('is disabled while no cycle is chosen', async () => {
    const el = await mountView();

    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="module-table-add-button"]')!;

    expect(button.disabled).toBe(true);

    el.remove();
  });

  it('adding a module with a unique (name, course) calls create() with the chosen cycle', async () => {
    const calls: { createdWith: [string, string, number] | null } = { createdWith: null };
    const el = await mountView(
      fakeModuleService({
        create: async (cycleId, name, course) => {
          calls.createdWith = [cycleId, name, course];
          return { outcome: 'success', value: { id: 'm-new', trainingCycleId: cycleId, course, name } };
        },
      }),
    );
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-cycle-select"]')!;
    select.value = 'c1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

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

    el.remove();
  });
});

describe('elementId: module-edit-confirm-modal', () => {
  async function mountWithOneModule(update: ModuleApiService['update']): Promise<AcademicYearSettingsView> {
    const el = await mountView(
      fakeModuleService({
        listForCycle: async () => [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }],
        update,
      }),
    );
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-cycle-select"]')!;
    select.value = 'c1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return el;
  }

  it('is not visible on first load', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')).toBeNull();

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
    expect(modal).not.toBeNull();
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
    expect(el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')).toBeNull();

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
    expect(el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')).toBeNull();

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
    expect(el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')!.textContent).toContain('Programación');
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1-name"]')).toBeNull();

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

    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="module-edit-confirm-modal"]')).toBeNull();
    expect(el.shadowRoot!.textContent).toContain('Ya existe un módulo con ese nombre y curso en este ciclo');

    el.remove();
  });
});

describe('elementId: module-delete-blocked-message', () => {
  it('shows when deleting a module referenced by an academic year', async () => {
    const el = await mountView(
      fakeModuleService({
        listForCycle: async () => [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }],
        remove: async () => ({ outcome: 'has-dependents', academicYears: [{ id: 'ay1', name: '2026/2027' }] }),
      }),
    );
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="module-cycle-select"]')!;
    select.value = 'c1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-m1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="module-delete-blocked-message"]')!.textContent).toContain(
      '2026/2027',
    );

    el.remove();
  });
});
