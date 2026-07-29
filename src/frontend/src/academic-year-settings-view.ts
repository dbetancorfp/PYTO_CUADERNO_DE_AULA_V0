import { html, render, type TemplateResult } from 'lit-html';
import { attachSharedStyles } from './styles/shadow-styles';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { handleSettingsNavClick, renderSettingsNav } from './settings-nav';
import type { SessionApiService } from './session-api-service';
import type { TrainingCycle, TrainingCycleApiService } from './training-cycle-api-service';
import type { ModuleApiService, ModuleRecord, ModuleWithCycleName } from './module-api-service';
import type { AcademicYear, AcademicYearApiService } from './academic-year-api-service';
import type { AcademicYearRef } from './api-outcomes';

const NEW_ROW_ID = 'new';

type RowActionKind = 'row' | 'edit' | 'cancel' | 'save' | 'delete' | 'set-current' | 'checkbox' | 'name' | 'course';

interface RowAction {
  rowId: string;
  action: RowActionKind;
}

const ROW_ACTION_SUFFIXES: readonly RowActionKind[] = [
  'set-current',
  'checkbox',
  'cancel',
  'save',
  'edit',
  'delete',
  'name',
  'course',
];

/**
 * Parses a `<tableId>-row-<id>[-<action>]` elementId (the shared inline-edit-row DOM
 * convention documented identically in every RED test file for this view — see e.g.
 * `academic-year-settings-view.test.ts`'s header comment) into the row id it targets and
 * which action was clicked. Returns `null` when `elementId` isn't a row of `tableId` at
 * all, so callers can try the next table.
 */
function parseRowAction(elementId: string, tableId: string): RowAction | null {
  const prefix = `${tableId}-row-`;
  if (!elementId.startsWith(prefix)) {
    return null;
  }
  const rest = elementId.slice(prefix.length);
  for (const suffix of ROW_ACTION_SUFFIXES) {
    if (rest.endsWith(`-${suffix}`)) {
      return { rowId: rest.slice(0, rest.length - suffix.length - 1), action: suffix };
    }
  }
  return { rowId: rest, action: 'row' };
}

interface PendingModuleEdit {
  id: string;
  changes: { name: string; course: number };
  academicYears: AcademicYearRef[];
}

/**
 * Configuración — Año académico screen. Own top-level custom element, single Shadow DOM
 * (CLAUDE.md's "no nested Shadow DOM" rule) — every table below (academic years, training
 * cycles, modules, module selection) is rendered inline within this same component's own
 * render tree, never as a separate nested custom element. See
 * views/configuracion/ui-spec.json (`academic-year-settings-screen`) for element design,
 * views/configuracion/use-cases.md UC-03..UC-07 for the business rules implemented here,
 * and lib/patterns/crud-table-component.md / lib/patterns/cascading-select.md for the
 * shapes followed throughout. `teacher-nav-link`/`academic-year-nav-link` are shared with
 * `teacher-settings-view.ts` via the plain `renderSettingsNav` function.
 */
export class AcademicYearSettingsView extends HTMLElement {
  private _sessionService: SessionApiService | null = null;
  private _trainingCycleService: TrainingCycleApiService | null = null;
  private _moduleService: ModuleApiService | null = null;
  private _academicYearService: AcademicYearApiService | null = null;

  private _authenticated = false;
  private _loaded = false;

  private _academicYears: AcademicYear[] = [];
  private _trainingCycles: TrainingCycle[] = [];
  private _allModules: ModuleWithCycleName[] = [];

  private _editingYearId: string | null = null;
  private _addingYear = false;
  private _yearRowError: string | null = null;
  private _yearDeleteBlockedMessage: string | null = null;

  private _editingCycleId: string | null = null;
  private _addingCycle = false;
  private _cycleRowError: string | null = null;
  private _cycleDeleteBlockedMessage: string | null = null;

  private _selectedCycleId: string | null = null;
  private _cycleModules: ModuleRecord[] = [];
  private _editingModuleId: string | null = null;
  private _addingModule = false;
  private _moduleRowError: string | null = null;
  private _moduleDeleteBlockedMessage: string | null = null;
  private _pendingModuleEdit: PendingModuleEdit | null = null;

  private _selectedYearId: string | null = null;
  private _selectedModuleIds: Set<string> = new Set();
  private _selectionSaving = false;

  private _disposables: Array<() => void> = [];

  set sessionService(value: SessionApiService) {
    this._sessionService = value;
  }

  get sessionService(): SessionApiService {
    if (this._sessionService === null) {
      throw new Error('AcademicYearSettingsView.sessionService must be set before use');
    }
    return this._sessionService;
  }

  set trainingCycleService(value: TrainingCycleApiService) {
    this._trainingCycleService = value;
  }

  get trainingCycleService(): TrainingCycleApiService {
    if (this._trainingCycleService === null) {
      throw new Error('AcademicYearSettingsView.trainingCycleService must be set before use');
    }
    return this._trainingCycleService;
  }

  set moduleService(value: ModuleApiService) {
    this._moduleService = value;
  }

  get moduleService(): ModuleApiService {
    if (this._moduleService === null) {
      throw new Error('AcademicYearSettingsView.moduleService must be set before use');
    }
    return this._moduleService;
  }

  set academicYearService(value: AcademicYearApiService) {
    this._academicYearService = value;
  }

  get academicYearService(): AcademicYearApiService {
    if (this._academicYearService === null) {
      throw new Error('AcademicYearSettingsView.academicYearService must be set before use');
    }
    return this._academicYearService;
  }

  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    attachSharedStyles(this.shadowRoot!);
    this._render();

    const onClick = (event: Event): void => this._handleClick(event);
    const onChange = (event: Event): void => this._handleChange(event);
    this.shadowRoot!.addEventListener('click', onClick);
    this.shadowRoot!.addEventListener('change', onChange);
    this._disposables.push(() => this.shadowRoot!.removeEventListener('click', onClick));
    this._disposables.push(() => this.shadowRoot!.removeEventListener('change', onChange));

    void this._init();
  }

  disconnectedCallback(): void {
    this._disposables.forEach((dispose) => dispose());
    this._disposables = [];
  }

  private async _init(): Promise<void> {
    const outcome = await this.sessionService.getSession();
    if (!outcome.authenticated) {
      redirectTo('/login');
      return;
    }
    this._authenticated = true;

    const [academicYears, trainingCycles, allModules] = await Promise.all([
      this.academicYearService.list(),
      this.trainingCycleService.list(),
      this.moduleService.listAll(),
    ]);
    this._academicYears = academicYears;
    this._trainingCycles = trainingCycles;
    this._allModules = allModules;
    this._loaded = true;
    this._render();
  }

  private _query<T extends Element>(elementId: string): T {
    return this.shadowRoot!.querySelector<T>(`[data-element-id="${elementId}"]`)!;
  }

  // ---------------------------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------------------------

  private _handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;

    if (handleSettingsNavClick(elementId)) return;

    switch (elementId) {
      case 'academic-year-table-add-button':
        this._startAddYear();
        return;
      case 'training-cycle-table-add-button':
        this._startAddCycle();
        return;
      case 'module-table-add-button':
        this._startAddModule();
        return;
      case 'module-selection-save-button':
        void this._saveSelection();
        return;
      case 'module-edit-confirm-modal-confirm':
        void this._confirmModuleEdit();
        return;
      case 'module-edit-confirm-modal-cancel':
        this._cancelModuleEdit();
        return;
      default:
        break;
    }

    const yearAction = parseRowAction(elementId, 'academic-year-table');
    if (yearAction) {
      void this._handleYearRowAction(yearAction);
      return;
    }
    const cycleAction = parseRowAction(elementId, 'training-cycle-table');
    if (cycleAction) {
      void this._handleCycleRowAction(cycleAction);
      return;
    }
    const moduleAction = parseRowAction(elementId, 'module-table');
    if (moduleAction) {
      void this._handleModuleRowAction(moduleAction);
    }
  }

  private _handleChange(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;

    if (elementId === 'module-cycle-select') {
      const value = (target as HTMLSelectElement).value;
      this._selectedCycleId = value.length > 0 ? value : null;
      this._addingModule = false;
      this._editingModuleId = null;
      this._moduleRowError = null;
      if (this._selectedCycleId !== null) {
        void this._loadModulesForCycle(this._selectedCycleId);
      } else {
        this._cycleModules = [];
        this._render();
      }
      return;
    }

    const selectionAction = parseRowAction(elementId, 'module-selection-table');
    if (selectionAction && selectionAction.action === 'checkbox') {
      this._toggleModuleSelection(selectionAction.rowId, (target as HTMLInputElement).checked);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Academic years
  // ---------------------------------------------------------------------------------------

  private _startAddYear(): void {
    this._addingYear = true;
    this._editingYearId = NEW_ROW_ID;
    this._yearRowError = null;
    this._render();
  }

  private async _handleYearRowAction({ rowId, action }: RowAction): Promise<void> {
    switch (action) {
      case 'row':
        this._selectYear(rowId);
        return;
      case 'edit':
        this._editingYearId = rowId;
        this._yearRowError = null;
        this._render();
        return;
      case 'cancel':
        this._editingYearId = null;
        this._addingYear = false;
        this._yearRowError = null;
        this._render();
        return;
      case 'save':
        await this._saveYear(rowId);
        return;
      case 'delete':
        await this._deleteYear(rowId);
        return;
      case 'set-current':
        await this._setCurrentYear(rowId);
        return;
      case 'name':
      case 'course':
      default:
        return;
    }
  }

  private _selectYear(id: string): void {
    this._selectedYearId = id;
    this._selectedModuleIds = new Set();
    this._render();
    void this._loadSelection(id);
  }

  private async _loadSelection(id: string): Promise<void> {
    const moduleIds = await this.academicYearService.getSelection(id);
    if (this._selectedYearId !== id) return;
    this._selectedModuleIds = new Set(moduleIds);
    this._render();
  }

  private async _saveYear(rowId: string): Promise<void> {
    const name = this._query<HTMLInputElement>(`academic-year-table-row-${rowId}-name`).value.trim();
    this._yearRowError = null;

    const result =
      rowId === NEW_ROW_ID ? await this.academicYearService.create(name) : await this.academicYearService.rename(rowId, name);

    if (result.outcome === 'duplicate-name') {
      this._yearRowError = 'Ya existe un año académico con ese nombre';
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    if (rowId === NEW_ROW_ID) {
      this._academicYears = [...this._academicYears, result.value];
      this._addingYear = false;
    } else {
      this._academicYears = this._academicYears.map((year) => (year.id === rowId ? result.value : year));
    }
    this._editingYearId = null;
    this._render();
  }

  private async _deleteYear(id: string): Promise<void> {
    this._yearDeleteBlockedMessage = null;
    const result = await this.academicYearService.remove(id);

    if (result.outcome === 'is-current') {
      this._yearDeleteBlockedMessage = 'No se puede eliminar el año académico marcado como en curso';
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._academicYears = this._academicYears.filter((year) => year.id !== id);
    if (this._selectedYearId === id) {
      this._selectedYearId = null;
      this._selectedModuleIds = new Set();
    }
    this._render();
  }

  private async _setCurrentYear(id: string): Promise<void> {
    const result = await this.academicYearService.setCurrent(id);
    if (result.outcome !== 'success') {
      this._render();
      return;
    }
    this._academicYears = this._academicYears.map((year) => ({ ...year, isCurrent: year.id === id }));
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Training cycles
  // ---------------------------------------------------------------------------------------

  private _startAddCycle(): void {
    this._addingCycle = true;
    this._editingCycleId = NEW_ROW_ID;
    this._cycleRowError = null;
    this._render();
  }

  private async _handleCycleRowAction({ rowId, action }: RowAction): Promise<void> {
    switch (action) {
      case 'row':
        this._selectCycle(rowId);
        return;
      case 'edit':
        this._editingCycleId = rowId;
        this._cycleRowError = null;
        this._render();
        return;
      case 'cancel':
        this._editingCycleId = null;
        this._addingCycle = false;
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
    this._addingModule = false;
    this._editingModuleId = null;
    this._moduleRowError = null;
    void this._loadModulesForCycle(id);
  }

  private async _saveCycle(rowId: string): Promise<void> {
    const name = this._query<HTMLInputElement>(`training-cycle-table-row-${rowId}-name`).value.trim();
    this._cycleRowError = null;

    const result =
      rowId === NEW_ROW_ID ? await this.trainingCycleService.create(name) : await this.trainingCycleService.rename(rowId, name);

    if (result.outcome === 'duplicate-name') {
      this._cycleRowError = 'Ya existe un ciclo con ese nombre';
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    if (rowId === NEW_ROW_ID) {
      this._trainingCycles = [...this._trainingCycles, result.value];
      this._addingCycle = false;
    } else {
      this._trainingCycles = this._trainingCycles.map((cycle) => (cycle.id === rowId ? result.value : cycle));
    }
    this._editingCycleId = null;
    this._render();
  }

  private async _deleteCycle(id: string): Promise<void> {
    this._cycleDeleteBlockedMessage = null;
    const result = await this.trainingCycleService.remove(id);

    if (result.outcome === 'has-dependents') {
      this._cycleDeleteBlockedMessage = `No se puede eliminar: sus módulos están seleccionados en ${formatAcademicYearNames(result.academicYears)}`;
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._trainingCycles = this._trainingCycles.filter((cycle) => cycle.id !== id);
    if (this._selectedCycleId === id) {
      this._selectedCycleId = null;
      this._cycleModules = [];
    }
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Modules
  // ---------------------------------------------------------------------------------------

  private async _loadModulesForCycle(cycleId: string): Promise<void> {
    this._cycleModules = await this.moduleService.listForCycle(cycleId);
    this._render();
  }

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
      case 'name':
      case 'course':
      default:
        return;
    }
  }

  private async _saveModule(rowId: string): Promise<void> {
    const name = this._query<HTMLInputElement>(`module-table-row-${rowId}-name`).value.trim();
    const course = Number(this._query<HTMLSelectElement>(`module-table-row-${rowId}-course`).value);
    this._moduleRowError = null;

    if (rowId === NEW_ROW_ID) {
      if (this._selectedCycleId === null) return;
      const result = await this.moduleService.create(this._selectedCycleId, name, course);
      if (result.outcome === 'duplicate-name') {
        this._moduleRowError = 'Ya existe un módulo con ese nombre y curso en este ciclo';
        this._render();
        return;
      }
      if (result.outcome === 'not-found') {
        this._render();
        return;
      }
      this._cycleModules = [...this._cycleModules, result.value];
      this._addingModule = false;
      this._editingModuleId = null;
      this._render();
      return;
    }

    const changes = { name, course };
    const result = await this.moduleService.update(rowId, changes);

    if (result.outcome === 'has-dependents') {
      this._pendingModuleEdit = { id: rowId, changes, academicYears: result.academicYears };
      this._render();
      return;
    }
    if (result.outcome === 'duplicate-name') {
      this._moduleRowError = 'Ya existe un módulo con ese nombre y curso en este ciclo';
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._cycleModules = this._cycleModules.map((module) => (module.id === rowId ? result.value : module));
    this._editingModuleId = null;
    this._render();
  }

  private async _confirmModuleEdit(): Promise<void> {
    const pending = this._pendingModuleEdit;
    if (!pending) return;

    const result = await this.moduleService.update(pending.id, pending.changes, true);
    this._pendingModuleEdit = null;

    if (result.outcome === 'success') {
      this._cycleModules = this._cycleModules.map((module) => (module.id === pending.id ? result.value : module));
    }
    this._editingModuleId = null;
    this._render();
  }

  private _cancelModuleEdit(): void {
    this._pendingModuleEdit = null;
    this._editingModuleId = null;
    this._render();
  }

  private async _deleteModule(id: string): Promise<void> {
    this._moduleDeleteBlockedMessage = null;
    const result = await this.moduleService.remove(id);

    if (result.outcome === 'has-dependents') {
      this._moduleDeleteBlockedMessage = `No se puede eliminar: seleccionado en ${formatAcademicYearNames(result.academicYears)}`;
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._cycleModules = this._cycleModules.filter((module) => module.id !== id);
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Module selection
  // ---------------------------------------------------------------------------------------

  private _toggleModuleSelection(moduleId: string, checked: boolean): void {
    if (checked) {
      this._selectedModuleIds.add(moduleId);
    } else {
      this._selectedModuleIds.delete(moduleId);
    }
    this._render();
  }

  private async _saveSelection(): Promise<void> {
    if (this._selectedYearId === null) return;
    this._selectionSaving = true;
    this._render();

    await this.academicYearService.replaceSelection(this._selectedYearId, Array.from(this._selectedModuleIds));

    this._selectionSaving = false;
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------------------

  private _render(): void {
    if (!this._authenticated || !this._loaded) {
      render(html``, this.shadowRoot!);
      return;
    }

    render(
      html`
        <div class="flex flex-col gap-8 p-4">
          ${renderSettingsNav('ano-academico')} ${this._renderAcademicYearSection()} ${this._renderTrainingCycleSection()}
          ${this._renderModuleSection()} ${this._renderModuleSelectionSection()}
        </div>
        ${this._renderModuleEditConfirmModal()}
      `,
      this.shadowRoot!,
    );
  }

  private _renderAcademicYearSection(): TemplateResult {
    const rows = [...this._academicYears];
    if (this._addingYear) {
      rows.push({ id: NEW_ROW_ID, name: '', isCurrent: false });
    }

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Años académicos</h2>
          <button
            type="button"
            class="${classesFor('button', 'secondary', 'sm')}"
            data-element-id="academic-year-table-add-button"
          >
            Añadir año académico
          </button>
        </div>

        ${this._yearDeleteBlockedMessage !== null
          ? html`<p
              class="${classesFor('paragraph', 'danger', 'sm')}"
              data-element-id="academic-year-delete-blocked-message"
              aria-live="assertive"
            >
              ${this._yearDeleteBlockedMessage}
            </p>`
          : ''}

        <table class="${classesFor('table')}" data-element-id="academic-year-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>En curso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? html`<tr><td colspan="3">Todavía no has creado ningún año académico.</td></tr>` : ''}
            ${rows.map((year) => this._renderAcademicYearRow(year))}
          </tbody>
        </table>
      </section>
    `;
  }

  private _renderAcademicYearRow(year: AcademicYear): TemplateResult {
    if (this._editingYearId === year.id) {
      return html`
        <tr data-element-id="academic-year-table-row-${year.id}">
          <td>
            <input
              class="${classesFor('text-input', undefined, 'md')}"
              data-element-id="academic-year-table-row-${year.id}-name"
              type="text"
              .value=${year.name}
            />
          </td>
          <td></td>
          <td class="flex gap-2">
            <button
              type="button"
              class="${classesFor('button', 'primary', 'sm')}"
              data-element-id="academic-year-table-row-${year.id}-save"
            >
              Guardar
            </button>
            <button
              type="button"
              class="${classesFor('button', 'ghost', 'sm')}"
              data-element-id="academic-year-table-row-${year.id}-cancel"
            >
              Cancelar
            </button>
          </td>
        </tr>
        ${this._yearRowError !== null
          ? html`<tr><td colspan="3" class="${classesFor('paragraph', 'danger', 'sm')}">${this._yearRowError}</td></tr>`
          : ''}
      `;
    }

    const isSelected = this._selectedYearId === year.id;
    return html`
      <tr
        data-element-id="academic-year-table-row-${year.id}"
        class="cursor-pointer ${isSelected ? 'bg-slate-100' : ''}"
      >
        <td>${year.name}</td>
        <td>${year.isCurrent ? html`<span class="${classesFor('badge', 'primary')}">En curso</span>` : ''}</td>
        <td class="flex gap-2">
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="academic-year-table-row-${year.id}-set-current"
          >
            Marcar en curso
          </button>
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="academic-year-table-row-${year.id}-edit"
          >
            Editar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'danger', 'sm')}"
            data-element-id="academic-year-table-row-${year.id}-delete"
          >
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }

  private _renderTrainingCycleSection(): TemplateResult {
    const rows = [...this._trainingCycles];
    if (this._addingCycle) {
      rows.push({ id: NEW_ROW_ID, name: '' });
    }

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Ciclos</h2>
          <button
            type="button"
            class="${classesFor('button', 'secondary', 'sm')}"
            data-element-id="training-cycle-table-add-button"
          >
            Añadir ciclo
          </button>
        </div>

        ${this._cycleDeleteBlockedMessage !== null
          ? html`<p
              class="${classesFor('paragraph', 'danger', 'sm')}"
              data-element-id="training-cycle-delete-blocked-message"
              aria-live="assertive"
            >
              ${this._cycleDeleteBlockedMessage}
            </p>`
          : ''}

        <table class="${classesFor('table')}" data-element-id="training-cycle-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? html`<tr><td colspan="2">Todavía no has creado ningún ciclo.</td></tr>` : ''}
            ${rows.map((cycle) => this._renderTrainingCycleRow(cycle))}
          </tbody>
        </table>
      </section>
    `;
  }

  private _renderTrainingCycleRow(cycle: TrainingCycle): TemplateResult {
    if (this._editingCycleId === cycle.id) {
      return html`
        <tr data-element-id="training-cycle-table-row-${cycle.id}">
          <td>
            <input
              class="${classesFor('text-input', undefined, 'md')}"
              data-element-id="training-cycle-table-row-${cycle.id}-name"
              type="text"
              .value=${cycle.name}
            />
          </td>
          <td class="flex gap-2">
            <button
              type="button"
              class="${classesFor('button', 'primary', 'sm')}"
              data-element-id="training-cycle-table-row-${cycle.id}-save"
            >
              Guardar
            </button>
            <button
              type="button"
              class="${classesFor('button', 'ghost', 'sm')}"
              data-element-id="training-cycle-table-row-${cycle.id}-cancel"
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
        data-element-id="training-cycle-table-row-${cycle.id}"
        class="cursor-pointer ${isSelected ? 'bg-slate-100' : ''}"
      >
        <td>${cycle.name}</td>
        <td class="flex gap-2">
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="training-cycle-table-row-${cycle.id}-edit"
          >
            Editar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'danger', 'sm')}"
            data-element-id="training-cycle-table-row-${cycle.id}-delete"
          >
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }

  private _renderModuleSection(): TemplateResult {
    const rows: ModuleRecord[] = [...this._cycleModules].sort(
      (a, b) => a.course - b.course || a.name.localeCompare(b.name),
    );
    if (this._addingModule && this._selectedCycleId !== null) {
      rows.push({ id: NEW_ROW_ID, trainingCycleId: this._selectedCycleId, course: 1, name: '' });
    }

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Módulos</h2>
          <button
            type="button"
            class="${classesFor('button', 'secondary', 'sm')}"
            data-element-id="module-table-add-button"
            ?disabled=${this._selectedCycleId === null}
          >
            Añadir módulo
          </button>
        </div>

        <select
          class="${classesFor('select', undefined, 'md')}"
          data-element-id="module-cycle-select"
          .value=${this._selectedCycleId ?? ''}
        >
          <option value="">-- Selecciona un ciclo --</option>
          ${this._trainingCycles.map((cycle) => html`<option value=${cycle.id}>${cycle.name}</option>`)}
        </select>

        ${this._moduleDeleteBlockedMessage !== null
          ? html`<p
              class="${classesFor('paragraph', 'danger', 'sm')}"
              data-element-id="module-delete-blocked-message"
              aria-live="assertive"
            >
              ${this._moduleDeleteBlockedMessage}
            </p>`
          : ''}

        <table class="${classesFor('table')}" data-element-id="module-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Curso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${this._selectedCycleId === null
              ? html`<tr><td colspan="3">Elige un ciclo para ver sus módulos.</td></tr>`
              : rows.length === 0
                ? html`<tr><td colspan="3">Este ciclo todavía no tiene módulos.</td></tr>`
                : this._renderModuleRows(rows)}
          </tbody>
        </table>
      </section>
    `;
  }

  private _renderModuleRows(rows: ModuleRecord[]): TemplateResult {
    const rendered: TemplateResult[] = [];
    let lastCourse: number | null = null;
    for (const module of rows) {
      if (module.course !== lastCourse) {
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

  private _renderModuleRow(module: ModuleRecord): TemplateResult {
    if (this._editingModuleId === module.id) {
      return html`
        <tr data-element-id="module-table-row-${module.id}">
          <td>
            <input
              class="${classesFor('text-input', undefined, 'md')}"
              data-element-id="module-table-row-${module.id}-name"
              type="text"
              .value=${module.name}
            />
          </td>
          <td>
            <select
              class="${classesFor('select', undefined, 'md')}"
              data-element-id="module-table-row-${module.id}-course"
              .value=${String(module.course)}
            >
              <option value="1">1º</option>
              <option value="2">2º</option>
              <option value="3">3º</option>
            </select>
          </td>
          <td class="flex gap-2">
            <button
              type="button"
              class="${classesFor('button', 'primary', 'sm')}"
              data-element-id="module-table-row-${module.id}-save"
            >
              Guardar
            </button>
            <button
              type="button"
              class="${classesFor('button', 'ghost', 'sm')}"
              data-element-id="module-table-row-${module.id}-cancel"
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
      <tr data-element-id="module-table-row-${module.id}">
        <td>${module.name}</td>
        <td>${module.course}º</td>
        <td class="flex gap-2">
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="module-table-row-${module.id}-edit"
          >
            Editar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'danger', 'sm')}"
            data-element-id="module-table-row-${module.id}-delete"
          >
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }

  private _renderModuleEditConfirmModal(): TemplateResult | string {
    if (this._pendingModuleEdit === null) {
      return '';
    }
    const names = formatAcademicYearNames(this._pendingModuleEdit.academicYears);

    return html`
      <div class="${classesFor('modal')}" data-element-id="module-edit-confirm-modal">
        <div class="${classesFor('card', undefined, undefined)} flex flex-col gap-4 p-6">
          <p>Este módulo está seleccionado en: ${names}. ¿Confirmas los cambios?</p>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="${classesFor('button', 'primary', 'sm')}"
              data-element-id="module-edit-confirm-modal-confirm"
            >
              Confirmar
            </button>
            <button
              type="button"
              class="${classesFor('button', 'ghost', 'sm')}"
              data-element-id="module-edit-confirm-modal-cancel"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderModuleSelectionSection(): TemplateResult {
    return html`
      <section class="flex flex-col gap-2">
        <h2 class="${classesFor('heading')}">Selección de módulos del año académico</h2>
        ${this._renderModuleSelectionTable()}
        <button
          type="button"
          class="${classesFor('submit-button', 'primary', 'md')}"
          data-element-id="module-selection-save-button"
          ?disabled=${this._selectedYearId === null || this._selectionSaving}
        >
          ${this._selectionSaving ? 'Guardando…' : 'Guardar selección'}
        </button>
      </section>
    `;
  }

  private _renderModuleSelectionTable(): TemplateResult {
    if (this._selectedYearId === null) {
      return html`<p data-element-id="module-selection-table">
        Selecciona un año académico arriba para gestionar su selección de módulos.
      </p>`;
    }
    if (this._allModules.length === 0) {
      return html`<p data-element-id="module-selection-table">
        Todavía no tienes ciclos ni módulos creados — créalos arriba antes de seleccionar módulos para este año.
      </p>`;
    }

    const sorted = [...this._allModules].sort(
      (a, b) =>
        a.trainingCycleName.localeCompare(b.trainingCycleName) || a.course - b.course || a.name.localeCompare(b.name),
    );

    return html`
      <table class="${classesFor('table')}" data-element-id="module-selection-table">
        <thead>
          <tr>
            <th>Ciclo</th>
            <th>Curso</th>
            <th>Módulo</th>
            <th>Seleccionado</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(
            (module) => html`
              <tr data-element-id="module-selection-table-row-${module.id}">
                <td>${module.trainingCycleName}</td>
                <td>${module.course}º</td>
                <td>${module.name}</td>
                <td>
                  <input
                    type="checkbox"
                    class="${classesFor('checkbox')}"
                    data-element-id="module-selection-table-row-${module.id}-checkbox"
                    .checked=${this._selectedModuleIds.has(module.id)}
                  />
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }
}

function formatAcademicYearNames(academicYears: AcademicYearRef[]): string {
  return academicYears.map((year) => year.name).join(', ');
}

customElements.define('app-academic-year-settings-view', AcademicYearSettingsView);
