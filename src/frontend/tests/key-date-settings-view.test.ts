// elementId: back-to-dashboard-link, teacher-nav-link, training-catalog-nav-link,
// academic-year-nav-link, key-dates-nav-link, academic-key-dates-table,
// academic-key-dates-table-add-button, holidays-table, holidays-table-add-button,
// public-holidays-table, public-holidays-table-add-button, free-disposal-days-table,
// free-disposal-days-table-add-button, evaluations-table, evaluations-table-add-button,
// feoe-project-days-table, feoe-project-days-table-add-button (see
// views/fechas-senaladas/use-cases.md UC-01..UC-07). Fourth Configuración screen — six
// independent category tables over the single, shared key_dates resource (see
// api-contracts.md's "one resource, not six"). Date fields are single DD/MM-formatted text
// inputs (see description_fechas-senaladas.md); the component converts to/from the API's
// separate startDay/startMonth/endDay/endMonth integers.
import { describe, it, expect } from 'bun:test';
import '../src/key-date-settings-view';
import type { KeyDateSettingsView } from '../src/key-date-settings-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

interface KeyDate {
  id: string;
  category: string;
  name: string;
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
  type: string | null;
}

type WriteResult<T> = { outcome: 'success'; value: T } | { outcome: 'not-found' } | { outcome: 'duplicate-name' };
type DeleteResult = { outcome: 'success' } | { outcome: 'not-found' };

interface KeyDateCreateData {
  category: string;
  name: string;
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
  type?: string | null;
}

interface KeyDateApiService {
  list(category: string): Promise<KeyDate[]>;
  create(data: KeyDateCreateData): Promise<WriteResult<KeyDate>>;
  update(id: string, changes: Partial<KeyDateCreateData>): Promise<WriteResult<KeyDate>>;
  remove(id: string): Promise<DeleteResult>;
}

interface CategoryDef {
  category: string;
  tableId: string;
  addButtonId: string;
  hasRange: boolean;
  hasType: boolean;
}

const CATEGORIES: CategoryDef[] = [
  { category: 'academic_key_dates', tableId: 'academic-key-dates-table', addButtonId: 'academic-key-dates-table-add-button', hasRange: true, hasType: false },
  { category: 'holidays', tableId: 'holidays-table', addButtonId: 'holidays-table-add-button', hasRange: true, hasType: false },
  { category: 'public_holidays', tableId: 'public-holidays-table', addButtonId: 'public-holidays-table-add-button', hasRange: false, hasType: true },
  { category: 'free_disposal_days', tableId: 'free-disposal-days-table', addButtonId: 'free-disposal-days-table-add-button', hasRange: false, hasType: false },
  { category: 'evaluations', tableId: 'evaluations-table', addButtonId: 'evaluations-table-add-button', hasRange: true, hasType: false },
  { category: 'feoe_project_days', tableId: 'feoe-project-days-table', addButtonId: 'feoe-project-days-table-add-button', hasRange: false, hasType: false },
];

function fakeSessionService(): SessionApiService {
  return { getSession: async () => ({ authenticated: true, fullName: 'Ana García' }), logout: async () => {} };
}

function fakeKeyDateService(overrides: Partial<KeyDateApiService> = {}): KeyDateApiService {
  return {
    list: async () => [],
    create: async (data) => ({ outcome: 'success', value: { id: 'new-id', type: null, ...data } }),
    update: async (id, changes) => ({
      outcome: 'success',
      value: { id, category: 'holidays', name: 'X', startDay: 1, startMonth: 1, endDay: 1, endMonth: 1, type: null, ...changes },
    }),
    remove: async () => ({ outcome: 'success' }),
    ...overrides,
  };
}

async function mountView(overrides?: { keyDate?: KeyDateApiService }): Promise<KeyDateSettingsView> {
  const el = document.createElement('app-key-date-settings-view') as KeyDateSettingsView;
  el.sessionService = fakeSessionService();
  el.keyDateService = overrides?.keyDate ?? fakeKeyDateService();
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('elementId: key-dates-nav-link', () => {
  it('key-dates-nav-link is active and the other three settings links are inactive', async () => {
    const el = await mountView();

    expect(el.shadowRoot!.querySelector('[data-element-id="key-dates-nav-link"]')!.getAttribute('aria-current')).toBe('page');
    expect(el.shadowRoot!.querySelector('[data-element-id="teacher-nav-link"]')!.getAttribute('aria-current')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="training-catalog-nav-link"]')!.getAttribute('aria-current')).toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="academic-year-nav-link"]')!.getAttribute('aria-current')).toBeNull();

    el.remove();
  });

  it('clicking back-to-dashboard-link navigates to /dashboard', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="back-to-dashboard-link"]')!.click();
    await tick();

    expect(window.location.pathname).toBe('/dashboard');

    window.history.pushState({}, '', '/configuracion/fechas-senaladas');
    el.remove();
  });
});

for (const cat of CATEGORIES) {
  describe(`elementId: ${cat.tableId} (category: ${cat.category})`, () => {
    it(`${cat.tableId} shows an empty state when the category has no rows`, async () => {
      const el = await mountView({ keyDate: fakeKeyDateService({ list: async () => [] }) });

      expect(el.shadowRoot!.querySelector(`[data-element-id="${cat.tableId}"]`)!.textContent).toBeTruthy();

      el.remove();
    });

    it(`${cat.tableId} shows one row per key_dates row in its category`, async () => {
      const row: KeyDate = {
        id: 'kd1',
        category: cat.category,
        name: 'Fila de ejemplo',
        startDay: 12,
        startMonth: 10,
        endDay: cat.hasRange ? 20 : 12,
        endMonth: cat.hasRange ? 10 : 10,
        type: cat.hasType ? 'Nacional' : null,
      };
      const el = await mountView({
        keyDate: fakeKeyDateService({ list: async (category) => (category === cat.category ? [row] : []) }),
      });

      expect(el.shadowRoot!.querySelector(`[data-element-id="${cat.tableId}-row-kd1"]`)!.textContent).toContain('Fila de ejemplo');

      el.remove();
    });

    it(`clicking ${cat.addButtonId} opens a blank, inline-editable draft row in ${cat.tableId}`, async () => {
      const el = await mountView();

      el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${cat.addButtonId}"]`)!.click();
      await tick();

      expect(el.shadowRoot!.querySelector(`[data-element-id="${cat.tableId}-row-new-name"]`)).not.toBeNull();

      el.remove();
    });

    it(`saving the draft row with a valid nombre and fecha persists a new row in ${cat.tableId}`, async () => {
      const calls: KeyDateCreateData[] = [];
      const el = await mountView({
        keyDate: fakeKeyDateService({
          create: async (data) => {
            calls.push(data);
            return { outcome: 'success', value: { id: 'new-id', type: data.type ?? null, ...data } };
          },
        }),
      });

      el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${cat.addButtonId}"]`)!.click();
      await tick();
      el.shadowRoot!.querySelector<HTMLInputElement>(`[data-element-id="${cat.tableId}-row-new-name"]`)!.value = 'Nueva fecha';
      el.shadowRoot!
        .querySelector<HTMLInputElement>(`[data-element-id="${cat.tableId}-row-new-name"]`)!
        .dispatchEvent(new Event('input', { bubbles: true }));
      const startInput = el.shadowRoot!.querySelector<HTMLInputElement>(`[data-element-id="${cat.tableId}-row-new-start-date"]`)!;
      startInput.value = '12/10';
      startInput.dispatchEvent(new Event('input', { bubbles: true }));
      if (cat.hasRange) {
        const endInput = el.shadowRoot!.querySelector<HTMLInputElement>(`[data-element-id="${cat.tableId}-row-new-end-date"]`)!;
        endInput.value = '20/10';
        endInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${cat.tableId}-row-new-save"]`)!.click();
      await tick();

      expect(calls).toHaveLength(1);
      expect(calls[0]!.category).toBe(cat.category);
      expect(calls[0]!.name).toBe('Nueva fecha');
      expect(calls[0]!.startDay).toBe(12);
      expect(calls[0]!.startMonth).toBe(10);
      if (cat.hasRange) {
        expect(calls[0]!.endDay).toBe(20);
        expect(calls[0]!.endMonth).toBe(10);
      } else {
        expect(calls[0]!.endDay).toBe(12);
        expect(calls[0]!.endMonth).toBe(10);
      }

      el.remove();
    });

    it(`saving the draft row with an invalid date (31/02) in ${cat.tableId} shows an inline error and does not submit`, async () => {
      const calls: KeyDateCreateData[] = [];
      const el = await mountView({
        keyDate: fakeKeyDateService({
          create: async (data) => {
            calls.push(data);
            return { outcome: 'success', value: { id: 'new-id', type: null, ...data } };
          },
        }),
      });

      el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${cat.addButtonId}"]`)!.click();
      await tick();
      el.shadowRoot!.querySelector<HTMLInputElement>(`[data-element-id="${cat.tableId}-row-new-name"]`)!.value = 'Fecha inválida';
      el.shadowRoot!
        .querySelector<HTMLInputElement>(`[data-element-id="${cat.tableId}-row-new-name"]`)!
        .dispatchEvent(new Event('input', { bubbles: true }));
      const startInput = el.shadowRoot!.querySelector<HTMLInputElement>(`[data-element-id="${cat.tableId}-row-new-start-date"]`)!;
      startInput.value = '31/02';
      startInput.dispatchEvent(new Event('input', { bubbles: true }));
      el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${cat.tableId}-row-new-save"]`)!.click();
      await tick();

      expect(calls).toHaveLength(0);
      expect(el.shadowRoot!.querySelector(`[data-element-id="${cat.tableId}-row-new-name"]`)).not.toBeNull();

      el.remove();
    });

    it(`clicking a row's Editar in ${cat.tableId} switches it to inline-editable inputs`, async () => {
      const row: KeyDate = {
        id: 'kd1',
        category: cat.category,
        name: 'Editable',
        startDay: 1,
        startMonth: 1,
        endDay: cat.hasRange ? 2 : 1,
        endMonth: 1,
        type: null,
      };
      const el = await mountView({
        keyDate: fakeKeyDateService({ list: async (category) => (category === cat.category ? [row] : []) }),
      });

      el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${cat.tableId}-row-kd1-edit"]`)!.click();
      await tick();

      expect(el.shadowRoot!.querySelector(`[data-element-id="${cat.tableId}-row-kd1-name"]`)).not.toBeNull();

      el.remove();
    });

    it(`clicking a row's Eliminar in ${cat.tableId} deletes it unconditionally`, async () => {
      const row: KeyDate = {
        id: 'kd1',
        category: cat.category,
        name: 'Para eliminar',
        startDay: 1,
        startMonth: 1,
        endDay: 1,
        endMonth: 1,
        type: null,
      };
      const calls: string[] = [];
      const el = await mountView({
        keyDate: fakeKeyDateService({
          list: async (category) => (category === cat.category ? [row] : []),
          remove: async (id) => {
            calls.push(id);
            return { outcome: 'success' };
          },
        }),
      });

      el.shadowRoot!.querySelector<HTMLElement>(`[data-element-id="${cat.tableId}-row-kd1-delete"]`)!.click();
      await tick();

      expect(calls).toEqual(['kd1']);
      expect(el.shadowRoot!.querySelector(`[data-element-id="${cat.tableId}-row-kd1"]`)).toBeNull();

      el.remove();
    });
  });
}

describe('elementId: public-holidays-table — tipo', () => {
  it('shows each row\'s tipo alongside its fecha', async () => {
    const row: KeyDate = {
      id: 'kd1',
      category: 'public_holidays',
      name: 'Fiesta Nacional de España.',
      startDay: 12,
      startMonth: 10,
      endDay: 12,
      endMonth: 10,
      type: 'Nacional',
    };
    const el = await mountView({
      keyDate: fakeKeyDateService({ list: async (category) => (category === 'public_holidays' ? [row] : []) }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="public-holidays-table-row-kd1"]')!.textContent).toContain('Nacional');

    el.remove();
  });

  it('saving the draft row sends the typed tipo', async () => {
    const calls: KeyDateCreateData[] = [];
    const el = await mountView({
      keyDate: fakeKeyDateService({
        create: async (data) => {
          calls.push(data);
          return { outcome: 'success', value: { id: 'new-id', type: data.type ?? null, ...data } };
        },
      }),
    });

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="public-holidays-table-add-button"]')!.click();
    await tick();
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="public-holidays-table-row-new-name"]')!.value = 'Día de Canarias.';
    el.shadowRoot!
      .querySelector<HTMLInputElement>('[data-element-id="public-holidays-table-row-new-name"]')!
      .dispatchEvent(new Event('input', { bubbles: true }));
    const startInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="public-holidays-table-row-new-start-date"]')!;
    startInput.value = '30/05';
    startInput.dispatchEvent(new Event('input', { bubbles: true }));
    const typeInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="public-holidays-table-row-new-type"]')!;
    typeInput.value = 'Autonómico';
    typeInput.dispatchEvent(new Event('input', { bubbles: true }));
    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="public-holidays-table-row-new-save"]')!.click();
    await tick();

    expect(calls[0]!.type).toBe('Autonómico');

    el.remove();
  });
});

describe('elementId: holidays-table — rango de fechas', () => {
  it('displays a row\'s date as "DD/MM – DD/MM" when start and end differ', async () => {
    const row: KeyDate = {
      id: 'kd1',
      category: 'holidays',
      name: 'Vacaciones de Navidad.',
      startDay: 22,
      startMonth: 12,
      endDay: 7,
      endMonth: 1,
      type: null,
    };
    const el = await mountView({
      keyDate: fakeKeyDateService({ list: async (category) => (category === 'holidays' ? [row] : []) }),
    });

    expect(el.shadowRoot!.querySelector('[data-element-id="holidays-table-row-kd1"]')!.textContent).toContain('22/12 – 07/01');

    el.remove();
  });
});

describe('elementId: free-disposal-days-table — single-day category', () => {
  it('the draft row has no fecha-fin input, only fecha', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="free-disposal-days-table-add-button"]')!.click();
    await tick();

    expect(el.shadowRoot!.querySelector('[data-element-id="free-disposal-days-table-row-new-start-date"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('[data-element-id="free-disposal-days-table-row-new-end-date"]')).toBeNull();

    el.remove();
  });

  it('displays a row\'s date as a single "DD/MM"', async () => {
    const row: KeyDate = {
      id: 'kd1',
      category: 'free_disposal_days',
      name: 'Día de libre disposición, puente de mayo.',
      startDay: 3,
      startMonth: 5,
      endDay: 3,
      endMonth: 5,
      type: null,
    };
    const el = await mountView({
      keyDate: fakeKeyDateService({ list: async (category) => (category === 'free_disposal_days' ? [row] : []) }),
    });

    const text = el.shadowRoot!.querySelector('[data-element-id="free-disposal-days-table-row-kd1"]')!.textContent!;
    expect(text).toContain('03/05');
    expect(text).not.toContain('–');

    el.remove();
  });
});

describe('elementId: academic-key-dates-table, holidays-table, public-holidays-table, free-disposal-days-table, evaluations-table, feoe-project-days-table — unauthenticated', () => {
  it('redirects to /login when the session check responds unauthenticated', async () => {
    const el = document.createElement('app-key-date-settings-view') as KeyDateSettingsView;
    el.sessionService = { getSession: async () => ({ authenticated: false }), logout: async () => {} };
    el.keyDateService = fakeKeyDateService();
    document.body.appendChild(el);
    await tick();

    expect(window.location.pathname).toBe('/login');

    window.history.pushState({}, '', '/configuracion/fechas-senaladas');
    el.remove();
  });
});
