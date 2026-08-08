import { html, render, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { renderSettingsNav } from './settings-nav';
import { parseRowAction, type RowAction } from './row-action';
import { ToastController, renderToast } from './toast';
import { RequiredRef } from './required-ref';
import { SettingsScreenBase } from './settings-screen-base';
import type { SessionApiService } from './session-api-service';
import type { CatalogTrainingCycle, CatalogTrainingCycleApiService } from './catalog-training-cycle-api-service';
import type { CatalogModuleApiService, CatalogModuleRecord } from './catalog-module-api-service';
import type { AcademicYear, AcademicYearApiService, AcademicYearModuleDetail } from './academic-year-api-service';

const NEW_ROW_ID = 'new';

type ScreenMode = 'normal' | 'adding-new-year' | 'adding-extend';

interface DistinctCycle {
  id: string;
  name: string;
}

/**
 * Configuración — Año académico screen. Own top-level custom element, single Shadow DOM
 * (CLAUDE.md's "no nested Shadow DOM" rule) — every table below (academic years, training
 * cycles, modules, module selection) plus the floating toast are rendered inline within this
 * same component's own render tree. See views/configuracion/ui-spec.json
 * (`academic-year-settings-screen`) for element design, views/configuracion/use-cases.md
 * UC-03/UC-06..UC-09 for the business rules implemented here, and
 * lib/patterns/crud-table-component.md / lib/patterns/cascading-select.md for the shapes
 * followed throughout. `teacher-nav-link`/`training-catalog-nav-link`/
 * `academic-year-nav-link` are shared with the other Configuración screens via the plain
 * `renderSettingsNav` function; `academic-year-toast` is shared (future views too) via the
 * plain `ToastController`/`renderToast` pair in `toast.ts`.
 *
 * **Real backend as of the 2026-08-05 redesign** (see api-contracts.md's "Academic years" /
 * "Academic year módulo selection" sections). Three modes (functional-spec.json's
 * `appOverview`):
 * - `normal`: an existing academic year is selected (or none is). `training-cycle-table`
 *   shows only the cycles derived from that year's assigned módulos
 *   (`academicYearService.listModules`, fetched once per year selection — no separate
 *   per-cycle request); `module-table` filters that same, already-fetched module list to the
 *   selected cycle. `module-selection-table` and its save button aren't rendered at all.
 * - `adding-new-year`: `academic-year-table-add-button` was clicked. A blank start-year
 *   draft row opens in `academic-year-table` (no independent save — see
 *   `module-selection-save-button`); `training-cycle-table` shows the complete,
 *   unscoped `catalog_cycles` list with checkboxes; `module-table` is replaced by
 *   `module-selection-table`, which accumulates checked cycles' `catalog_modules` into an
 *   in-progress, unsaved selection. Saving calls `academicYearService.createWithSelection`.
 * - `adding-extend`: entered via `training-cycle-table-add-cycle-button` while an existing
 *   year is selected in `normal` mode — no draft row added. Same checked-cycles/module-
 *   selection UI, except módulos already assigned to the selected year load pre-checked and
 *   disabled (can't be re-added or re-sent). Saving calls
 *   `academicYearService.extendSelection`.
 */
export class AcademicYearSettingsView extends SettingsScreenBase {
  private readonly _sessionServiceRef = new RequiredRef<SessionApiService>(
    'AcademicYearSettingsView.sessionService must be set before use',
  );
  private readonly _academicYearServiceRef = new RequiredRef<AcademicYearApiService>(
    'AcademicYearSettingsView.academicYearService must be set before use',
  );
  private readonly _catalogCycleServiceRef = new RequiredRef<CatalogTrainingCycleApiService>(
    'AcademicYearSettingsView.catalogCycleService must be set before use',
  );
  private readonly _catalogModuleServiceRef = new RequiredRef<CatalogModuleApiService>(
    'AcademicYearSettingsView.catalogModuleService must be set before use',
  );

  private _authenticated = false;
  private _loaded = false;

  private _mode: ScreenMode = 'normal';

  // Academic years
  private _academicYears: AcademicYear[] = [];
  private _selectedYearId: string | null = null;
  private _editingYearId: string | null = null;

  // Selected year's assigned módulos — single source of truth for normal mode's
  // training-cycle-table (derived distinct cycles) and module-table (filtered by cycle).
  private _yearModules: AcademicYearModuleDetail[] = [];
  private _selectedCycleId: string | null = null;

  // Adding mode (adding-new-year / adding-extend) — training-cycle-table's checkbox list
  // and module-selection-table's accumulated, in-progress selection.
  private _addingCatalogCycles: CatalogTrainingCycle[] = [];
  private _checkedCycleIds: Set<string> = new Set();
  private _checkedCyclesOrder: string[] = [];
  private _cycleModules: Map<string, CatalogModuleRecord[]> = new Map();
  private _selectedModuleIds: Set<string> = new Set();
  /** adding-extend only: catalog módulo ids already assigned to the year being extended — pre-checked and disabled, never resent. */
  private _alreadyAssignedModuleIds: Set<string> = new Set();

  private _selectionSaving = false;
  private _selectionSaveMessage: string | null = null;

  private readonly _toast: ToastController = new ToastController(() => this._render());

  set sessionService(value: SessionApiService) {
    this._sessionServiceRef.set(value);
  }

  get sessionService(): SessionApiService {
    return this._sessionServiceRef.get();
  }

  set academicYearService(value: AcademicYearApiService) {
    this._academicYearServiceRef.set(value);
  }

  get academicYearService(): AcademicYearApiService {
    return this._academicYearServiceRef.get();
  }

  set catalogCycleService(value: CatalogTrainingCycleApiService) {
    this._catalogCycleServiceRef.set(value);
  }

  get catalogCycleService(): CatalogTrainingCycleApiService {
    return this._catalogCycleServiceRef.get();
  }

  set catalogModuleService(value: CatalogModuleApiService) {
    this._catalogModuleServiceRef.set(value);
  }

  get catalogModuleService(): CatalogModuleApiService {
    return this._catalogModuleServiceRef.get();
  }

  protected async _onConnected(): Promise<void> {
    const outcome = await this.sessionService.getSession();
    if (!outcome.authenticated) {
      redirectTo('/login');
      return;
    }
    this._authenticated = true;

    this._academicYears = await this.academicYearService.list();
    this._loaded = true;

    const defaultYear = this._academicYears.find((year) => year.isCurrent) ?? this._academicYears[0] ?? null;
    if (defaultYear !== null) {
      this._selectYear(defaultYear.id);
      return;
    }
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------------------------

  protected _onElementClick(elementId: string): void {
    if (elementId === 'academic-year-table-add-button') {
      this._startAddYear();
      return;
    }
    if (elementId === 'training-cycle-table-add-cycle-button') {
      this._startExtendYear();
      return;
    }
    if (elementId === 'module-selection-save-button') {
      void this._saveSelection();
      return;
    }

    const yearAction = parseRowAction(elementId, 'academic-year-table');
    if (yearAction) {
      void this._handleYearRowAction(yearAction);
      return;
    }

    const cycleAction = parseRowAction(elementId, 'training-cycle-table');
    if (cycleAction) {
      if (this._mode !== 'normal') return;
      if (cycleAction.action === 'row') {
        this._selectCycle(cycleAction.rowId);
      } else if (cycleAction.action === 'delete') {
        this._deleteCycleFromYear(cycleAction.rowId);
      }
      return;
    }

    const moduleAction = parseRowAction(elementId, 'module-table');
    if (moduleAction && moduleAction.action === 'delete') {
      void this._removeModule(moduleAction.rowId);
    }
  }

  protected _onElementChange(elementId: string, target: HTMLElement): void {
    const checked = (target as HTMLInputElement).checked;

    const cycleAction = parseRowAction(elementId, 'training-cycle-table');
    if (cycleAction && cycleAction.action === 'checkbox') {
      this._toggleCycleChecked(cycleAction.rowId, checked);
      return;
    }

    const selectionAction = parseRowAction(elementId, 'module-selection-table');
    if (selectionAction && selectionAction.action === 'checkbox') {
      this._toggleModuleSelected(selectionAction.rowId, checked);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Academic years
  // ---------------------------------------------------------------------------------------

  private async _handleYearRowAction({ rowId, action }: RowAction): Promise<void> {
    switch (action) {
      case 'row':
        if (rowId === NEW_ROW_ID || this._mode !== 'normal') return;
        this._selectYear(rowId);
        return;
      case 'edit':
        if (rowId === NEW_ROW_ID) return;
        this._editingYearId = rowId;
        this._render();
        return;
      case 'cancel':
        if (rowId === NEW_ROW_ID) {
          this._cancelAdding();
          return;
        }
        this._editingYearId = null;
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
      default:
        return;
    }
  }

  private _selectYear(id: string): void {
    this._selectedYearId = id;
    this._selectedCycleId = null;
    this._yearModules = [];
    this._render();
    void this._loadYearModules(id);
  }

  private async _loadYearModules(id: string): Promise<void> {
    const modules = await this.academicYearService.listModules(id);
    if (this._selectedYearId !== id) return;
    this._yearModules = modules;
    this._selectFirstCycle();
    this._render();
  }

  /** Leaves the first of the cycles currently derived from `_yearModules` selected — the
   * screen never shows normal-mode `training-cycle-table` with nothing selected while at
   * least one row exists. */
  private _selectFirstCycle(): void {
    const cycles = this._distinctCyclesFromYearModules();
    this._selectedCycleId = cycles.length > 0 ? cycles[0]!.id : null;
  }

  private async _saveYear(rowId: string): Promise<void> {
    const raw = this._query<HTMLInputElement>(`academic-year-table-row-${rowId}-name`).value.trim();
    const startYear = Number(raw);

    const result = await this.academicYearService.update(rowId, { startYear });

    if (result.outcome === 'duplicate-name') {
      this._toast.show('Ya existe un año académico con ese año de inicio');
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

  private async _setCurrentYear(id: string): Promise<void> {
    const result = await this.academicYearService.update(id, { isCurrent: true });
    if (result.outcome !== 'success') {
      this._render();
      return;
    }
    this._academicYears = this._academicYears.map((year) => (year.id === id ? result.value : { ...year, isCurrent: false }));
    this._render();
  }

  private async _deleteYear(id: string): Promise<void> {
    const result = await this.academicYearService.remove(id);

    if (result.outcome === 'has-dependents') {
      this._toast.show('No se puede eliminar: todavía tiene módulos asignados. Elimínalos primero.');
      return;
    }
    if (result.outcome === 'not-found') {
      this._render();
      return;
    }

    this._academicYears = this._academicYears.filter((year) => year.id !== id);
    if (this._selectedYearId === id) {
      this._selectedYearId = null;
      this._selectedCycleId = null;
      this._yearModules = [];
    }
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Adding mode — entering/leaving
  // ---------------------------------------------------------------------------------------

  private _startAddYear(): void {
    this._mode = 'adding-new-year';
    this._resetAddingSelectionState();
    this._selectionSaveMessage = null;
    this._render();
    void this._loadAddingCatalogCycles();
  }

  private _startExtendYear(): void {
    if (this._selectedYearId === null || this._mode !== 'normal') return;
    this._mode = 'adding-extend';
    this._resetAddingSelectionState();
    this._alreadyAssignedModuleIds = new Set(this._yearModules.map((module) => module.catalogModuleId));
    this._selectionSaveMessage = null;
    this._render();
    void this._loadAddingCatalogCycles();
  }

  private _cancelAdding(): void {
    this._mode = 'normal';
    this._editingYearId = null;
    this._resetAddingSelectionState();
    this._selectionSaveMessage = null;
    this._render();
  }

  private _resetAddingSelectionState(): void {
    this._addingCatalogCycles = [];
    this._checkedCycleIds = new Set();
    this._checkedCyclesOrder = [];
    this._cycleModules = new Map();
    this._selectedModuleIds = new Set();
    this._alreadyAssignedModuleIds = new Set();
  }

  private async _loadAddingCatalogCycles(): Promise<void> {
    const cycles = await this.catalogCycleService.list();
    if (this._mode === 'normal') return;
    this._addingCatalogCycles = cycles;
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Training cycles
  // ---------------------------------------------------------------------------------------

  private _distinctCyclesFromYearModules(): DistinctCycle[] {
    const seen = new Set<string>();
    const cycles: DistinctCycle[] = [];
    for (const module of this._yearModules) {
      if (!seen.has(module.catalogTrainingCycleId)) {
        seen.add(module.catalogTrainingCycleId);
        cycles.push({ id: module.catalogTrainingCycleId, name: module.catalogTrainingCycleName });
      }
    }
    return cycles;
  }

  private _selectCycle(id: string): void {
    this._selectedCycleId = id;
    this._render();
  }

  /** `training-cycle-table` (normal mode) only ever shows a cycle while it has ≥1 módulo
   * assigned to this academic year (see `_distinctCyclesFromYearModules`), so this is
   * blocked every time it's actually reachable — the teacher must remove the cycle's
   * módulos one by one via `module-table`'s Eliminar first, at which point the cycle drops
   * out of this list on its own. Never touches `catalog_cycles`/`catalog_modules` — those
   * are only ever modified from the Ciclos/Módulos screen. */
  private _deleteCycleFromYear(cycleId: string): void {
    const hasModules = this._yearModules.some((module) => module.catalogTrainingCycleId === cycleId);
    if (hasModules) {
      this._toast.show('No se puede eliminar el ciclo: todavía tiene módulos asignados. Elimínalos primero.');
      return;
    }
    this._render();
  }

  private _toggleCycleChecked(cycleId: string, checked: boolean): void {
    if (checked) {
      this._checkedCycleIds.add(cycleId);
      this._checkedCyclesOrder.push(cycleId);
      this._render();
      void this._loadCycleModulesForSelection(cycleId);
      return;
    }

    this._checkedCycleIds.delete(cycleId);
    this._checkedCyclesOrder = this._checkedCyclesOrder.filter((id) => id !== cycleId);
    const discardedModules = this._cycleModules.get(cycleId) ?? [];
    this._cycleModules.delete(cycleId);
    for (const module of discardedModules) {
      this._selectedModuleIds.delete(module.id);
    }
    this._render();
  }

  private async _loadCycleModulesForSelection(cycleId: string): Promise<void> {
    const modules = await this.catalogModuleService.listForCycle(cycleId);
    if (!this._checkedCycleIds.has(cycleId)) return;
    this._cycleModules.set(cycleId, modules);
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Modules (normal mode — module-table)
  // ---------------------------------------------------------------------------------------

  private async _removeModule(id: string): Promise<void> {
    const result = await this.academicYearService.removeModule(id);
    if (result.outcome !== 'success') {
      this._render();
      return;
    }

    this._yearModules = this._yearModules.filter((module) => module.id !== id);

    const stillCycles = this._distinctCyclesFromYearModules();
    if (!stillCycles.some((cycle) => cycle.id === this._selectedCycleId)) {
      this._selectFirstCycle();
    }
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // Module selection (adding-new-year / adding-extend modes — module-selection-table)
  // ---------------------------------------------------------------------------------------

  private _toggleModuleSelected(moduleId: string, checked: boolean): void {
    if (this._alreadyAssignedModuleIds.has(moduleId)) return;
    if (checked) {
      this._selectedModuleIds.add(moduleId);
    } else {
      this._selectedModuleIds.delete(moduleId);
    }
    this._render();
  }

  private async _saveSelection(): Promise<void> {
    if (this._mode === 'normal') return;
    this._selectionSaving = true;
    this._selectionSaveMessage = null;
    this._render();

    const moduleIds = Array.from(this._selectedModuleIds);

    if (this._mode === 'adding-new-year') {
      await this._saveNewYear(moduleIds);
      return;
    }
    await this._saveExtendYear(moduleIds);
  }

  private async _saveNewYear(moduleIds: string[]): Promise<void> {
    const raw = this._query<HTMLInputElement>(`academic-year-table-row-${NEW_ROW_ID}-name`).value.trim();
    const startYear = Number(raw);

    const result = await this.academicYearService.createWithSelection(startYear, moduleIds);
    this._selectionSaving = false;

    if (result.outcome === 'duplicate-name') {
      this._toast.show('Ya existe un año académico con ese año de inicio');
      return;
    }
    if (result.outcome === 'not-found') {
      this._selectionSaveMessage = 'No se pudo crear el año académico';
      this._render();
      return;
    }

    this._academicYears = [...this._academicYears, result.value.academicYear];
    this._selectionSaveMessage = 'Año académico y selección de módulos guardados';
    this._mode = 'normal';
    this._editingYearId = null;
    this._resetAddingSelectionState();
    this._selectYear(result.value.academicYear.id);
  }

  private async _saveExtendYear(moduleIds: string[]): Promise<void> {
    const yearId = this._selectedYearId;
    if (yearId === null) {
      this._selectionSaving = false;
      this._render();
      return;
    }

    const result = await this.academicYearService.extendSelection(yearId, moduleIds);
    this._selectionSaving = false;

    if (result.outcome !== 'success') {
      this._selectionSaveMessage = 'No se pudo guardar la selección de módulos';
      this._render();
      return;
    }

    this._selectionSaveMessage = 'Selección de módulos guardada';
    this._mode = 'normal';
    this._resetAddingSelectionState();
    this._selectYear(yearId);
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
          ${renderSettingsNav('ano-academico')} ${this._renderAcademicYearSection()} ${this._renderTrainingCycleSection()}
          ${this._mode === 'normal' ? this._renderModuleTableSection() : this._renderModuleSelectionSection()}
          ${this._renderModuleSelectionSaveMessage()}
        </div>
        ${renderToast('academic-year-toast', this._toast.current, () => this._toast.dismiss())}
      `,
      this.shadowRoot!,
    );
  }

  private _renderAcademicYearSection(): TemplateResult {
    const rows = this._academicYears;

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Años académicos</h2>
          <button type="button" class="${classesFor('button', 'secondary', 'sm')}" data-element-id="academic-year-table-add-button">
            Añadir año académico
          </button>
        </div>

        <table class="${classesFor('table')}" data-element-id="academic-year-table">
          <thead>
            <tr>
              <th>Año académico</th>
              <th>En curso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 && this._mode !== 'adding-new-year'
              ? html`<tr><td colspan="3">Todavía no has creado ningún año académico.</td></tr>`
              : ''}
            ${rows.map((year) => this._renderAcademicYearRow(year))}
            ${this._mode === 'adding-new-year' ? this._renderDraftYearRow() : ''}
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
              .value=${String(year.startYear)}
            />
          </td>
          <td></td>
          <td class="flex gap-2">
            <button type="button" class="${classesFor('button', 'primary', 'sm')}" data-element-id="academic-year-table-row-${year.id}-save">
              Guardar
            </button>
            <button type="button" class="${classesFor('button', 'ghost', 'sm')}" data-element-id="academic-year-table-row-${year.id}-cancel">
              Cancelar
            </button>
          </td>
        </tr>
      `;
    }

    const isSelected = this._selectedYearId === year.id;
    return html`
      <tr data-element-id="academic-year-table-row-${year.id}" class="cursor-pointer ${isSelected ? 'bg-slate-100' : ''}">
        <td>${year.startYear}-${year.startYear + 1}</td>
        <td>${year.isCurrent ? html`<span class="${classesFor('badge', 'primary')}">En curso</span>` : ''}</td>
        <td class="flex gap-2">
          <button type="button" class="${classesFor('button', 'ghost', 'sm')}" data-element-id="academic-year-table-row-${year.id}-set-current">
            Marcar en curso
          </button>
          <button type="button" class="${classesFor('button', 'ghost', 'sm')}" data-element-id="academic-year-table-row-${year.id}-edit">
            Editar
          </button>
          <button type="button" class="${classesFor('button', 'danger', 'sm')}" data-element-id="academic-year-table-row-${year.id}-delete">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }

  private _renderDraftYearRow(): TemplateResult {
    return html`
      <tr data-element-id="academic-year-table-row-${NEW_ROW_ID}">
        <td>
          <input
            class="${classesFor('text-input', undefined, 'md')}"
            data-element-id="academic-year-table-row-${NEW_ROW_ID}-name"
            type="text"
            placeholder="2026"
          />
        </td>
        <td></td>
        <td class="flex gap-2">
          <button type="button" class="${classesFor('button', 'ghost', 'sm')}" data-element-id="academic-year-table-row-${NEW_ROW_ID}-cancel">
            Cancelar
          </button>
        </td>
      </tr>
    `;
  }

  private _renderTrainingCycleSection(): TemplateResult {
    const showAddCycleButton = this._mode === 'normal' && this._selectedYearId !== null;

    return html`
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="${classesFor('heading')}">Ciclos</h2>
          ${showAddCycleButton
            ? html`<button
                type="button"
                class="${classesFor('button', 'secondary', 'sm')}"
                data-element-id="training-cycle-table-add-cycle-button"
              >
                Añadir ciclo
              </button>`
            : ''}
        </div>

        <table class="${classesFor('table')}" data-element-id="training-cycle-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${this._mode === 'normal' ? this._renderNormalCycleRows() : this._renderAddingCycleRows()}
          </tbody>
        </table>
      </section>
    `;
  }

  private _renderNormalCycleRows(): TemplateResult {
    const cycles = this._distinctCyclesFromYearModules();
    if (cycles.length === 0) {
      return html`<tr><td colspan="2">${this._selectedYearId === null ? 'Elige un año académico.' : 'Este año académico todavía no tiene módulos asignados.'}</td></tr>`;
    }
    return html`${cycles.map((cycle) => {
      const isSelected = this._selectedCycleId === cycle.id;
      return html`
        <tr data-element-id="training-cycle-table-row-${cycle.id}" class="cursor-pointer ${isSelected ? 'bg-slate-100' : ''}">
          <td>${cycle.name}</td>
          <td>
            <button type="button" class="${classesFor('button', 'danger', 'sm')}" data-element-id="training-cycle-table-row-${cycle.id}-delete">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    })}`;
  }

  private _renderAddingCycleRows(): TemplateResult {
    if (this._addingCatalogCycles.length === 0) {
      return html`<tr><td colspan="2">Cargando ciclos…</td></tr>`;
    }
    return html`${this._addingCatalogCycles.map(
      (cycle) => html`
        <tr data-element-id="training-cycle-table-row-${cycle.id}">
          <td>${cycle.name}</td>
          <td>
            <input
              type="checkbox"
              class="${classesFor('checkbox')}"
              data-element-id="training-cycle-table-row-${cycle.id}-checkbox"
              .checked=${this._checkedCycleIds.has(cycle.id)}
            />
          </td>
        </tr>
      `,
    )}`;
  }

  private _renderModuleTableSection(): TemplateResult {
    const rows =
      this._selectedCycleId === null
        ? []
        : [...this._yearModules.filter((module) => module.catalogTrainingCycleId === this._selectedCycleId)].sort(
            (a, b) => a.course - b.course || a.name.localeCompare(b.name),
          );

    return html`
      <section class="flex flex-col gap-2">
        <h2 class="${classesFor('heading')}">Módulos</h2>
        <table class="${classesFor('table')}" data-element-id="module-table">
          <thead>
            <tr>
              <th>Curso</th>
              <th>Nombre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${this._selectedCycleId === null
              ? html`<tr><td colspan="3">Elige un ciclo para ver sus módulos.</td></tr>`
              : rows.length === 0
                ? html`<tr><td colspan="3">Este ciclo no tiene módulos asignados a este año académico.</td></tr>`
                : this._renderModuleRows(rows)}
          </tbody>
        </table>
      </section>
    `;
  }

  private _renderModuleRows(rows: AcademicYearModuleDetail[]): TemplateResult {
    const rendered: TemplateResult[] = [];
    let lastCourse: number | null = null;
    for (const module of rows) {
      if (module.course !== lastCourse) {
        rendered.push(
          html`<tr><td colspan="3" class="${classesFor('paragraph', undefined, 'sm')} pt-2 font-semibold">${module.course}º</td></tr>`,
        );
        lastCourse = module.course;
      }
      rendered.push(html`
        <tr data-element-id="module-table-row-${module.id}">
          <td>${module.course}º</td>
          <td>${module.name}</td>
          <td>
            <button type="button" class="${classesFor('button', 'danger', 'sm')}" data-element-id="module-table-row-${module.id}-delete">
              Eliminar
            </button>
          </td>
        </tr>
      `);
    }
    return html`${rendered}`;
  }

  private _renderModuleSelectionSection(): TemplateResult {
    return html`
      <section class="flex flex-col gap-2">
        <h2 class="${classesFor('heading')}">Selecciona módulos</h2>
        <table class="${classesFor('table')}" data-element-id="module-selection-table">
          <thead>
            <tr>
              <th>Curso</th>
              <th>Módulo</th>
              <th>Seleccionado</th>
            </tr>
          </thead>
          <tbody>
            ${this._checkedCyclesOrder.length === 0
              ? html`<tr><td colspan="3">Marca un ciclo para ver sus módulos.</td></tr>`
              : this._renderSelectionRows()}
          </tbody>
        </table>

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

  private _renderSelectionRows(): TemplateResult {
    const rendered: TemplateResult[] = [];
    for (const cycleId of this._checkedCyclesOrder) {
      const cycle = this._addingCatalogCycles.find((candidate) => candidate.id === cycleId);
      const modules = [...(this._cycleModules.get(cycleId) ?? [])].sort(
        (a, b) => a.course - b.course || a.name.localeCompare(b.name),
      );
      rendered.push(
        html`<tr><td colspan="3" class="${classesFor('paragraph', undefined, 'sm')} pt-2 font-semibold">${cycle?.name ?? cycleId}</td></tr>`,
      );
      for (const module of modules) {
        rendered.push(this._renderSelectionModuleRow(module));
      }
    }
    return html`${rendered}`;
  }

  private _renderSelectionModuleRow(module: CatalogModuleRecord): TemplateResult {
    const alreadyAssigned = this._alreadyAssignedModuleIds.has(module.id);
    const checked = alreadyAssigned || this._selectedModuleIds.has(module.id);
    return html`
      <tr data-element-id="module-selection-table-row-${module.id}">
        <td>${module.course}º</td>
        <td>${module.name}</td>
        <td>
          <input
            type="checkbox"
            class="${classesFor('checkbox')}"
            data-element-id="module-selection-table-row-${module.id}-checkbox"
            .checked=${checked}
            ?disabled=${alreadyAssigned}
          />
        </td>
      </tr>
    `;
  }

  private _renderModuleSelectionSaveMessage(): TemplateResult | string {
    if (this._selectionSaveMessage === null) {
      return '';
    }
    return html`<p class="${classesFor('paragraph')}" data-element-id="module-selection-save-message" aria-live="polite">
      ${this._selectionSaveMessage}
    </p>`;
  }
}

customElements.define('app-academic-year-settings-view', AcademicYearSettingsView);
