import { html, render, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { renderSettingsNav } from './settings-nav';
import { parseRowAction, type RowAction } from './row-action';
import { RequiredRef } from './required-ref';
import { SettingsScreenBase } from './settings-screen-base';
import type { SessionApiService } from './session-api-service';
import type { KeyDate, KeyDateApiService, KeyDateCreateData } from './key-date-api-service';

const NEW_ROW_ID = 'new';

const INVALID_DATE_MESSAGE = 'Introduce una fecha válida en formato DD/MM.';
const DUPLICATE_NAME_MESSAGE = 'Ya existe una fecha con ese nombre en esta categoría';

/** Feb kept at 29 (not 28) — these rows carry no year, so a template entry landing on a
 * leap day must still be accepted. */
const DAYS_IN_MONTH: readonly number[] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DDMM_PATTERN = /^(\d{1,2})\/(\d{1,2})$/;

interface DayMonth {
  day: number;
  month: number;
}

function parseDayMonth(value: string): DayMonth | null {
  const match = DDMM_PATTERN.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]!) return null;
  return { day, month };
}

function formatDayMonth(day: number, month: number): string {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/** `"DD/MM"` for a single-day row (start === end), `"DD/MM – DD/MM"` for a range. */
function formatDateDisplay(row: KeyDate): string {
  const start = formatDayMonth(row.startDay, row.startMonth);
  if (row.startDay === row.endDay && row.startMonth === row.endMonth) {
    return start;
  }
  return `${start} – ${formatDayMonth(row.endDay, row.endMonth)}`;
}

interface CategoryDef {
  category: string;
  tableId: string;
  addButtonId: string;
  label: string;
  hasRange: boolean;
  hasType: boolean;
}

const CATEGORIES: readonly CategoryDef[] = [
  {
    category: 'academic_key_dates',
    tableId: 'academic-key-dates-table',
    addButtonId: 'academic-key-dates-table-add-button',
    label: 'Fechas clave FP',
    hasRange: true,
    hasType: false,
  },
  {
    category: 'holidays',
    tableId: 'holidays-table',
    addButtonId: 'holidays-table-add-button',
    label: 'Vacaciones',
    hasRange: true,
    hasType: false,
  },
  {
    category: 'public_holidays',
    tableId: 'public-holidays-table',
    addButtonId: 'public-holidays-table-add-button',
    label: 'Días festivos',
    hasRange: false,
    hasType: true,
  },
  {
    category: 'free_disposal_days',
    tableId: 'free-disposal-days-table',
    addButtonId: 'free-disposal-days-table-add-button',
    label: 'Días de libre disposición',
    hasRange: false,
    hasType: false,
  },
  {
    category: 'evaluations',
    tableId: 'evaluations-table',
    addButtonId: 'evaluations-table-add-button',
    label: 'Evaluaciones',
    hasRange: true,
    hasType: false,
  },
  {
    category: 'feoe_project_days',
    tableId: 'feoe-project-days-table',
    addButtonId: 'feoe-project-days-table-add-button',
    label: 'Proyecto FEOE',
    hasRange: false,
    hasType: false,
  },
];

interface CategoryState {
  rows: KeyDate[];
  editingRowId: string | null;
  rowError: string | null;
}

/**
 * Configuración — Fechas señaladas screen. Own top-level custom element, single Shadow DOM
 * (CLAUDE.md's "no nested Shadow DOM" rule). See views/fechas-senaladas/ui-spec.json
 * (`key-dates-settings-screen`) for element design and views/fechas-senaladas/use-cases.md
 * UC-01..UC-07 for the business rules implemented here, and
 * lib/patterns/crud-table-component.md for the inline-edit shape every one of the six
 * category tables follows (same shape as Ciclos/Módulos' `training-catalog-settings-view.ts`).
 *
 * Six independent `key_dates` category tables (no master/detail cascade between them,
 * unlike Año académico) share the same underlying resource (`GET/POST/PATCH/DELETE
 * /api/key-dates`, `category` field distinguishes them — see api-contracts.md's "one
 * resource, not six"), so `_categoryState` holds one `CategoryState` per `CategoryDef`
 * rather than duplicating the same rows/editingRowId/rowError fields six times over (OCP: a
 * seventh category would only mean adding one more `CategoryDef` entry, no new code path).
 *
 * Date fields are single `DD/MM`-formatted text inputs (see
 * description_fechas-senaladas.md) — `parseDayMonth`/`formatDayMonth` convert to/from the
 * API's separate `startDay`/`startMonth`/`endDay`/`endMonth` integers. A single-day category
 * (`hasRange: false`) sends the same parsed value as both start and end (never a redundant
 * end-date input) and displays only one `DD/MM`; a range category displays `"DD/MM – DD/MM"`
 * when start and end differ.
 */
export class KeyDateSettingsView extends SettingsScreenBase {
  private readonly _sessionServiceRef = new RequiredRef<SessionApiService>(
    'KeyDateSettingsView.sessionService must be set before use',
  );
  private readonly _keyDateServiceRef = new RequiredRef<KeyDateApiService>(
    'KeyDateSettingsView.keyDateService must be set before use',
  );

  private _authenticated = false;
  private _loaded = false;

  private readonly _categoryState: Map<string, CategoryState> = new Map(
    CATEGORIES.map((catDef) => [catDef.category, { rows: [], editingRowId: null, rowError: null }]),
  );

  set sessionService(value: SessionApiService) {
    this._sessionServiceRef.set(value);
  }

  get sessionService(): SessionApiService {
    return this._sessionServiceRef.get();
  }

  set keyDateService(value: KeyDateApiService) {
    this._keyDateServiceRef.set(value);
  }

  get keyDateService(): KeyDateApiService {
    return this._keyDateServiceRef.get();
  }

  protected async _onConnected(): Promise<void> {
    const outcome = await this.sessionService.getSession();
    if (!outcome.authenticated) {
      redirectTo('/login');
      return;
    }
    this._authenticated = true;

    await Promise.all(
      CATEGORIES.map(async (catDef) => {
        const rows = await this.keyDateService.list(catDef.category);
        this._stateFor(catDef.category).rows = rows;
      }),
    );
    this._loaded = true;
    this._render();
  }

  private _stateFor(category: string): CategoryState {
    const state = this._categoryState.get(category);
    if (!state) {
      throw new Error(`KeyDateSettingsView: unknown category "${category}"`);
    }
    return state;
  }

  // ---------------------------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------------------------

  protected _onElementClick(elementId: string): void {
    const addCatDef = CATEGORIES.find((catDef) => catDef.addButtonId === elementId);
    if (addCatDef) {
      this._startAdd(addCatDef.category);
      return;
    }

    for (const catDef of CATEGORIES) {
      const action = parseRowAction(elementId, catDef.tableId);
      if (action) {
        void this._handleRowAction(catDef, action);
        return;
      }
    }
  }

  private _startAdd(category: string): void {
    const state = this._stateFor(category);
    state.editingRowId = NEW_ROW_ID;
    state.rowError = null;
    this._render();
  }

  private async _handleRowAction(catDef: CategoryDef, { rowId, action }: RowAction): Promise<void> {
    const state = this._stateFor(catDef.category);
    switch (action) {
      case 'edit':
        state.editingRowId = rowId;
        state.rowError = null;
        this._render();
        return;
      case 'cancel':
        state.editingRowId = null;
        state.rowError = null;
        this._render();
        return;
      case 'save':
        await this._saveRow(catDef, rowId);
        return;
      case 'delete':
        await this._deleteRow(catDef, rowId);
        return;
      default:
        return;
    }
  }

  // ---------------------------------------------------------------------------------------
  // Row persistence
  // ---------------------------------------------------------------------------------------

  private async _saveRow(catDef: CategoryDef, rowId: string): Promise<void> {
    const state = this._stateFor(catDef.category);
    const name = this._query<HTMLInputElement>(`${catDef.tableId}-row-${rowId}-name`).value.trim();
    const startParsed = parseDayMonth(this._query<HTMLInputElement>(`${catDef.tableId}-row-${rowId}-start-date`).value);

    let endParsed: DayMonth | null = startParsed;
    if (catDef.hasRange) {
      endParsed = parseDayMonth(this._query<HTMLInputElement>(`${catDef.tableId}-row-${rowId}-end-date`).value);
    }

    if (startParsed === null || endParsed === null) {
      state.rowError = INVALID_DATE_MESSAGE;
      this._render();
      return;
    }

    const data: KeyDateCreateData = {
      category: catDef.category,
      name,
      startDay: startParsed.day,
      startMonth: startParsed.month,
      endDay: endParsed.day,
      endMonth: endParsed.month,
    };
    if (catDef.hasType) {
      const typeValue = this._query<HTMLInputElement>(`${catDef.tableId}-row-${rowId}-type`).value.trim();
      data.type = typeValue.length > 0 ? typeValue : undefined;
    }

    const result = rowId === NEW_ROW_ID ? await this.keyDateService.create(data) : await this.keyDateService.update(rowId, data);

    if (result.outcome === 'duplicate-name') {
      state.rowError = DUPLICATE_NAME_MESSAGE;
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    state.rows =
      rowId === NEW_ROW_ID ? [...state.rows, result.value] : state.rows.map((row) => (row.id === rowId ? result.value : row));
    state.editingRowId = null;
    state.rowError = null;
    this._render();
  }

  private async _deleteRow(catDef: CategoryDef, id: string): Promise<void> {
    const state = this._stateFor(catDef.category);
    const result = await this.keyDateService.remove(id);
    if (result.outcome !== 'success') {
      this._render();
      return;
    }

    state.rows = state.rows.filter((row) => row.id !== id);
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------------------

  protected _render(): void {
    if (!this._authenticated || !this._loaded) {
      render(html``, this.shadowRoot!);
      return;
    }

    render(
      html`
        <div class="flex flex-col gap-8 p-4">
          ${renderSettingsNav('fechas-senaladas')} ${CATEGORIES.map((catDef) => this._renderSection(catDef))}
        </div>
      `,
      this.shadowRoot!,
    );
  }

  private _colSpan(catDef: CategoryDef): number {
    return 2 + (catDef.hasType ? 1 : 0) + 1;
  }

  private _renderSection(catDef: CategoryDef): TemplateResult {
    const state = this._stateFor(catDef.category);
    const isAdding = state.editingRowId === NEW_ROW_ID;

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">${catDef.label}</h2>
          <button type="button" class="${classesFor('button', 'secondary', 'sm')}" data-element-id="${catDef.addButtonId}">
            Añadir ${catDef.label.toLowerCase()}
          </button>
        </div>

        <table class="${classesFor('table')}" data-element-id="${catDef.tableId}">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha</th>
              ${catDef.hasType ? html`<th>Tipo</th>` : ''}
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.rows.length === 0 && !isAdding
              ? html`<tr>
                  <td colspan="${this._colSpan(catDef)}">No hay fechas creadas todavía en la categoría "${catDef.label}".</td>
                </tr>`
              : ''}
            ${state.rows.map((row) => this._renderRow(catDef, row))} ${isAdding ? this._renderDraftRow(catDef) : ''}
          </tbody>
        </table>
      </section>
    `;
  }

  private _renderRow(catDef: CategoryDef, row: KeyDate): TemplateResult {
    const state = this._stateFor(catDef.category);
    if (state.editingRowId === row.id) {
      return this._renderEditRow(catDef, row.id, row);
    }

    return html`
      <tr data-element-id="${catDef.tableId}-row-${row.id}">
        <td>${row.name}</td>
        <td>${formatDateDisplay(row)}</td>
        ${catDef.hasType ? html`<td>${row.type ?? ''}</td>` : ''}
        <td class="flex gap-2">
          <button type="button" class="${classesFor('button', 'ghost', 'sm')}" data-element-id="${catDef.tableId}-row-${row.id}-edit">
            Editar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'danger', 'sm')}"
            data-element-id="${catDef.tableId}-row-${row.id}-delete"
          >
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }

  private _renderDraftRow(catDef: CategoryDef): TemplateResult {
    return this._renderEditRow(catDef, NEW_ROW_ID);
  }

  private _renderEditRow(catDef: CategoryDef, rowId: string, row?: KeyDate): TemplateResult {
    const state = this._stateFor(catDef.category);
    const nameValue = row?.name ?? '';
    const startValue = row ? formatDayMonth(row.startDay, row.startMonth) : '';
    const endValue = row && catDef.hasRange ? formatDayMonth(row.endDay, row.endMonth) : '';
    const typeValue = row?.type ?? '';

    return html`
      <tr data-element-id="${catDef.tableId}-row-${rowId}">
        <td>
          <input
            class="${classesFor('text-input', undefined, 'md')}"
            data-element-id="${catDef.tableId}-row-${rowId}-name"
            type="text"
            .value=${nameValue}
          />
        </td>
        <td>
          <input
            class="${classesFor('text-input', undefined, 'md')}"
            data-element-id="${catDef.tableId}-row-${rowId}-start-date"
            type="text"
            placeholder="DD/MM"
            .value=${startValue}
          />
        </td>
        ${catDef.hasRange
          ? html`<td>
              <input
                class="${classesFor('text-input', undefined, 'md')}"
                data-element-id="${catDef.tableId}-row-${rowId}-end-date"
                type="text"
                placeholder="DD/MM"
                .value=${endValue}
              />
            </td>`
          : ''}
        ${catDef.hasType
          ? html`<td>
              <input
                class="${classesFor('text-input', undefined, 'md')}"
                data-element-id="${catDef.tableId}-row-${rowId}-type"
                type="text"
                .value=${typeValue}
              />
            </td>`
          : ''}
        <td class="flex gap-2">
          <button type="button" class="${classesFor('button', 'primary', 'sm')}" data-element-id="${catDef.tableId}-row-${rowId}-save">
            Guardar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="${catDef.tableId}-row-${rowId}-cancel"
          >
            Cancelar
          </button>
        </td>
      </tr>
      ${state.editingRowId === rowId && state.rowError !== null
        ? html`<tr>
            <td colspan="${this._colSpan(catDef)}" class="${classesFor('paragraph', 'danger', 'sm')}">${state.rowError}</td>
          </tr>`
        : ''}
    `;
  }
}

customElements.define('app-key-date-settings-view', KeyDateSettingsView);
