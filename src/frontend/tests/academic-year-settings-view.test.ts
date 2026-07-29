// elementId: academic-year-nav-link, teacher-nav-link, academic-year-table,
// academic-year-table-add-button, academic-year-delete-blocked-message (see
// views/configuracion/use-cases.md UC-03/UC-04). New component, doesn't exist yet.
//
// Shared inline-edit-row convention for every CRUD table in this view (per
// lib/patterns/crud-table-component.md), used identically across this file and
// training-cycle-management.test.ts / module-management.test.ts / module-selection.test.ts:
// read mode renders `<tableId>-row-<id>-edit` and `<tableId>-row-<id>-delete`; clicking
// `-edit` (or `<tableId>-add-button`, which inserts a row with id `new`) switches that row
// to edit mode: `<tableId>-row-<id>-name` (+ `-course` for module-table only), plus
// `<tableId>-row-<id>-save` and `<tableId>-row-<id>-cancel`. academic-year-table adds
// `<tableId>-row-<id>-set-current`.
import { describe, it, expect } from 'bun:test';
import '../src/academic-year-settings-view';
import type { AcademicYearSettingsView } from '../src/academic-year-settings-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}
type WriteResult<T> = { outcome: 'success'; value: T } | { outcome: 'not-found' } | { outcome: 'duplicate-name' };
type DeleteResult =
  | { outcome: 'success' }
  | { outcome: 'not-found' }
  | { outcome: 'is-current' };

interface AcademicYearApiService {
  list(): Promise<AcademicYear[]>;
  create(name: string): Promise<WriteResult<AcademicYear>>;
  rename(id: string, name: string): Promise<WriteResult<AcademicYear>>;
  setCurrent(id: string): Promise<WriteResult<AcademicYear>>;
  remove(id: string): Promise<DeleteResult>;
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
    confirm?: boolean,
  ): Promise<
    | { outcome: 'success'; value: ModuleRecord }
    | { outcome: 'not-found' }
    | { outcome: 'duplicate-name' }
    | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] }
  >;
  remove(
    id: string,
  ): Promise<{ outcome: 'success' } | { outcome: 'not-found' } | { outcome: 'has-dependents'; academicYears: { id: string; name: string }[] }>;
}

function fakeSessionService(): SessionApiService {
  return { getSession: async () => ({ authenticated: true, fullName: 'Ana García' }), logout: async () => {} };
}

function fakeAcademicYearService(overrides: Partial<AcademicYearApiService> = {}): AcademicYearApiService {
  return {
    list: async () => [],
    create: async (name) => ({ outcome: 'success', value: { id: 'new-year', name, isCurrent: false } }),
    rename: async (id, name) => ({ outcome: 'success', value: { id, name, isCurrent: false } }),
    setCurrent: async (id) => ({ outcome: 'success', value: { id, name: 'X', isCurrent: true } }),
    remove: async () => ({ outcome: 'success' }),
    getSelection: async () => [],
    replaceSelection: async () => ({ outcome: 'success' }),
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
    create: async (cycleId, name, course) => ({ outcome: 'success', value: { id: 'new-module', trainingCycleId: cycleId, course, name } }),
    update: async (id, changes) => ({ outcome: 'success', value: { id, trainingCycleId: 'c1', course: 1, name: 'X', ...changes } }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

async function mountView(overrides?: {
  session?: SessionApiService;
  academicYear?: AcademicYearApiService;
  trainingCycle?: TrainingCycleApiService;
  module?: ModuleApiService;
}): Promise<AcademicYearSettingsView> {
  const el = document.createElement('app-academic-year-settings-view') as AcademicYearSettingsView;
  el.sessionService = overrides?.session ?? fakeSessionService();
  el.academicYearService = overrides?.academicYear ?? fakeAcademicYearService();
  el.trainingCycleService = overrides?.trainingCycle ?? fakeTrainingCycleService();
  el.moduleService = overrides?.module ?? fakeModuleService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: academic-year-table', () => {
  it('redirects to /login when the session check responds unauthenticated', async () => {
    const el = await mountView({ session: { getSession: async () => ({ authenticated: false }), logout: async () => {} } });

    expect(window.location.pathname).toBe('/login');

    window.history.pushState({}, '', '/configuracion/ano-academico');
    el.remove();
  });

  it('shows one row per existing academic year, with which one is current', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [
          { id: 'ay1', name: '2025/2026', isCurrent: false },
          { id: 'ay2', name: '2026/2027', isCurrent: true },
        ],
      }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-ay1"]')).not.toBeNull();
    const currentRow = el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-ay2"]')!;
    expect(currentRow.textContent).toContain('2026/2027');

    el.remove();
  });

  it('adding a new row and saving a unique name calls create()', async () => {
    const calls: { createdName: string | null } = { createdName: null };
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        create: async (name) => {
          calls.createdName = name;
          return { outcome: 'success', value: { id: 'ay-new', name, isCurrent: false } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-add-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-new-name"]')!;
    input.value = '2028/2029';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-new-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.createdName).toBe('2028/2029');

    el.remove();
  });

  it('clicking set-current on a row calls setCurrent() with that row\'s id', async () => {
    const calls: { setCurrentId: string | null } = { setCurrentId: null };
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: false }],
        setCurrent: async (id) => {
          calls.setCurrentId = id;
          return { outcome: 'success', value: { id, name: '2026/2027', isCurrent: true } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1-set-current"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.setCurrentId).toBe('ay1');

    el.remove();
  });

  it('deleting the row marked current shows academic-year-delete-blocked-message', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: true }],
        remove: async () => ({ outcome: 'is-current' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-delete-blocked-message"]')!.textContent).not.toBe(
      '',
    );

    el.remove();
  });

  it('deleting a non-current row succeeds and it disappears from the table', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: false }],
        remove: async () => ({ outcome: 'success' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1-delete"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-ay1"]')).toBeNull();

    el.remove();
  });

  it('saving a duplicate name shows an inline error and does not remove the row', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [{ id: 'ay1', name: '2026/2027', isCurrent: false }],
        rename: async () => ({ outcome: 'duplicate-name' }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1-edit"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="academic-year-table-row-ay1-name"]')!;
    input.value = '2027/2028';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay1-save"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-ay1"]')).not.toBeNull();
    expect(el.shadowRoot!.textContent).toContain('Ya existe un año académico con ese nombre');

    el.remove();
  });

  it('marking a row current un-marks whichever row was current before', async () => {
    const el = await mountView({
      academicYear: fakeAcademicYearService({
        list: async () => [
          { id: 'ay1', name: '2025/2026', isCurrent: true },
          { id: 'ay2', name: '2026/2027', isCurrent: false },
        ],
        setCurrent: async (id) => ({ outcome: 'success', value: { id, name: '2026/2027', isCurrent: true } }),
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-table-row-ay2-set-current"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-ay1"]')!.textContent).not.toContain(
      'En curso',
    );
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-table-row-ay2"]')!.textContent).toContain(
      'En curso',
    );

    el.remove();
  });
});

describe('elementId: academic-year-nav-link, teacher-nav-link', () => {
  it('academic-year-nav-link is active and teacher-nav-link is inactive on this screen', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-nav-link"]')!.getAttribute('aria-current')).toBe(
      'page',
    );
    expect(el.shadowRoot!.querySelector('[data-element-id="teacher-nav-link"]')!.getAttribute('aria-current')).toBeNull();

    el.remove();
  });

  it('clicking teacher-nav-link navigates to /configuracion/profesor', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="teacher-nav-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/configuracion/profesor');

    window.history.pushState({}, '', '/configuracion/ano-academico');
    el.remove();
  });
});
