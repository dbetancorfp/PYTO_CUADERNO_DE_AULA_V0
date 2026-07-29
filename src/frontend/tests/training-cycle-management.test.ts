// elementId: training-cycle-table, training-cycle-table-add-button,
// training-cycle-delete-blocked-message (see views/configuracion/use-cases.md UC-05). Same
// component as academic-year-settings-view.test.ts (app-academic-year-settings-view) — see
// that file's header comment for the shared inline-edit-row convention.
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
type CycleDeleteResult =
  | { outcome: 'success' }
  | { outcome: 'not-found' }
  | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] };
interface TrainingCycleApiService {
  list(): Promise<TrainingCycle[]>;
  create(name: string): Promise<WriteResult<TrainingCycle>>;
  rename(id: string, name: string): Promise<WriteResult<TrainingCycle>>;
  remove(id: string): Promise<CycleDeleteResult>;
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
    list: async () => [],
    create: async (name) => ({ outcome: 'success', value: { id: 'new-cycle', name } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

function fakeModuleService(): ModuleApiService {
  return {
    listForCycle: async () => [],
    listAll: async () => [],
    create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm', trainingCycleId: cycleId, course, name } }),
    update: async (id, changes) => ({ outcome: 'success', value: { id, trainingCycleId: 'c1', course: 1, name: 'X', ...changes } }),
    remove: async () => ({ outcome: 'success' }),
  };
}

async function mountView(
  trainingCycle?: TrainingCycleApiService,
  module?: ModuleApiService,
): Promise<AcademicYearSettingsView> {
  const el = document.createElement('app-academic-year-settings-view') as AcademicYearSettingsView;
  el.sessionService = fakeSessionService();
  el.academicYearService = fakeAcademicYearService();
  el.trainingCycleService = trainingCycle ?? fakeTrainingCycleService();
  el.moduleService = module ?? fakeModuleService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: training-cycle-table', () => {
  it('shows one row per existing training cycle', async () => {
    const el = await mountView(fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }));

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')!.textContent).toContain(
      'DAW',
    );

    el.remove();
  });

  it('adding a row and saving a unique name calls create()', async () => {
    const calls: { createdName: string | null } = { createdName: null };
    const el = await mountView(
      fakeTrainingCycleService({
        create: async (name) => {
          calls.createdName = name;
          return { outcome: 'success', value: { id: 'c-new', name } };
        },
      }),
    );

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="training-cycle-table-row-new-name"]')!;
    input.value = 'DAW';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createdName).toBe('DAW');

    el.remove();
  });

  it('renaming a row to a name that already exists shows an inline error and does not remove the row', async () => {
    const el = await mountView(
      fakeTrainingCycleService({
        list: async () => [{ id: 'c1', name: 'DAW' }],
        rename: async () => ({ outcome: 'duplicate-name' }),
      }),
    );

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="training-cycle-table-row-c1-name"]')!;
    input.value = 'SMR';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')).not.toBeNull();

    el.remove();
  });

  it('deleting a cycle referenced by an academic year shows training-cycle-delete-blocked-message naming it', async () => {
    const el = await mountView(
      fakeTrainingCycleService({
        list: async () => [{ id: 'c1', name: 'DAW' }],
        remove: async () => ({ outcome: 'has-dependents', academicYears: [{ id: 'ay1', name: '2026/2027' }] }),
      }),
    );

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const message = el.shadowRoot!.querySelector('[data-element-id="training-cycle-delete-blocked-message"]')!;
    expect(message.textContent).toContain('2026/2027');

    el.remove();
  });

  it('deleting an unreferenced cycle succeeds and it disappears from the table', async () => {
    const el = await mountView(
      fakeTrainingCycleService({
        list: async () => [{ id: 'c1', name: 'DAW' }],
        remove: async () => ({ outcome: 'success' }),
      }),
    );

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')).toBeNull();

    el.remove();
  });

  it('clicking a row selects that cycle and loads its modules', async () => {
    const calls: { listForCycleId: string | null } = { listForCycleId: null };
    const el = await mountView(
      fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
      { ...fakeModuleService(), listForCycle: async (cycleId) => {
        calls.listForCycleId = cycleId;
        return [];
      } },
    );

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.listForCycleId).toBe('c1');

    el.remove();
  });
});
