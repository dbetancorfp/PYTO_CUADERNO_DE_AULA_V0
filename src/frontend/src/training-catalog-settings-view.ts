import { html, render, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { renderSettingsNav } from './settings-nav';
import { parseRowAction, type RowAction } from './row-action';
import { RequiredRef } from './required-ref';
import { SettingsScreenBase } from './settings-screen-base';
import type { SessionApiService } from './session-api-service';
import type { CatalogTrainingCycle, CatalogTrainingCycleApiService } from './catalog-training-cycle-api-service';
import type { CatalogModuleApiService, CatalogModuleRecord } from './catalog-module-api-service';

const NEW_ROW_ID = 'new';
const CYCLE_TABLE_ID = 'catalog-training-cycle-table';
const MODULE_TABLE_ID = 'catalog-module-table';

const DUPLICATE_CYCLE_NAME_MESSAGE = 'Ya existe un ciclo con ese nombre';
const DUPLICATE_MODULE_NAME_MESSAGE = 'Ya existe un módulo con ese nombre y curso en este ciclo';

/**
 * Configuración — Ciclos/Módulos screen. Own top-level custom element, single Shadow DOM
 * (CLAUDE.md's "no nested Shadow DOM" rule). See views/configuracion/ui-spec.json
 * (`training-catalog-settings-screen`) for element design and
 * views/configuracion/use-cases.md UC-03/UC-04/UC-05 for the business rules implemented
 * here, and lib/patterns/crud-table-component.md for the inline-edit shape both tables
 * follow. `teacher-nav-link`/`training-catalog-nav-link`/`academic-year-nav-link` are
 * shared with the other two settings screens via the plain `renderSettingsNav` function.
 *
 * **2026-08-04 redesign**: `catalog_cycles`/`catalog_modules` are brand-new,
 * standalone tables with no relation to años académicos — nothing references this catalog,
 * so deletion is never dependency-blocked (cascade delete only) and editing a module always
 * saves immediately (no confirmation modal), unlike the old training_cycles/modules pair
 * that used to back Año académico.
 */
export class TrainingCatalogSettingsView extends SettingsScreenBase {
  private readonly _sessionServiceRef = new RequiredRef<SessionApiService>(
    'TrainingCatalogSettingsView.sessionService must be set before use',
  );
  private readonly _trainingCycleServiceRef = new RequiredRef<CatalogTrainingCycleApiService>(
    'TrainingCatalogSettingsView.trainingCycleService must be set before use',
  );
  private readonly _moduleServiceRef = new RequiredRef<CatalogModuleApiService>(
    'TrainingCatalogSettingsView.moduleService must be set before use',
  );

  private _authenticated = false;
  private _loaded = false;

  private _cycles: CatalogTrainingCycle[] = [];
  private _selectedCycleId: string | null = null;
  private _editingCycleId: string | null = null;
  private _cycleRowError: string | null = null;

  private _modules: CatalogModuleRecord[] = [];
  private _editingModuleId: string | null = null;
  private _addingModule = false;
  private _moduleRowError: string | null = null;

  set sessionService(value: SessionApiService) {
    this._sessionServiceRef.set(value);
  }

  get sessionService(): SessionApiService {
    return this._sessionServiceRef.get();
  }

  set trainingCycleService(value: CatalogTrainingCycleApiService) {
    this._trainingCycleServiceRef.set(value);
  }

  get trainingCycleService(): CatalogTrainingCycleApiService {
    return this._trainingCycleServiceRef.get();
  }

  set moduleService(value: CatalogModuleApiService) {
    this._moduleServiceRef.set(value);
  }

  get moduleService(): CatalogModuleApiService {
    return this._moduleServiceRef.get();
  }

  protected async _onConnected(): Promise<void> {
    const outcome = await this.sessionService.getSession();
    if (!outcome.authenticated) {
      redirectTo('/login');
      return;
    }
    this._authenticated = true;

    this._cycles = await this.trainingCycleService.list();
    this._loaded = true;
    this._selectedCycleId = this._cycles.length > 0 ? this._cycles[0]!.id : null;
    this._render();

    if (this._selectedCycleId !== null) {
      await this._loadModules(this._selectedCycleId);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------------------------

  protected _onElementClick(elementId: string): void {
    switch (elementId) {
      case 'catalog-training-cycle-table-add-button':
        this._startAddCycle();
        return;
      case 'catalog-module-table-add-button':
        this._startAddModule();
        return;
      default:
        break;
    }

    const cycleAction = parseRowAction(elementId, CYCLE_TABLE_ID);
    if (cycleAction) {
      void this._handleCycleRowAction(cycleAction);
      return;
    }
    const moduleAction = parseRowAction(elementId, MODULE_TABLE_ID);
    if (moduleAction) {
      void this._handleModuleRowAction(moduleAction);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Training cycles (catalog-training-cycle-table)
  // ---------------------------------------------------------------------------------------

  private _startAddCycle(): void {
    this._editingCycleId = NEW_ROW_ID;
    this._cycleRowError = null;
    this._render();
  }

  private async _handleCycleRowAction({ rowId, action }: RowAction): Promise<void> {
    switch (action) {
      case 'row':
        if (rowId === NEW_ROW_ID) return;
        this._selectCycle(rowId);
        return;
      case 'edit':
        this._editingCycleId = rowId;
        this._cycleRowError = null;
        this._render();
        return;
      case 'cancel':
        this._editingCycleId = null;
        this._cycleRowError = null;
        this._render();
        return;
      case 'save':
        await this._saveCycle(rowId);
        return;
      case 'delete':
        await this._deleteCycle(rowId);
        return;
      case 'name':
      case 'course':
      default:
        return;
    }
  }

  private _selectCycle(id: string): void {
    this._selectedCycleId = id;
    this._editingCycleId = null;
    this._cycleRowError = null;
    this._addingModule = false;
    this._editingModuleId = null;
    this._moduleRowError = null;
    this._render();
    void this._loadModules(id);
  }

  private async _loadModules(cycleId: string): Promise<void> {
    const modules = await this.moduleService.listForCycle(cycleId);
    if (this._selectedCycleId !== cycleId) return;
    this._modules = modules;
    this._render();
  }

  private async _saveCycle(rowId: string): Promise<void> {
    const name = this._query<HTMLInputElement>(`${CYCLE_TABLE_ID}-row-${rowId}-name`).value.trim();
    this._cycleRowError = null;

    const result =
      rowId === NEW_ROW_ID ? await this.trainingCycleService.create(name) : await this.trainingCycleService.rename(rowId, name);

    if (result.outcome === 'duplicate-name') {
      this._cycleRowError = DUPLICATE_CYCLE_NAME_MESSAGE;
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    if (rowId === NEW_ROW_ID) {
      this._cycles = [...this._cycles, result.value];
      this._selectCycle(result.value.id);
      return;
    }

    this._cycles = this._cycles.map((cycle) => (cycle.id === rowId ? result.value : cycle));
    this._editingCycleId = null;
    this._render();
  }

  private async _deleteCycle(id: string): Promise<void> {
    const result = await this.trainingCycleService.remove(id);
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._cycles = this._cycles.filter((cycle) => cycle.id !== id);

    if (this._selectedCycleId !== id) {
      this._render();
      return;
    }

    const next = this._cycles.length > 0 ? this._cycles[0]!.id : null;
    this._selectedCycleId = next;
    this._modules = [];
    this._render();
    if (next !== null) {
      await this._loadModules(next);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Modules (catalog-module-table)
  // ---------------------------------------------------------------------------------------

  private _startAddModule(): void {
    if (this._selectedCycleId === null) return;
    this._addingModule = true;
    this._editingModuleId = NEW_ROW_ID;
    this._moduleRowError = null;
    this._render();
  }

  private async _handleModuleRowAction({ rowId, action }: RowAction): Promise<void> {
    switch (action) {
      case 'edit':
        this._editingModuleId = rowId;
        this._moduleRowError = null;
        this._render();
        return;
      case 'cancel':
        this._editingModuleId = null;
        this._addingModule = false;
        this._moduleRowError = null;
        this._render();
        return;
      case 'save':
        await this._saveModule(rowId);
        return;
      case 'delete':
        await this._deleteModule(rowId);
        return;
      case 'row':
      case 'name':
      case 'course':
      default:
        return;
    }
  }

  private async _saveModule(rowId: string): Promise<void> {
    const name = this._query<HTMLInputElement>(`${MODULE_TABLE_ID}-row-${rowId}-name`).value.trim();
    const course = Number(this._query<HTMLSelectElement>(`${MODULE_TABLE_ID}-row-${rowId}-course`).value);
    this._moduleRowError = null;

    if (rowId === NEW_ROW_ID) {
      if (this._selectedCycleId === null) return;
      const result = await this.moduleService.create(this._selectedCycleId, name, course);
      if (result.outcome === 'duplicate-name') {
        this._moduleRowError = DUPLICATE_MODULE_NAME_MESSAGE;
        this._render();
        return;
      }
      if (result.outcome === 'not-found') {
        this._render();
        return;
      }
      this._modules = [...this._modules, result.value];
      this._addingModule = false;
      this._editingModuleId = null;
      this._render();
      return;
    }

    const result = await this.moduleService.update(rowId, { name, course });
    if (result.outcome === 'duplicate-name') {
      this._moduleRowError = DUPLICATE_MODULE_NAME_MESSAGE;
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._modules = this._modules.map((module) => (module.id === rowId ? result.value : module));
    this._editingModuleId = null;
    this._render();
  }

  private async _deleteModule(id: string): Promise<void> {
    const result = await this.moduleService.remove(id);
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._modules = this._modules.filter((module) => module.id !== id);
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
          ${renderSettingsNav('ciclos-modulos')} ${this._renderCycleSection()} ${this._renderModuleSection()}
        </div>
      `,
      this.shadowRoot!,
    );
  }

  private _renderCycleSection(): TemplateResult {
    const rows = [...this._cycles];
    if (this._editingCycleId === NEW_ROW_ID) {
      rows.push({ id: NEW_ROW_ID, name: '' });
    }

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Ciclos</h2>
          <button
            type="button"
            class="${classesFor('button', 'secondary', 'sm')}"
            data-element-id="catalog-training-cycle-table-add-button"
          >
            Añadir ciclo
          </button>
        </div>

        <table class="${classesFor('table')}" data-element-id="catalog-training-cycle-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? html`<tr><td colspan="2">Todavía no has creado ningún ciclo.</td></tr>` : ''}
            ${rows.map((cycle) => this._renderCycleRow(cycle))}
          </tbody>
        </table>
      </section>
    `;
  }

  private _renderCycleRow(cycle: CatalogTrainingCycle): TemplateResult {
    if (this._editingCycleId === cycle.id) {
      return html`
        <tr data-element-id="catalog-training-cycle-table-row-${cycle.id}">
          <td>
            <input
              class="${classesFor('text-input', undefined, 'md')}"
              data-element-id="catalog-training-cycle-table-row-${cycle.id}-name"
              type="text"
              .value=${cycle.name}
            />
          </td>
          <td class="flex gap-2">
            <button
              type="button"
              class="${classesFor('button', 'primary', 'sm')}"
              data-element-id="catalog-training-cycle-table-row-${cycle.id}-save"
            >
              Guardar
            </button>
            <button
              type="button"
              class="${classesFor('button', 'ghost', 'sm')}"
              data-element-id="catalog-training-cycle-table-row-${cycle.id}-cancel"
            >
              Cancelar
            </button>
          </td>
        </tr>
        ${this._cycleRowError !== null
          ? html`<tr><td colspan="2" class="${classesFor('paragraph', 'danger', 'sm')}">${this._cycleRowError}</td></tr>`
          : ''}
      `;
    }

    const isSelected = this._selectedCycleId === cycle.id;
    return html`
      <tr
        data-element-id="catalog-training-cycle-table-row-${cycle.id}"
        class="cursor-pointer ${isSelected ? 'bg-slate-100' : ''}"
      >
        <td>${cycle.name}</td>
        <td class="flex gap-2">
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="catalog-training-cycle-table-row-${cycle.id}-edit"
          >
            Editar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'danger', 'sm')}"
            data-element-id="catalog-training-cycle-table-row-${cycle.id}-delete"
          >
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }

  private _renderModuleSection(): TemplateResult {
    const rows: CatalogModuleRecord[] = [...this._modules].sort(
      (a, b) => a.course - b.course || a.name.localeCompare(b.name),
    );
    if (this._addingModule && this._selectedCycleId !== null) {
      rows.push({ id: NEW_ROW_ID, catalogTrainingCycleId: this._selectedCycleId, course: 1, name: '' });
    }

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Módulos</h2>
          <button
            type="button"
            class="${classesFor('button', 'secondary', 'sm')}"
            data-element-id="catalog-module-table-add-button"
            ?disabled=${this._selectedCycleId === null}
          >
            Añadir módulo
          </button>
        </div>

        <table class="${classesFor('table')}" data-element-id="catalog-module-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Curso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${this._renderModuleTableBody(rows)}</tbody>
        </table>
      </section>
    `;
  }

  private _renderModuleTableBody(rows: CatalogModuleRecord[]): TemplateResult {
    if (this._selectedCycleId === null) {
      return html`<tr><td colspan="3">Elige o crea un ciclo para ver sus módulos.</td></tr>`;
    }
    if (rows.length === 0) {
      return html`<tr><td colspan="3">Este ciclo todavía no tiene módulos.</td></tr>`;
    }
    return this._renderModuleRows(rows);
  }

  private _renderModuleRows(rows: CatalogModuleRecord[]): TemplateResult {
    const rendered: TemplateResult[] = [];
    let lastCourse: number | null = null;
    for (const module of rows) {
      if (module.id !== NEW_ROW_ID && module.course !== lastCourse) {
        rendered.push(
          html`<tr>
            <td colspan="3" class="${classesFor('paragraph', undefined, 'sm')} pt-2 font-semibold">${module.course}º</td>
          </tr>`,
        );
        lastCourse = module.course;
      }
      rendered.push(this._renderModuleRow(module));
    }
    return html`${rendered}`;
  }

  private _renderModuleRow(module: CatalogModuleRecord): TemplateResult {
    if (this._editingModuleId === module.id) {
      return html`
        <tr data-element-id="catalog-module-table-row-${module.id}">
          <td>
            <input
              class="${classesFor('text-input', undefined, 'md')}"
              data-element-id="catalog-module-table-row-${module.id}-name"
              type="text"
              .value=${module.name}
            />
          </td>
          <td>
            <select
              class="${classesFor('select', undefined, 'md')}"
              data-element-id="catalog-module-table-row-${module.id}-course"
              .value=${String(module.course)}
            >
              <option value="1">1º</option>
              <option value="2">2º</option>
            </select>
          </td>
          <td class="flex gap-2">
            <button
              type="button"
              class="${classesFor('button', 'primary', 'sm')}"
              data-element-id="catalog-module-table-row-${module.id}-save"
            >
              Guardar
            </button>
            <button
              type="button"
              class="${classesFor('button', 'ghost', 'sm')}"
              data-element-id="catalog-module-table-row-${module.id}-cancel"
            >
              Cancelar
            </button>
          </td>
        </tr>
        ${this._moduleRowError !== null
          ? html`<tr><td colspan="3" class="${classesFor('paragraph', 'danger', 'sm')}">${this._moduleRowError}</td></tr>`
          : ''}
      `;
    }

    return html`
      <tr data-element-id="catalog-module-table-row-${module.id}">
        <td>${module.name}</td>
        <td>${module.course}º</td>
        <td class="flex gap-2">
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="catalog-module-table-row-${module.id}-edit"
          >
            Editar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'danger', 'sm')}"
            data-element-id="catalog-module-table-row-${module.id}-delete"
          >
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }
}

customElements.define('app-training-catalog-settings-view', TrainingCatalogSettingsView);
