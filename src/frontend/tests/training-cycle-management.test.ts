// elementId: training-cycle-table, training-cycle-table-add-button,
// training-cycle-delete-blocked-message (see views/configuracion/use-cases.md UC-05,
// rewritten 2026-07-30 for the three-mode redesign). Same component as
// academic-year-settings-view.test.ts (app-academic-year-settings-view) — see that file's
// header comment for the shared inline-edit-row convention.
//
// Three modes (see functional-spec.json's appOverview): normal mode shows only the cycles
// with >=1 module selected for the selected academic year (derived, never a stored
// relation — `academicYearService.listTrainingCyclesForYear`); adding-year mode
// (academic-year-table-add-button) and adding-cycle mode (saving
// training-cycle-table-add-button's draft while an academic year is already selected) both
// show the teacher's complete, unfiltered cycle list instead (`trainingCycleService.list`).
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
    create: async (name) => ({ outcome: 'success', value: { id: 'x', name, isCurrent: false } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name, isCurrent: false } }),
    setCurrent: async (id) => ({ outcome: 'success', value: { id, name: 'X', isCurrent: true } }),
    remove: async () => ({ outcome: 'success' }),
    getSelection: async () => [],
    replaceSelection: async () => ({ outcome: 'success' }),
    listTrainingCyclesForYear: async () => [],
    listModulesForYearAndCycle: async () => [],
    ...overrides,
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

function fakeModuleService(overrides: Partial<ModuleApiService> = {}): ModuleApiService {
  return {
    listForCycle: async () => [],
    listAll: async () => [],
    create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm', trainingCycleId: cycleId, course, name } }),
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

describe('elementId: training-cycle-table — normal mode (year-filtered)', () => {
  it("shows only the cycles the selected academic year's listTrainingCyclesForYear returns", async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async (id) => (id === 'ay1' ? [{ id: 'c1', name: 'DAW' }] : []),
      }),
      trainingCycle: fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'SMR' }] }),
    });

    expect((el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')) === null).toBe(false);
    expect((el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c2"]')) === null).toBe(true);

    el.remove();
  });

  it('selects the first cycle by default and reloads module-table via listModulesForYearAndCycle', async () => {
    const calls: { requested: [string, string] | null } = { requested: null };
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async () => [{ id: 'c1', name: 'DAW' }],
        listModulesForYearAndCycle: async (yearId, cycleId) => {
          calls.requested = [yearId, cycleId];
          return [{ id: 'm1', trainingCycleId: cycleId, course: 1, name: 'Programación' }];
        },
      }),
    });

    expect(calls.requested).toEqual(['ay1', 'c1']);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-table-row-m1"]')) === null).toBe(false);

    el.remove();
  });

  it('selecting a different row reloads module-table for that cycle and the selected year', async () => {
    const calls: { requested: [string, string][] } = { requested: [] };
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'SMR' }],
        listModulesForYearAndCycle: async (yearId, cycleId) => {
          calls.requested.push([yearId, cycleId]);
          return [];
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c2"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.requested[calls.requested.length - 1]).toEqual(['ay1', 'c2']);

    el.remove();
  });

  it('deleting an unreferenced cycle succeeds and it disappears, along with its modules', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async () => [{ id: 'c1', name: 'DAW' }],
      }),
      trainingCycle: fakeTrainingCycleService({ remove: async () => ({ outcome: 'success' }) }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')) === null).toBe(true);

    el.remove();
  });
});

describe('elementId: training-cycle-table-add-button — adding-cycle mode (UC-05 A5)', () => {
  it('saving a new cycle while an academic year is selected selects it and switches module-table off / module-selection-table on', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async () => [],
      }),
      trainingCycle: fakeTrainingCycleService({
        create: async (name) => ({ outcome: 'success', value: { id: 'c-new', name } }),
      }),
      module: fakeModuleService({ listForCycle: async () => [] }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="training-cycle-table-row-new-name"]')!;
    input.value = 'SMR';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="module-table"]')) === null).toBe(true);
    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')) === null).toBe(false);

    el.remove();
  });
});

describe('elementId: training-cycle-table — adding-year/adding-cycle mode (unfiltered)', () => {
  it('adding-year mode shows the complete cycle list instead of the year-filtered one', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async () => [],
      }),
      trainingCycle: fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'SMR' }] }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')) === null).toBe(false);
    expect((el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c2"]')) === null).toBe(false);

    el.remove();
  });

  it('adding-year mode selects the first cycle in the complete list by default', async () => {
    const calls: { listedForCycle: string[] } = { listedForCycle: [] };
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async () => [],
      }),
      trainingCycle: fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'SMR' }] }),
      module: fakeModuleService({
        listForCycle: async (cycleId) => {
          calls.listedForCycle.push(cycleId);
          return [];
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.listedForCycle).toContain('c1');

    el.remove();
  });

  it('selecting a different cycle in adding-year mode swaps module-selection-table without losing checks made under the previous cycle', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        listTrainingCyclesForYear: async () => [],
      }),
      trainingCycle: fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'SMR' }] }),
      module: fakeModuleService({
        listForCycle: async (cycleId) =>
          cycleId === 'c1'
            ? [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }]
            : [{ id: 'm2', trainingCycleId: 'c2', course: 1, name: 'Redes' }],
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c2"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((el.shadowRoot!.querySelector('[data-element-id="module-selection-table-row-m2-checkbox"]')) === null).toBe(false);

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!
        .checked,
    ).toBe(true);

    el.remove();
  });
});

describe('elementId: training-cycle-table (unchanged CRUD, any mode)', () => {
  it('adding a row and saving a unique name calls create()', async () => {
    const calls: { createdName: string | null } = { createdName: null };
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({
        create: async (name) => {
          calls.createdName = name;
          return { outcome: 'success', value: { id: 'c-new', name } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
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
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({
        list: async () => [{ id: 'c1', name: 'DAW' }],
        rename: async () => ({ outcome: 'duplicate-name' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="training-cycle-table-row-c1-name"]')!;
    input.value = 'SMR';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')) === null).toBe(false);

    el.remove();
  });

  it('deleting a cycle referenced by an academic year shows training-cycle-delete-blocked-message naming it', async () => {
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({
        list: async () => [{ id: 'c1', name: 'DAW' }],
        remove: async () => ({ outcome: 'has-dependents', academicYears: [{ id: 'ay1', name: '2026/2027' }] }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const message = el.shadowRoot!.querySelector('[data-element-id="training-cycle-delete-blocked-message"]')!;
    expect(message.textContent).toContain('2026/2027');

    el.remove();
  });
});
