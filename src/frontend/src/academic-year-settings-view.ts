import { html, render, type TemplateResult } from 'lit-html';
import { attachSharedStyles } from './styles/shadow-styles';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { handleSettingsNavClick, renderSettingsNav } from './settings-nav';
import type { SessionApiService } from './session-api-service';
import type { TrainingCycle, TrainingCycleApiService } from './training-cycle-api-service';
import type { ModuleApiService, ModuleRecord } from './module-api-service';
import type { AcademicYear, AcademicYearApiService } from './academic-year-api-service';
import type { AcademicYearRef } from './api-outcomes';

const NEW_ROW_ID = 'new';

type ScreenMode = 'normal' | 'adding-year' | 'adding-cycle';

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
 *
 * **Three modes** (reopened 2026-07-30, see functional-spec.json's `appOverview`):
 * - `normal`: an existing academic year is selected. `training-cycle-table` shows only the
 *   cycles with >=1 module selected for that year; `module-table` shows that cycle's
 *   modules selected for the year; `module-selection-table` and its add/save controls are
 *   not rendered at all.
 * - `adding-year`: `academic-year-table-add-button` was clicked. `training-cycle-table`
 *   shows the teacher's complete, unfiltered cycle list; `module-table` is replaced by
 *   `module-selection-table`, which builds an in-progress selection
 *   (`_selectedModuleIds`) that `module-selection-save-button` persists by creating the
 *   academic year and replacing its selection in one user action (two sequential requests).
 * - `adding-cycle`: entered when a brand-new cycle is saved via
 *   `training-cycle-table-add-button` while an existing academic year was selected (not
 *   already `adding-year`). Same `module-selection-table` takeover, scoped to the new
 *   cycle; `module-selection-save-button` only replaces the selection — the academic year
 *   already exists.
 */
export class AcademicYearSettingsView extends HTMLElement {
  private _sessionService: SessionApiService | null = null;
  private _trainingCycleService: TrainingCycleApiService | null = null;
  private _moduleService: ModuleApiService | null = null;
  private _academicYearService: AcademicYearApiService | null = null;

  private _authenticated = false;
  private _loaded = false;

  private _mode: ScreenMode = 'normal';

  // Academic years
  private _academicYears: AcademicYear[] = [];
  private _selectedYearId: string | null = null;
  private _editingYearId: string | null = null;
  private _yearRowError: string | null = null;
  private _yearDeleteBlockedMessage: string | null = null;

  // Training cycles — single table, content depends on `_mode` (year-filtered vs. complete)
  private _trainingCycles: TrainingCycle[] = [];
  private _selectedCycleId: string | null = null;
  private _editingCycleId: string | null = null;
  private _cycleRowError: string | null = null;
  private _cycleDeleteBlockedMessage: string | null = null;

  // module-table (normal mode only) — the selected cycle's modules selected for the
  // selected academic year, plus the full persisted selection for that year (used to
  // preserve other cycles' selections when module-table-add-button adds a module).
  private _normalModeModules: ModuleRecord[] = [];
  private _yearModuleSelection: Set<string> = new Set();
  private _editingModuleId: string | null = null;
  private _addingModule = false;
  private _moduleRowError: string | null = null;
  private _moduleDeleteBlockedMessage: string | null = null;
  private _pendingModuleEdit: PendingModuleEdit | null = null;

  // module-selection-table (adding-year / adding-cycle modes only)
  private _selectionCycleModules: ModuleRecord[] = [];
  private _selectedModuleIds: Set<string> = new Set();
  private _addingSelectionModule = false;
  private _selectionModuleRowError: string | null = null;
  private _selectionSaving = false;
  private _selectionSaveMessage: string | null = null;
  private _selectionSaveSuccess = false;

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

    this._academicYears = await this.academicYearService.list();
    this._loaded = true;
    const current = this._academicYears.find((year) => year.isCurrent) ?? null;
    if (current !== null) {
      this._selectedYearId = current.id;
    }
    this._render();

    if (current !== null) {
      await this._loadNormalMode(current.id);
    }
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
      case 'module-selection-add-button':
        this._startAddSelectionModule();
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
      return;
    }
    const selectionAction = parseRowAction(elementId, 'module-selection-table');
    if (selectionAction && selectionAction.action !== 'checkbox') {
      void this._handleSelectionModuleRowAction(selectionAction);
    }
  }

  private _handleChange(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;

    const selectionAction = parseRowAction(elementId, 'module-selection-table');
    if (selectionAction && selectionAction.action === 'checkbox') {
      this._toggleModuleSelection(selectionAction.rowId, (target as HTMLInputElement).checked);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Academic years
  // ---------------------------------------------------------------------------------------

  private _startAddYear(): void {
    this._mode = 'adding-year';
    this._editingYearId = NEW_ROW_ID;
    this._yearRowError = null;
    this._selectedModuleIds = new Set();
    this._selectionSaveMessage = null;
    this._render();
    void this._loadAddingModeCycles();
  }

  private async _handleYearRowAction({ rowId, action }: RowAction): Promise<void> {
    switch (action) {
      case 'row':
        if (rowId === NEW_ROW_ID) return;
        this._selectYear(rowId);
        return;
      case 'edit':
        this._editingYearId = rowId;
        this._yearRowError = null;
        this._render();
        return;
      case 'cancel':
        await this._cancelYearRowEdit(rowId);
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

  private async _cancelYearRowEdit(rowId: string): Promise<void> {
    if (rowId === NEW_ROW_ID) {
      this._mode = 'normal';
      this._editingYearId = null;
      this._yearRowError = null;
      this._selectedModuleIds = new Set();
      this._selectionSaveMessage = null;
      this._render();
      await this._loadNormalMode(this._selectedYearId);
      return;
    }
    this._editingYearId = null;
    this._yearRowError = null;
    this._render();
  }

  private _selectYear(id: string): void {
    this._selectedYearId = id;
    this._mode = 'normal';
    this._editingYearId = null;
    this._render();
    void this._loadNormalMode(id);
  }

  private async _saveYear(rowId: string): Promise<void> {
    if (rowId === NEW_ROW_ID) return; // no independent save for the adding-year draft — see module-selection-save-button
    const name = this._query<HTMLInputElement>(`academic-year-table-row-${rowId}-name`).value.trim();
    this._yearRowError = null;

    const result = await this.academicYearService.rename(rowId, name);

    if (result.outcome === 'duplicate-name') {
      this._yearRowError = 'Ya existe un año académico con ese nombre';
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._academicYears = this._academicYears.map((year) => (year.id === rowId ? result.value : year));
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
      this._trainingCycles = [];
      this._selectedCycleId = null;
      this._normalModeModules = [];
      this._yearModuleSelection = new Set();
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
  // Cascading loads
  // ---------------------------------------------------------------------------------------

  /** Normal mode: year-filtered training cycles, then that cycle's year-filtered modules. */
  private async _loadNormalMode(yearId: string | null): Promise<void> {
    if (yearId === null) {
      this._trainingCycles = [];
      this._selectedCycleId = null;
      this._normalModeModules = [];
      this._yearModuleSelection = new Set();
      this._render();
      return;
    }

    const [cycles, selection] = await Promise.all([
      this.academicYearService.listTrainingCyclesForYear(yearId),
      this.academicYearService.getSelection(yearId),
    ]);
    if (this._selectedYearId !== yearId || this._mode !== 'normal') return;

    this._trainingCycles = cycles;
    this._yearModuleSelection = new Set(selection);
    this._selectedCycleId = cycles.length > 0 ? cycles[0]!.id : null;
    this._render();

    if (this._selectedCycleId !== null) {
      await this._loadNormalModules(yearId, this._selectedCycleId);
    } else {
      this._normalModeModules = [];
      this._render();
    }
  }

  private async _loadNormalModules(yearId: string, cycleId: string): Promise<void> {
    const modules = await this.academicYearService.listModulesForYearAndCycle(yearId, cycleId);
    if (this._selectedYearId !== yearId || this._selectedCycleId !== cycleId || this._mode !== 'normal') return;
    this._normalModeModules = modules;
    this._render();
  }

  /** Adding-year / adding-cycle mode: complete unfiltered cycle list, then the selected cycle's modules. */
  private async _loadAddingModeCycles(): Promise<void> {
    const cycles = await this.trainingCycleService.list();
    if (this._mode === 'normal') return;

    this._trainingCycles = cycles;
    this._selectedCycleId = cycles.length > 0 ? cycles[0]!.id : null;
    this._render();

    if (this._selectedCycleId !== null) {
      await this._loadSelectionCycleModules(this._selectedCycleId);
    } else {
      this._selectionCycleModules = [];
      this._render();
    }
  }

  private async _loadSelectionCycleModules(cycleId: string): Promise<void> {
    const modules = await this.moduleService.listForCycle(cycleId);
    if (this._selectedCycleId !== cycleId) return;
    this._selectionCycleModules = modules;
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Training cycles
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

    if (this._mode === 'normal') {
      this._addingModule = false;
      this._editingModuleId = null;
      this._moduleRowError = null;
      this._render();
      if (this._selectedYearId !== null) {
        void this._loadNormalModules(this._selectedYearId, id);
      }
      return;
    }

    this._addingSelectionModule = false;
    this._selectionModuleRowError = null;
    this._render();
    void this._loadSelectionCycleModules(id);
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

    if (rowId !== NEW_ROW_ID) {
      this._trainingCycles = this._trainingCycles.map((cycle) => (cycle.id === rowId ? result.value : cycle));
      this._editingCycleId = null;
      this._render();
      return;
    }

    this._editingCycleId = null;
    const enteringAddingCycleMode = this._mode === 'normal';

    if (!enteringAddingCycleMode) {
      this._trainingCycles = [...this._trainingCycles, result.value];
      this._render();
      return;
    }

    this._mode = 'adding-cycle';
    const cycles = await this.trainingCycleService.list();
    this._trainingCycles = cycles;
    this._selectedCycleId = result.value.id;
    this._render();
    await this._loadSelectionCycleModules(result.value.id);
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
      this._normalModeModules = [];
      this._selectionCycleModules = [];
    }
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Modules (normal mode — module-table)
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
    const name = this._query<HTMLInputElement>(`module-table-row-${rowId}-name`).value.trim();
    const course = Number(this._query<HTMLSelectElement>(`module-table-row-${rowId}-course`).value);
    this._moduleRowError = null;

    if (rowId === NEW_ROW_ID) {
      if (this._selectedCycleId === null || this._selectedYearId === null) return;
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
      this._normalModeModules = [...this._normalModeModules, result.value];
      this._addingModule = false;
      this._editingModuleId = null;
      this._yearModuleSelection.add(result.value.id);
      // Newly-created module is immediately selected for the active academic year, without
      // dropping any module already selected under a different cycle — see
      // views/configuracion/api-contracts.md's POST /api/training-cycles/:cycleId/modules.
      await this.academicYearService.replaceSelection(this._selectedYearId, Array.from(this._yearModuleSelection));
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

    this._normalModeModules = this._normalModeModules.map((module) => (module.id === rowId ? result.value : module));
    this._editingModuleId = null;
    this._render();
  }

  private async _confirmModuleEdit(): Promise<void> {
    const pending = this._pendingModuleEdit;
    if (!pending) return;

    const result = await this.moduleService.update(pending.id, pending.changes, true);
    this._pendingModuleEdit = null;

    if (result.outcome === 'success') {
      this._normalModeModules = this._normalModeModules.map((module) => (module.id === pending.id ? result.value : module));
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

    this._normalModeModules = this._normalModeModules.filter((module) => module.id !== id);
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Module selection (adding-year / adding-cycle modes — module-selection-table)
  // ---------------------------------------------------------------------------------------

  private _toggleModuleSelection(moduleId: string, checked: boolean): void {
    if (checked) {
      this._selectedModuleIds.add(moduleId);
    } else {
      this._selectedModuleIds.delete(moduleId);
    }
    this._render();
  }

  private _startAddSelectionModule(): void {
    if (this._selectedCycleId === null) return;
    this._addingSelectionModule = true;
    this._selectionModuleRowError = null;
    this._render();
  }

  private async _handleSelectionModuleRowAction({ rowId, action }: RowAction): Promise<void> {
    switch (action) {
      case 'save':
        await this._saveSelectionModule(rowId);
        return;
      case 'cancel':
        this._addingSelectionModule = false;
        this._selectionModuleRowError = null;
        this._render();
        return;
      default:
        return;
    }
  }

  private async _saveSelectionModule(rowId: string): Promise<void> {
    if (rowId !== NEW_ROW_ID || this._selectedCycleId === null) return;
    const name = this._query<HTMLInputElement>(`module-selection-table-row-${rowId}-name`).value.trim();
    const course = Number(this._query<HTMLSelectElement>(`module-selection-table-row-${rowId}-course`).value);
    this._selectionModuleRowError = null;

    const result = await this.moduleService.create(this._selectedCycleId, name, course);
    if (result.outcome === 'duplicate-name') {
      this._selectionModuleRowError = 'Ya existe un módulo con ese nombre y curso en este ciclo';
      this._render();
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._selectionCycleModules = [...this._selectionCycleModules, result.value];
    this._selectedModuleIds.add(result.value.id);
    this._addingSelectionModule = false;
    this._render();
  }

  private async _saveSelection(): Promise<void> {
    if (this._mode === 'normal') return;
    this._selectionSaving = true;
    this._selectionSaveMessage = null;
    this._render();

    if (this._mode === 'adding-year') {
      await this._saveAddingYearSelection();
      return;
    }
    await this._saveAddingCycleSelection();
  }

  private async _saveAddingYearSelection(): Promise<void> {
    const name = this._query<HTMLInputElement>(`academic-year-table-row-${NEW_ROW_ID}-name`).value.trim();
    const createResult = await this.academicYearService.create(name);

    if (createResult.outcome === 'duplicate-name') {
      this._selectionSaving = false;
      this._selectionSaveSuccess = false;
      this._selectionSaveMessage = 'Ya existe un año académico con ese nombre';
      this._render();
      return;
    }
    if (createResult.outcome === 'not-found') {
      this._selectionSaving = false;
      this._selectionSaveSuccess = false;
      this._selectionSaveMessage = 'No se pudo crear el año académico';
      this._render();
      return;
    }

    const newYear = createResult.value;
    const replaceResult = await this.academicYearService.replaceSelection(newYear.id, Array.from(this._selectedModuleIds));
    this._selectionSaving = false;
    this._academicYears = [...this._academicYears, newYear];

    if (replaceResult.outcome !== 'success') {
      this._selectionSaveSuccess = false;
      this._selectionSaveMessage =
        'El año académico se creó, pero no se pudo guardar la selección de módulos. Selecciónalo de nuevo para reintentarlo.';
      this._render();
      return;
    }

    this._selectionSaveSuccess = true;
    this._selectionSaveMessage = 'Año académico y selección de módulos guardados';
    this._selectedModuleIds = new Set();
    this._selectYear(newYear.id);
  }

  private async _saveAddingCycleSelection(): Promise<void> {
    if (this._selectedYearId === null) {
      this._selectionSaving = false;
      this._render();
      return;
    }

    const yearId = this._selectedYearId;
    const replaceResult = await this.academicYearService.replaceSelection(yearId, Array.from(this._selectedModuleIds));
    this._selectionSaving = false;

    if (replaceResult.outcome !== 'success') {
      this._selectionSaveSuccess = false;
      this._selectionSaveMessage = 'No se pudo guardar la selección de módulos';
      this._render();
      return;
    }

    this._selectionSaveSuccess = true;
    this._selectionSaveMessage = 'Selección de módulos guardada';
    this._selectedModuleIds = new Set();
    this._selectYear(yearId);
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
          ${this._mode === 'normal' ? this._renderModuleSection() : this._renderModuleSelectionSection()}
          ${this._renderModuleSelectionSaveMessage()}
        </div>
        ${this._renderModuleEditConfirmModal()}
      `,
      this.shadowRoot!,
    );
  }

  private _renderAcademicYearSection(): TemplateResult {
    const rows = [...this._academicYears];
    if (this._editingYearId === NEW_ROW_ID) {
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
      const isDraft = year.id === NEW_ROW_ID;
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
            ${isDraft
              ? ''
              : html`<button
                  type="button"
                  class="${classesFor('button', 'primary', 'sm')}"
                  data-element-id="academic-year-table-row-${year.id}-save"
                >
                  Guardar
                </button>`}
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
    const rows: ModuleRecord[] = [...this._normalModeModules].sort(
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
              ? html`<tr><td colspan="3">Elige o crea un ciclo para ver sus módulos.</td></tr>`
              : rows.length === 0
                ? html`<tr><td colspan="3">Este ciclo todavía no tiene módulos seleccionados para este año académico.</td></tr>`
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
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Selección de módulos del año académico</h2>
          <button
            type="button"
            class="${classesFor('button', 'secondary', 'sm')}"
            data-element-id="module-selection-add-button"
            ?disabled=${this._selectedCycleId === null}
          >
            Añadir módulo
          </button>
        </div>

        ${this._renderModuleSelectionTable()}

        <button
          type="button"
          class="${classesFor('submit-button', 'primary', 'md')}"
          data-element-id="module-selection-save-button"
          ?disabled=${this._selectionSaving}
        >
          ${this._selectionSaving ? 'Guardando…' : 'Guardar selección'}
        </button>
      </section>
    `;
  }

  private _renderModuleSelectionTable(): TemplateResult {
    const rows: ModuleRecord[] = [...this._selectionCycleModules].sort(
      (a, b) => a.course - b.course || a.name.localeCompare(b.name),
    );
    if (this._addingSelectionModule && this._selectedCycleId !== null) {
      rows.push({ id: NEW_ROW_ID, trainingCycleId: this._selectedCycleId, course: 1, name: '' });
    }

    return html`
      <table class="${classesFor('table')}" data-element-id="module-selection-table">
        <thead>
          <tr>
            <th>Curso</th>
            <th>Módulo</th>
            <th>Seleccionado</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? html`<tr><td colspan="3">Este ciclo todavía no tiene módulos — añade uno.</td></tr>`
            : this._renderSelectionModuleRows(rows)}
        </tbody>
      </table>
    `;
  }

  private _renderSelectionModuleRows(rows: ModuleRecord[]): TemplateResult {
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
      rendered.push(module.id === NEW_ROW_ID ? this._renderNewSelectionModuleRow(module) : this._renderSelectionModuleRow(module));
    }
    return html`${rendered}`;
  }

  private _renderSelectionModuleRow(module: ModuleRecord): TemplateResult {
    return html`
      <tr data-element-id="module-selection-table-row-${module.id}">
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
    `;
  }

  private _renderNewSelectionModuleRow(module: ModuleRecord): TemplateResult {
    return html`
      <tr data-element-id="module-selection-table-row-new">
        <td>
          <select
            class="${classesFor('select', undefined, 'md')}"
            data-element-id="module-selection-table-row-new-course"
            .value=${String(module.course)}
          >
            <option value="1">1º</option>
            <option value="2">2º</option>
            <option value="3">3º</option>
          </select>
        </td>
        <td>
          <input
            class="${classesFor('text-input', undefined, 'md')}"
            data-element-id="module-selection-table-row-new-name"
            type="text"
            .value=${module.name}
          />
        </td>
        <td class="flex gap-2">
          <button
            type="button"
            class="${classesFor('button', 'primary', 'sm')}"
            data-element-id="module-selection-table-row-new-save"
          >
            Guardar
          </button>
          <button
            type="button"
            class="${classesFor('button', 'ghost', 'sm')}"
            data-element-id="module-selection-table-row-new-cancel"
          >
            Cancelar
          </button>
        </td>
      </tr>
      ${this._selectionModuleRowError !== null
        ? html`<tr><td colspan="3" class="${classesFor('paragraph', 'danger', 'sm')}">${this._selectionModuleRowError}</td></tr>`
        : ''}
    `;
  }

  private _renderModuleSelectionSaveMessage(): TemplateResult | string {
    if (this._selectionSaveMessage === null) {
      return '';
    }
    return html`<p
      class="${classesFor('paragraph', this._selectionSaveSuccess ? undefined : 'danger', 'sm')} ${this
        ._selectionSaveSuccess
        ? 'text-green-700'
        : ''}"
      data-element-id="module-selection-save-message"
      aria-live="assertive"
    >
      ${this._selectionSaveMessage}
    </p>`;
  }
}

function formatAcademicYearNames(academicYears: AcademicYearRef[]): string {
  return academicYears.map((year) => year.name).join(', ');
}

customElements.define('app-academic-year-settings-view', AcademicYearSettingsView);
