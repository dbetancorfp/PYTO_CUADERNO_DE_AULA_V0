// elementId: back-to-dashboard-link, teacher-nav-link, training-catalog-nav-link,
// academic-year-nav-link, academic-year-table, academic-year-table-add-button,
// training-cycle-table-add-cycle-button, training-cycle-table, module-table,
// module-selection-table, module-selection-save-button, module-selection-save-message,
// academic-year-toast (see views/configuracion/use-cases.md UC-03/UC-06/UC-07/UC-08/UC-09).
//
// Rewritten 2026-08-05: this screen gets a real backend again. academic_years/
// academic_year_modules are per-teacher (academicYearService below); the cycle/módulo
// picker in adding mode reuses the SAME CatalogTrainingCycleApiService/CatalogModuleApiService
// interfaces that back Ciclos/Módulos (catalogCycleService/catalogModuleService below) — no
// duplicate catalog-browsing service, matching api-contracts.md's "reuses the existing,
// unscoped GET /api/catalog/training-cycles..." note. No more creating/editing catalog
// cycles/módulos from this screen (training-cycle-table-add-button, module-table-add-button,
// module-edit-confirm-modal, *-delete-blocked-message, module-selection-add-button are all
// gone — compare the previous, local-state-only version of this file). Same shared
// inline-edit-row convention as lib/patterns/crud-table-component.md
// (`<tableId>-row-<id>[-<action>]`).
import { describe, it, expect } from 'bun:test';
import '../src/academic-year-settings-view';
import type { AcademicYearSettingsView } from '../src/academic-year-settings-view';
import type { CatalogTrainingCycle, CatalogTrainingCycleApiService } from '../src/catalog-training-cycle-api-service';
import type { CatalogModuleApiService, CatalogModuleRecord } from '../src/catalog-module-api-service';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

type WriteResult<T> = { outcome: 'success'; value: T } | { outcome: 'not-found' } | { outcome: 'duplicate-name' };
type DeleteHasDependentsResult = { outcome: 'success' } | { outcome: 'not-found' } | { outcome: 'has-dependents' };
type DeleteResult = { outcome: 'success' } | { outcome: 'not-found' };

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

type CreateSelectionResult =
  | { outcome: 'success'; value: { academicYear: AcademicYear; moduleCount: number } }
  | { outcome: 'not-found' }
  | { outcome: 'duplicate-name' };

type ExtendSelectionResult = { outcome: 'success'; value: { addedCount: number } } | { outcome: 'not-found' };

interface AcademicYearApiService {
  list(): Promise<AcademicYear[]>;
  update(id: string, changes: { startYear?: number; isCurrent?: boolean }): Promise<WriteResult<AcademicYear>>;
  remove(id: string): Promise<DeleteHasDependentsResult>;
  listModules(id: string): Promise<AcademicYearModuleDetail[]>;
  createWithSelection(startYear: number, moduleIds: string[]): Promise<CreateSelectionResult>;
  extendSelection(id: string, moduleIds: string[]): Promise<ExtendSelectionResult>;
  removeModule(academicYearModuleId: string): Promise<DeleteResult>;
}

function fakeSessionService(): SessionApiService {
  return { getSession: async () => ({ authenticated: true, fullName: 'Ana García' }), logout: async () => {} };
}

function fakeAcademicYearService(overrides: Partial<AcademicYearApiService> = {}): AcademicYearApiService {
  return {
    list: async () => [],
    update: async (id, changes) => ({ outcome: 'success', value: { id, startYear: 2026, isCurrent: false, ...changes } }),
    remove: async () => ({ outcome: 'success' }),
    listModules: async () => [],
    createWithSelection: async (startYear) => ({
      outcome: 'success',
      value: { academicYear: { id: 'y-new', startYear, isCurrent: false }, moduleCount: 0 },
    }),
    extendSelection: async () => ({ outcome: 'success', value: { addedCount: 0 } }),
    removeModule: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

function fakeCatalogCycleService(overrides: Partial<CatalogTrainingCycleApiService> = {}): CatalogTrainingCycleApiService {
  return {
    list: async () => [],
    create: async (name) => ({ outcome: 'success', value: { id: 'c-new', name } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

function fakeCatalogModuleService(overrides: Partial<CatalogModuleApiService> = {}): CatalogModuleApiService {
  return {
    listForCycle: async () => [],
    create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'm-new', catalogTrainingCycleId: cycleId, course, name } }),
    update: async (id, changes) => ({ outcome: 'success', value: { id, catalogTrainingCycleId: 'c1', course: 1, name: 'X', ...changes } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

async function mountView(overrides?: {
  academicYear?: AcademicYearApiService;
  catalogCycle?: CatalogTrainingCycleApiService;
  catalogModule?: CatalogModuleApiService;
}): Promise<AcademicYearSettingsView> {
  const el = document.createElement('app-academic-year-settings-view') as AcademicYearSettingsView;
  el.sessionService = fakeSessionService();
  el.academicYearService = overrides?.academicYear ?? fakeAcademicYearService();
  el.catalogCycleService = overrides?.catalogCycle ?? fakeCatalogCycleService();
  el.catalogModuleService = overrides?.catalogModule ?? fakeCatalogModuleService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('elementId: back-to-dashboard-link', () => {
  it('clicking back-to-dashboard-link navigates to /dashboard', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="back-to-dashboard-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/dashboard');

    window.history.pushState({}, '', '/configuracion/ano-academico');
    el.remove();
  });
});

describe('elementId: training-catalog-nav-link, teacher-nav-link, academic-year-nav-link', () => {
  it('academic-year-nav-link is active and the other two are inactive on this screen', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-nav-link"]')!.getAttribute('aria-current')).toBe('page');
    expect(el.shadowRoot!.querySelector('[data-element-id="teacher-nav-link"]')!.getAttribute('aria-current')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="training-catalog-nav-link"]')!.getAttribute('aria-current')).toBeNull();

    el.remove();
  });

  it('clicking teacher-nav-link navigates to /configuracion/profesor', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="teacher-nav-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/configuracion/profesor');

    window.history.pushState({}, '', '/configuracion/ano-academico');
    el.remove();
  });

  it('clicking training-catalog-nav-link navigates to /configuracion/ciclos-modulos', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-catalog-nav-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/configuracion/ciclos-modulos');

    window.history.pushState({}, '', '/configuracion/ano-academico');
    el.remove();
  });
});

describe('elementId: academic-year-table (UC-06)', () => {
  it('shows an empty state when the teacher has no academic years yet', async () => {
    const el = await mountView({ academicYear: fakeAcademicYearService({ list: async () => [] }) });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table"]')!.textContent).toBeTruthy();
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y1"]')).toBeNull();

    el.remove();
  });

  it('shows every academic year, displayed as "<start>-<start+1>"', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ list: async () => [{ id: 'y1', startYear: 2026, isCurrent: true }] }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y1"]')!.textContent).toContain('2026-2027');

    el.remove();
  });

  it('auto-selects the current academic year on load, without any click', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [
          { id: 'y1', startYear: 2025, isCurrent: false },
          { id: 'y2', startYear: 2026, isCurrent: true },
        ],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y2"]')!.className).toContain('bg-slate-100');
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y1"]')!.className).not.toContain('bg-slate-100');

    el.remove();
  });

  it('auto-selects the first academic year on load when none is marked current', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [
          { id: 'y1', startYear: 2025, isCurrent: false },
          { id: 'y2', startYear: 2026, isCurrent: false },
        ],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y1"]')!.className).toContain('bg-slate-100');

    el.remove();
  });

  it('selecting a row loads its assigned módulos and reloads training-cycle-table/module-table', async () => {
    const calls: string[] = [];
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        listModules: async (id) => {
          calls.push(id);
          return [
            { id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW', course: 1, name: 'Programación' },
          ];
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1"]')!.click();
    await tick();

    expect(calls).toContain('y1');
    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')).not.toBeNull();

    el.remove();
  });

  it('row Editar with a unique start year calls update() with the new startYear', async () => {
    const calls: { id: string; startYear?: number }[] = [];
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        update: async (id, changes) => {
          calls.push({ id, startYear: changes.startYear });
          return { outcome: 'success', value: { id, startYear: changes.startYear ?? 2026, isCurrent: false } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1-edit"]')!.click();
    await tick();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-y1-name"]')!;
    input.value = '2027';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1-save"]')!.click();
    await tick();

    expect(calls).toEqual([{ id: 'y1', startYear: 2027 }]);

    el.remove();
  });

  it('row Editar with a duplicate start year shows academic-year-toast and keeps the row editable', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        update: async () => ({ outcome: 'duplicate-name' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1-edit"]')!.click();
    await tick();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-y1-name"]')!;
    input.value = '2030';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1-save"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-toast"]')!.textContent).toBeTruthy();
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y1-name"]')).not.toBeNull();

    el.remove();
  });

  it('row "Marcar en curso" calls update() with isCurrent: true', async () => {
    const calls: { id: string; isCurrent?: boolean }[] = [];
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        update: async (id, changes) => {
          calls.push({ id, isCurrent: changes.isCurrent });
          return { outcome: 'success', value: { id, startYear: 2026, isCurrent: changes.isCurrent ?? false } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1-set-current"]')!.click();
    await tick();

    expect(calls).toEqual([{ id: 'y1', isCurrent: true }]);

    el.remove();
  });

  it('row Eliminar with no módulos assigned removes the row', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        remove: async () => ({ outcome: 'success' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1-delete"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y1"]')).toBeNull();

    el.remove();
  });

  it('row Eliminar blocked by assigned módulos shows academic-year-toast and the row stays', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        remove: async () => ({ outcome: 'has-dependents' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1-delete"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-toast"]')!.textContent).toBeTruthy();
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-y1"]')).not.toBeNull();

    el.remove();
  });
});

describe('elementId: academic-year-table-add-button (UC-06 A4)', () => {
  it('clicking it adds a draft row to academic-year-table', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-new-name"]')).not.toBeNull();

    el.remove();
  });

  it('clicking it switches training-cycle-table to show every catalog cycle with a checkbox', async () => {
    const el = await mountView({
      catalogCycle: fakeCatalogCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }, { id: 'c2', name: 'DAM' }] }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1-checkbox"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c2-checkbox"]')).not.toBeNull();

    el.remove();
  });
});

describe('elementId: academic-year-table-row-new-cancel (UC-06 A5)', () => {
  it('discards the draft row and in-progress selection, returning to normal mode', async () => {
    const el = await mountView({
      catalogCycle: fakeCatalogCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
      catalogModule: fakeCatalogModuleService({ listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }] }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-checkbox"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-new-cancel"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-new-name"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-button"]')).toBeNull();

    el.remove();
  });
});

describe('elementId: training-cycle-table-add-cycle-button (UC-06 A6)', () => {
  it('is hidden when no academic year is selected', async () => {
    const el = await mountView({ academicYear: fakeAcademicYearService({ list: async () => [] }) });

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-add-cycle-button"]')).toBeNull();

    el.remove();
  });

  it('clicking it, with an existing year selected, switches to adding mode without a new draft row', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({ list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }] }),
      catalogCycle: fakeCatalogCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-add-cycle-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1-checkbox"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-new-name"]')).toBeNull();

    el.remove();
  });
});

describe('elementId: training-cycle-table (UC-07)', () => {
  it('normal mode shows only cycles derived from the selected year\'s assigned módulos', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        listModules: async () => [
          { id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW', course: 1, name: 'Programación' },
        ],
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')!.textContent).toContain('DAW');

    el.remove();
  });

  it('auto-selects the first cycle derived from the year\'s módulos, without clicking it', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: true }],
        listModules: async () => [
          { id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW', course: 1, name: 'Programación' },
          { id: 'am2', catalogModuleId: 'm2', catalogTrainingCycleId: 'c2', catalogTrainingCycleName: 'DAM', course: 1, name: 'Base de datos' },
        ],
      }),
    });
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')!.className).toContain('bg-slate-100');
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-am1"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-am2"]')).toBeNull();

    el.remove();
  });

  it('checking a cycle in adding mode loads its módulos into module-selection-table', async () => {
    const calls: string[] = [];
    const el = await mountView({
      catalogCycle: fakeCatalogCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
      catalogModule: fakeCatalogModuleService({
        listForCycle: async (cycleId) => {
          calls.push(cycleId);
          return [{ id: 'm1', catalogTrainingCycleId: cycleId, course: 1, name: 'Programación' }];
        },
      }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-checkbox"]')!.click();
    await tick();

    expect(calls).toContain('c1');
    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-table-row-m1"]')).not.toBeNull();

    el.remove();
  });

  it('selecting a row in normal mode filters module-table to that cycle', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        listModules: async () => [
          { id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW', course: 1, name: 'Programación' },
          { id: 'am2', catalogModuleId: 'm2', catalogTrainingCycleId: 'c2', catalogTrainingCycleName: 'DAM', course: 1, name: 'Base de datos' },
        ],
      }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-am1"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-am2"]')).toBeNull();

    el.remove();
  });

  it('Eliminar shows academic-year-toast blocking deletion while the cycle still has módulos assigned', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        listModules: async () => [
          { id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW', course: 1, name: 'Programación' },
        ],
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-delete"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-toast"]')!.textContent).toContain('módulos');
    expect(el.shadowRoot!.querySelector('[data-element-id="training-cycle-table-row-c1"]')).not.toBeNull();

    el.remove();
  });
});

describe('elementId: module-table (UC-08)', () => {
  it('is hidden while adding mode is active', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="module-table"]')).toBeNull();

    el.remove();
  });

  it('Quitar removes the assignment via academicYearService.removeModule', async () => {
    const calls: string[] = [];
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        listModules: async () => [
          { id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW', course: 1, name: 'Programación' },
        ],
        removeModule: async (id) => {
          calls.push(id);
          return { outcome: 'success' };
        },
      }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-table-row-am1-delete"]')!.click();
    await tick();

    expect(calls).toEqual(['am1']);
    expect(el.shadowRoot!.querySelector('[data-element-id="module-table-row-am1"]')).toBeNull();

    el.remove();
  });
});

describe('elementId: module-selection-table (UC-09)', () => {
  it('is hidden in normal mode', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-table"]')).toBeNull();

    el.remove();
  });

  it('toggling a checkbox does not persist anything by itself', async () => {
    const calls: string[] = [];
    const el = await mountView({
      catalogCycle: fakeCatalogCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
      catalogModule: fakeCatalogModuleService({ listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }] }),
      academicYear: fakeAcademicYearService({
        createWithSelection: async (startYear, moduleIds) => {
          calls.push(...moduleIds);
          return { outcome: 'success', value: { academicYear: { id: 'y-new', startYear, isCurrent: false }, moduleCount: moduleIds.length } };
        },
      }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-checkbox"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!.click();
    await tick();

    expect(calls).toEqual([]);

    el.remove();
  });
});

describe('elementId: module-selection-save-button (UC-09)', () => {
  it('is hidden in normal mode', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-button"]')).toBeNull();

    el.remove();
  });

  it('new-year flow: click persists the draft year and every checked módulo via createWithSelection', async () => {
    const calls: { startYear: number; moduleIds: string[] }[] = [];
    const el = await mountView({
      catalogCycle: fakeCatalogCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
      catalogModule: fakeCatalogModuleService({ listForCycle: async () => [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }] }),
      academicYear: fakeAcademicYearService({
        createWithSelection: async (startYear, moduleIds) => {
          calls.push({ startYear, moduleIds });
          return { outcome: 'success', value: { academicYear: { id: 'y-new', startYear, isCurrent: false }, moduleCount: moduleIds.length } };
        },
      }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    input.value = '2026';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-checkbox"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-table-row-m1-checkbox"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await tick();

    expect(calls).toEqual([{ startYear: 2026, moduleIds: ['m1'] }]);
    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-message"]')!.textContent).toBeTruthy();

    el.remove();
  });

  it('new-year flow: a duplicate start year shows academic-year-toast and keeps adding mode open', async () => {
    const el = await mountView({
      catalogCycle: fakeCatalogCycleService({ list: async () => [] }),
      academicYear: fakeAcademicYearService({ createWithSelection: async () => ({ outcome: 'duplicate-name' }) }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await tick();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    input.value = '2026';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-toast"]')!.textContent).toBeTruthy();
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-new-name"]')).not.toBeNull();

    el.remove();
  });

  it('extend-existing flow: click adds only the newly-checked módulos via extendSelection', async () => {
    const calls: { id: string; moduleIds: string[] }[] = [];
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'y1', startYear: 2026, isCurrent: false }],
        extendSelection: async (id, moduleIds) => {
          calls.push({ id, moduleIds });
          return { outcome: 'success', value: { addedCount: moduleIds.length } };
        },
      }),
      catalogCycle: fakeCatalogCycleService({ list: async () => [{ id: 'c1', name: 'DAW' }] }),
      catalogModule: fakeCatalogModuleService({ listForCycle: async () => [{ id: 'm2', catalogTrainingCycleId: 'c1', course: 1, name: 'Base de datos' }] }),
    });
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-y1"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-add-cycle-button"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="training-cycle-table-row-c1-checkbox"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-table-row-m2-checkbox"]')!.click();
    await tick();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="module-selection-save-button"]')!.click();
    await tick();

    expect(calls).toEqual([{ id: 'y1', moduleIds: ['m2'] }]);

    el.remove();
  });
});

describe('elementId: module-selection-save-message', () => {
  it('is not visible before a save attempt', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="module-selection-save-message"]')).toBeNull();

    el.remove();
  });
});

describe('elementId: academic-year-table, training-cycle-table — unauthenticated', () => {
  it('redirects to /login when the session check responds unauthenticated', async () => {
    const el = document.createElement('app-academic-year-settings-view') as AcademicYearSettingsView;
    el.sessionService = { getSession: async () => ({ authenticated: false }), logout: async () => {} };
    el.academicYearService = fakeAcademicYearService();
    el.catalogCycleService = fakeCatalogCycleService();
    el.catalogModuleService = fakeCatalogModuleService();
    document.body.appendChild(el);
    await tick();

    expect(window.location.pathname).toBe('/login');

    window.history.pushState({}, '', '/configuracion/ano-academico');
    el.remove();
  });
});
