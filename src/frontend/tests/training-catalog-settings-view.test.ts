// elementId: back-to-dashboard-link, teacher-nav-link, training-catalog-nav-link,
// academic-year-nav-link, catalog-training-cycle-table,
// catalog-training-cycle-table-add-button, catalog-module-table,
// catalog-module-table-add-button (see views/configuracion/use-cases.md UC-03/UC-04/UC-05).
// New component (app-training-catalog-settings-view), doesn't exist yet.
//
// Rewritten 2026-08-04 for the full redesign: catalog_cycles/catalog_modules are
// brand-new, standalone tables with no relation to años académicos — there is no
// dependency-blocked deletion and no edit-confirmation modal anywhere in this screen
// (compare the previous version of this file, which had both — both are gone from
// ui-spec.json v4). Deleting a cycle always succeeds, cascading to its modules; editing a
// module always saves immediately. trainingCycleService/moduleService mirror
// api-contracts.md's GET/POST/PATCH/DELETE /api/catalog/training-cycles and
// /api/catalog/training-cycles/:cycleId/modules, /api/catalog/modules/:id exactly — no
// 'has-dependents' outcome exists in either interface anymore. course is 1|2 only (the
// seeded BOC curricula only go up to 2º), not 1|2|3. Same shared inline-edit-row convention
// as lib/patterns/crud-table-component.md.
import { describe, it, expect } from 'bun:test';
import '../src/training-catalog-settings-view';
import type { TrainingCatalogSettingsView } from '../src/training-catalog-settings-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

type WriteResult<T> = { outcome: 'success'; value: T } | { outcome: 'not-found' } | { outcome: 'duplicate-name' };
type DeleteResult = { outcome: 'success' } | { outcome: 'not-found' };

interface TrainingCycle {
  id: string;
  name: string;
}
interface TrainingCycleApiService {
  list(): Promise<TrainingCycle[]>;
  create(name: string): Promise<WriteResult<TrainingCycle>>;
  rename(id: string, name: string): Promise<WriteResult<TrainingCycle>>;
  remove(id: string): Promise<DeleteResult>;
}

interface ModuleRecord {
  id: string;
  catalogTrainingCycleId: string;
  course: number;
  name: string;
}
interface ModuleApiService {
  listForCycle(cycleId: string): Promise<ModuleRecord[]>;
  create(cycleId: string, name: string, course: number): Promise<WriteResult<ModuleRecord>>;
  update(id: string, changes: { name?: string; course?: number }): Promise<WriteResult<ModuleRecord>>;
  remove(id: string): Promise<DeleteResult>;
}

function fakeSessionService(): SessionApiService {
  return { getSession: async () => ({ authenticated: true, fullName: 'Ana García' }), logout: async () => {} };
}

function fakeTrainingCycleService(overrides: Partial<TrainingCycleApiService> = {}): TrainingCycleApiService {
  return {
    list: async () => [{ id: 'c1', name: 'DAW' }],
    create: async (name) => ({ outcome: 'success', value: { id: 'c-new', name } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

function fakeModuleService(overrides: Partial<ModuleApiService> = {}): ModuleApiService {
  return {
    listForCycle: async () => [],
    create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm-new', catalogTrainingCycleId: cycleId, course, name } }),
    update: async (id, changes) => ({ outcome: 'success', value: { id, catalogTrainingCycleId: 'c1', course: 1, name: 'X', ...changes } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

async function mountView(overrides?: {
  trainingCycle?: TrainingCycleApiService;
  module?: ModuleApiService;
}): Promise<TrainingCatalogSettingsView> {
  const el = document.createElement('app-training-catalog-settings-view') as TrainingCatalogSettingsView;
  el.sessionService = fakeSessionService();
  el.trainingCycleService = overrides?.trainingCycle ?? fakeTrainingCycleService();
  el.moduleService = overrides?.module ?? fakeModuleService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: back-to-dashboard-link', () => {
  it('clicking back-to-dashboard-link navigates to /dashboard', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="back-to-dashboard-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/dashboard');

    window.history.pushState({}, '', '/configuracion/ciclos-modulos');
    el.remove();
  });
});

describe('elementId: training-catalog-nav-link, teacher-nav-link, academic-year-nav-link', () => {
  it('training-catalog-nav-link is active and the other two are inactive on this screen', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="training-catalog-nav-link"]')!.getAttribute('aria-current')).toBe('page');
    expect((el.shadowRoot!.querySelector('[data-element-id="teacher-nav-link"]')!.getAttribute('aria-current')) === null).toBe(true);
    expect((el.shadowRoot!.querySelector('[data-element-id="academic-year-nav-link"]')!.getAttribute('aria-current')) === null).toBe(true);

    el.remove();
  });

  it('clicking teacher-nav-link navigates to /configuracion/profesor', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="teacher-nav-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/configuracion/profesor');

    window.history.pushState({}, '', '/configuracion/ciclos-modulos');
    el.remove();
  });

  it('clicking academic-year-nav-link navigates to /configuracion/ano-academico', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-nav-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/configuracion/ano-academico');

    window.history.pushState({}, '', '/configuracion/ciclos-modulos');
    el.remove();
  });
});

describe('elementId: catalog-training-cycle-table (UC-04)', () => {
  it('shows an empty state when the teacher has no training cycles yet', async () => {
    const el = await mountView({ trainingCycle: fakeTrainingCycleService({ list: async () => [] }) });

    expect(el.shadowRoot!.querySelector('[data-element-id="catalog-training-cycle-table"]')!.textContent).toBeTruthy();
    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-training-cycle-table-row-c1"]')) === null).toBe(true);

    el.remove();
  });

  it('shows every training cycle the teacher has created', async () => {
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'DAM' }] }),
    });

    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-training-cycle-table-row-c1"]')) === null).toBe(false);
    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-training-cycle-table-row-c2"]')) === null).toBe(false);

    el.remove();
  });

  it('selects the first cycle by default and loads catalog-module-table via listForCycle', async () => {
    const calls: { requested: string[] } = { requested: [] };
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
      module: fakeModuleService({
        listForCycle: async (cycleId) => {
          calls.requested.push(cycleId);
          return [{ id: 'm1', catalogTrainingCycleId: cycleId, course: 1, name: 'Programación' }];
        },
      }),
    });

    expect(calls.requested).toContain('c1');
    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m1"]')) === null).toBe(false);

    el.remove();
  });

  it('selecting a different row reloads catalog-module-table for that cycle', async () => {
    const calls: { requested: string[] } = { requested: [] };
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'DAM' }] }),
      module: fakeModuleService({
        listForCycle: async (cycleId) => {
          calls.requested.push(cycleId);
          return [];
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-row-c2"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.requested[calls.requested.length - 1]).toBe('c2');

    el.remove();
  });

  it('adding a row and saving a unique name calls create()', async () => {
    const calls: { createdName: string | null } = { createdName: null };
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({
        list: async () => [],
        create: async (name) => {
          calls.createdName = name;
          return { outcome: 'success', value: { id: 'c-new', name } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="catalog-training-cycle-table-row-new-name"]')!;
    input.value = 'DAW';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createdName).toBe('DAW');

    el.remove();
  });

  it('saving a new cycle selects it and reloads catalog-module-table, empty', async () => {
    const calls: { requested: string[] } = { requested: [] };
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({
        list: async () => [],
        create: async (name) => ({ outcome: 'success', value: { id: 'c-new', name } }),
      }),
      module: fakeModuleService({
        listForCycle: async (cycleId) => {
          calls.requested.push(cycleId);
          return [];
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="catalog-training-cycle-table-row-new-name"]')!;
    input.value = 'DAW';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.requested).toContain('c-new');
    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m1"]')) === null).toBe(true);

    el.remove();
  });

  it('renaming a row to a name that already exists shows an inline error and does not remove the row', async () => {
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({
        list: async () => [{ id: 'c1', name: 'DAW' }],
        rename: async () => ({ outcome: 'duplicate-name' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-row-c1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="catalog-training-cycle-table-row-c1-name"]')!;
    input.value = 'DAM';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-row-c1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-training-cycle-table-row-c1"]')) === null).toBe(false);

    el.remove();
  });

  it('deleting a cycle always succeeds and it disappears, even with modules', async () => {
    const el = await mountView({
      trainingCycle: fakeTrainingCycleService({
        list: async () => [{ id: 'c1', name: 'DAW' }],
        remove: async () => ({ outcome: 'success' }),
      }),
      module: fakeModuleService({
        listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }],
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-training-cycle-table-row-c1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-training-cycle-table-row-c1"]')) === null).toBe(true);

    el.remove();
  });
});

describe('elementId: catalog-module-table (UC-05)', () => {
  it('shows nothing and prompts to pick/create a cycle when no cycle is selected', async () => {
    const el = await mountView({ trainingCycle: fakeTrainingCycleService({ list: async () => [] }) });

    expect(el.shadowRoot!.querySelector('[data-element-id="catalog-module-table"]')!.textContent).toBeTruthy();
    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m1"]')) === null).toBe(true);

    el.remove();
  });

  it('shows every module of the selected cycle, grouped by course', async () => {
    const el = await mountView({
      module: fakeModuleService({
        listForCycle: async () => [
          { id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' },
          { id: 'm2', catalogTrainingCycleId: 'c1', course: 2, name: 'Acceso a Datos' },
        ],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m1"]')!.textContent).toContain('Programación');
    expect(el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m2"]')!.textContent).toContain('Acceso a Datos');

    el.remove();
  });

  it('editing a module saves immediately, no modal', async () => {
    let updateCalled = false;
    const el = await mountView({
      module: fakeModuleService({
        listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }],
        update: async (id, changes) => {
          updateCalled = true;
          return { outcome: 'success', value: { id, catalogTrainingCycleId: 'c1', course: 1, name: 'Programación', ...changes } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-row-m1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="catalog-module-table-row-m1-name"]')!;
    nameInput.value = 'Programación II';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-row-m1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateCalled).toBe(true);
    expect(el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m1"]')!.textContent).toContain('Programación II');

    el.remove();
  });

  it('renaming a module to a (name, course) that already exists in the cycle is rejected, no crash', async () => {
    const el = await mountView({
      module: fakeModuleService({
        listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }],
        update: async () => ({ outcome: 'duplicate-name' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-row-m1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="catalog-module-table-row-m1-name"]')!;
    nameInput.value = 'Bases de Datos';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-row-m1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m1"]')) === null).toBe(false);

    el.remove();
  });

  it('deleting a module always succeeds and it disappears from the table', async () => {
    const el = await mountView({
      module: fakeModuleService({
        listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }],
        remove: async () => ({ outcome: 'success' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-row-m1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((el.shadowRoot!.querySelector('[data-element-id="catalog-module-table-row-m1"]')) === null).toBe(true);

    el.remove();
  });
});

describe('elementId: catalog-module-table-add-button', () => {
  it('is disabled while no cycle is selected', async () => {
    const el = await mountView({ trainingCycle: fakeTrainingCycleService({ list: async () => [] }) });

    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="catalog-module-table-add-button"]')!;

    expect(button.disabled).toBe(true);

    el.remove();
  });

  it('adding a row and saving a unique (name, course) persists it, scoped to the selected cycle', async () => {
    const calls: { createdWith: [string, string, number] | null } = { createdWith: null };
    const el = await mountView({
      module: fakeModuleService({
        create: async (cycleId, name, course) => {
          calls.createdWith = [cycleId, name, course];
          return { outcome: 'success', value: { id: 'm-new', catalogTrainingCycleId: cycleId, course, name } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="catalog-module-table-row-new-name"]')!;
    nameInput.value = 'Programación';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const courseSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="catalog-module-table-row-new-course"]')!;
    courseSelect.value = '1';
    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createdWith).toEqual(['c1', 'Programación', 1]);

    el.remove();
  });

  it('saving a duplicate (name, course) within the cycle is rejected, inline error shown', async () => {
    const el = await mountView({
      module: fakeModuleService({
        listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }],
        create: async () => ({ outcome: 'duplicate-name' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const nameInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="catalog-module-table-row-new-name"]')!;
    nameInput.value = 'Programación';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const courseSelect = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-element-id="catalog-module-table-row-new-course"]')!;
    courseSelect.value = '1';
    courseSelect.dispatchEvent(new Event('change', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="catalog-module-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.textContent).toContain('Ya existe un módulo con ese nombre y curso en este ciclo');

    el.remove();
  });
});

describe('elementId: catalog-training-cycle-table, catalog-module-table — unauthenticated', () => {
  it('redirects to /login when the session check responds unauthenticated', async () => {
    const el = document.createElement('app-training-catalog-settings-view') as TrainingCatalogSettingsView;
    el.sessionService = { getSession: async () => ({ authenticated: false }), logout: async () => {} };
    el.trainingCycleService = fakeTrainingCycleService();
    el.moduleService = fakeModuleService();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/login');

    window.history.pushState({}, '', '/configuracion/ciclos-modulos');
    el.remove();
  });
});
