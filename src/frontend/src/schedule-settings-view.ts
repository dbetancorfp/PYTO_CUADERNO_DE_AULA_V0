import { html, render, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { renderSettingsNav } from './settings-nav';
import { RequiredRef } from './required-ref';
import { SettingsScreenBase } from './settings-screen-base';
import type { SessionApiService } from './session-api-service';
import type { AcademicYear, AcademicYearApiService, AcademicYearModuleDetail } from './academic-year-api-service';
import type { AcademicYearModuleScheduleApiService, ScheduleEntry } from './academic-year-module-schedule-api-service';

/** This view only ever calls `list()`/`listModules()` on the injected academic-year
 * service (ISP) — the full `AcademicYearApiService` also carries write methods
 * (`update`/`remove`/`createWithSelection`/`extendSelection`/`removeModule`) this
 * screen never uses. Same `Pick` narrowing `calendario-view.ts` already applies. */
type ScheduleAcademicYearApiService = Pick<AcademicYearApiService, 'list' | 'listModules'>;

interface DistinctCycle {
  id: string;
  name: string;
}

interface WeekdayDef {
  weekday: number;
  elementId: 'schedule-monday-select' | 'schedule-tuesday-select' | 'schedule-wednesday-select' | 'schedule-thursday-select' | 'schedule-friday-select';
  label: string;
}

/** Monday (1) through Friday (5), in display order — the single source of truth both the
 * weekday grid's markup and the save payload's weekday set are derived from (OCP: no
 * weekday-specific branch anywhere else in this file). */
const WEEKDAYS: readonly WeekdayDef[] = [
  { weekday: 1, elementId: 'schedule-monday-select', label: 'Lunes' },
  { weekday: 2, elementId: 'schedule-tuesday-select', label: 'Martes' },
  { weekday: 3, elementId: 'schedule-wednesday-select', label: 'Miércoles' },
  { weekday: 4, elementId: 'schedule-thursday-select', label: 'Jueves' },
  { weekday: 5, elementId: 'schedule-friday-select', label: 'Viernes' },
];

const HOURS_OPTIONS: readonly string[] = ['1', '2', '3'];

const FORWARD_YEAR_WINDOW = 5;

/** September (month index >= 8, 0-indexed) or later belongs to that calendar year's school
 * year; earlier months belong to the school year that started the previous calendar year.
 * Same rule `calendario-view.ts`'s `currentSchoolYearStartYear` implements. */
function currentSchoolYearStartYear(today: Date): number {
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
}

/**
 * Configuración — Horario screen. Own top-level custom element, single Shadow DOM
 * (CLAUDE.md's "no nested Shadow DOM" rule). See `views/configuracion/ui-spec.json`
 * (`schedule-settings-screen`) for element design and `views/configuracion/use-cases.md`
 * UC-10/UC-11 for the business rules implemented here.
 *
 * Reuses Calendario's exact Año/Ciclo/Módulo cascading-filter shape
 * (`lib/patterns/cascading-select.md`) — same `academicYearService.list()`/`listModules()`
 * data source, same default-to-current-school-year carousel logic — in front of a
 * draft-until-saved 5-weekday hours grid instead of a read-only calendar. Each weekday
 * select only ever mutates an in-memory `_draft` map (`schedule-weekday-hours-changed`);
 * nothing is sent to the backend until `schedule-save-button` is clicked
 * (`schedule-save-submitted`), which replaces the selected módulo's entire schedule in one
 * `PUT` request (see `views/configuracion/api-contracts.md`'s "Horario" section).
 *
 * `today` is a settable property (defaults to `new Date()`), the same testing seam
 * `calendario-view.ts` already uses so the date-dependent "current school year" default is
 * deterministic in tests instead of depending on the real wall-clock date.
 */
export class ScheduleSettingsView extends SettingsScreenBase {
  private readonly _sessionServiceRef = new RequiredRef<SessionApiService>(
    'ScheduleSettingsView.sessionService must be set before use',
  );
  private readonly _academicYearServiceRef = new RequiredRef<ScheduleAcademicYearApiService>(
    'ScheduleSettingsView.academicYearService must be set before use',
  );
  private readonly _scheduleServiceRef = new RequiredRef<AcademicYearModuleScheduleApiService>(
    'ScheduleSettingsView.scheduleService must be set before use',
  );
  private _today: Date = new Date();

  private _authenticated = false;
  private _loaded = false;

  private _academicYears: AcademicYear[] = [];
  private _currentSchoolYearStartYear = 0;
  private _selectedStartYear = 0;
  private _selectedAcademicYearId: string | null = null;

  private _yearModules: AcademicYearModuleDetail[] = [];
  private _selectedCycleId: string | null = null;
  private _selectedModuleId: string | null = null;

  /** In-progress, unsaved draft — weekday -> hours, only weekdays with a non-blank value
   * present. Discarded (replaced by whatever `scheduleService.find` returns) every time the
   * selected módulo changes, per `views/configuracion/ui-spec.json`'s cascading filters. */
  private _draft: Map<number, number> = new Map();
  private _saving = false;
  private _saveMessage: string | null = null;

  set sessionService(value: SessionApiService) {
    this._sessionServiceRef.set(value);
  }

  get sessionService(): SessionApiService {
    return this._sessionServiceRef.get();
  }

  set academicYearService(value: ScheduleAcademicYearApiService) {
    this._academicYearServiceRef.set(value);
  }

  get academicYearService(): ScheduleAcademicYearApiService {
    return this._academicYearServiceRef.get();
  }

  set scheduleService(value: AcademicYearModuleScheduleApiService) {
    this._scheduleServiceRef.set(value);
  }

  get scheduleService(): AcademicYearModuleScheduleApiService {
    return this._scheduleServiceRef.get();
  }

  set today(value: Date) {
    this._today = value;
  }

  protected async _onConnected(): Promise<void> {
    const outcome = await this.sessionService.getSession();
    if (!outcome.authenticated) {
      redirectTo('/login');
      return;
    }
    this._authenticated = true;

    this._currentSchoolYearStartYear = currentSchoolYearStartYear(this._today);
    this._selectedStartYear = this._currentSchoolYearStartYear;

    this._academicYears = await this.academicYearService.list();
    this._loaded = true;

    void this._applySelectedYear();
  }

  // ---------------------------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------------------------

  protected _onElementClick(elementId: string): void {
    if (elementId === 'schedule-academic-year-filter-prev') {
      this._goToPreviousYear();
      return;
    }
    if (elementId === 'schedule-academic-year-filter-next') {
      this._goToNextYear();
      return;
    }
    if (elementId === 'schedule-save-button') {
      void this._save();
    }
  }

  protected _onElementChange(elementId: string, target: HTMLElement): void {
    const value = (target as HTMLSelectElement).value;

    if (elementId === 'schedule-cycle-filter') {
      this._selectedCycleId = value;
      this._selectFirstModuleForCycle();
      this._draft = new Map();
      this._saveMessage = null;
      this._render();
      void this._loadSchedule();
      return;
    }
    if (elementId === 'schedule-module-filter') {
      this._selectedModuleId = value;
      this._draft = new Map();
      this._saveMessage = null;
      this._render();
      void this._loadSchedule();
      return;
    }

    const weekdayDef = WEEKDAYS.find((candidate) => candidate.elementId === elementId);
    if (weekdayDef) {
      this._setDraftValue(weekdayDef.weekday, value);
    }
  }

  private _setDraftValue(weekday: number, value: string): void {
    if (value === '') {
      this._draft.delete(weekday);
    } else {
      this._draft.set(weekday, Number(value));
    }
    this._render();
  }

  // ---------------------------------------------------------------------------------------
  // School year carousel
  // ---------------------------------------------------------------------------------------

  private _canGoToPreviousYear(): boolean {
    return this._academicYears.some((year) => year.startYear < this._selectedStartYear);
  }

  private _canGoToNextYear(): boolean {
    return this._selectedStartYear < this._currentSchoolYearStartYear + FORWARD_YEAR_WINDOW;
  }

  private _goToPreviousYear(): void {
    if (!this._canGoToPreviousYear()) return;
    this._selectedStartYear -= 1;
    void this._applySelectedYear();
  }

  private _goToNextYear(): void {
    if (!this._canGoToNextYear()) return;
    this._selectedStartYear += 1;
    void this._applySelectedYear();
  }

  /** Resets and re-derives cycle/módulo/draft for `_selectedStartYear` — called on first
   * load and every carousel move. Leaves everything empty (-> `schedule-empty-state`) when
   * this teacher has no `academic_years` row for that school year yet. */
  private async _applySelectedYear(): Promise<void> {
    const row = this._academicYears.find((year) => year.startYear === this._selectedStartYear) ?? null;
    this._selectedAcademicYearId = row?.id ?? null;
    this._yearModules = [];
    this._selectedCycleId = null;
    this._selectedModuleId = null;
    this._draft = new Map();
    this._saveMessage = null;
    this._render();

    if (row === null) return;

    const modules = await this.academicYearService.listModules(row.id);
    if (this._selectedAcademicYearId !== row.id) return; // stale — the year changed again meanwhile
    this._yearModules = modules;
    this._selectFirstCycle();
    this._selectFirstModuleForCycle();
    this._render();
    void this._loadSchedule();
  }

  // ---------------------------------------------------------------------------------------
  // Cycle / módulo cascade
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

  private _modulesForSelectedCycle(): AcademicYearModuleDetail[] {
    if (this._selectedCycleId === null) return [];
    return [...this._yearModules.filter((module) => module.catalogTrainingCycleId === this._selectedCycleId)].sort(
      (a, b) => a.course - b.course || a.name.localeCompare(b.name),
    );
  }

  private _selectFirstCycle(): void {
    const cycles = this._distinctCyclesFromYearModules();
    this._selectedCycleId = cycles.length > 0 ? cycles[0]!.id : null;
  }

  private _selectFirstModuleForCycle(): void {
    const modules = this._modulesForSelectedCycle();
    this._selectedModuleId = modules.length > 0 ? modules[0]!.id : null;
  }

  // ---------------------------------------------------------------------------------------
  // Schedule load / save
  // ---------------------------------------------------------------------------------------

  private async _loadSchedule(): Promise<void> {
    const moduleId = this._selectedModuleId;
    if (moduleId === null) {
      this._draft = new Map();
      this._render();
      return;
    }

    const entries = await this.scheduleService.find(moduleId);
    if (this._selectedModuleId !== moduleId) return; // stale — the módulo changed again meanwhile
    this._draft = new Map(entries.map((entry) => [entry.weekday, entry.hours]));
    this._render();
  }

  private async _save(): Promise<void> {
    const moduleId = this._selectedModuleId;
    if (moduleId === null) return;

    this._saving = true;
    this._render();

    const entries: ScheduleEntry[] = WEEKDAYS.filter((weekdayDef) => this._draft.has(weekdayDef.weekday)).map(
      (weekdayDef) => ({ weekday: weekdayDef.weekday, hours: this._draft.get(weekdayDef.weekday)! }),
    );

    const result = await this.scheduleService.save(moduleId, entries);
    this._saving = false;
    if (this._selectedModuleId !== moduleId) return; // stale — the módulo changed again while saving

    this._saveMessage = result.outcome === 'success' ? 'Horario guardado correctamente' : 'No se pudo guardar el horario';
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
        <div class="flex flex-col gap-6 p-4">
          ${renderSettingsNav('horario')} ${this._renderFilters()}
          ${this._selectedModuleId === null ? this._renderEmptyState() : this._renderScheduleSection()}
        </div>
      `,
      this.shadowRoot!,
    );
  }

  private _renderFilters(): TemplateResult {
    const yearLabel = `${this._selectedStartYear}-${this._selectedStartYear + 1}`;
    const cycles = this._distinctCyclesFromYearModules();
    const modules = this._modulesForSelectedCycle();

    return html`
      <section class="${classesFor('card')} flex flex-wrap items-center gap-6 px-4 py-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="${classesFor('icon-button', 'ghost', 'sm')}"
            data-element-id="schedule-academic-year-filter-prev"
            aria-label="Año académico anterior"
            ?disabled=${!this._canGoToPreviousYear()}
          >
            ‹
          </button>
          <p class="${classesFor('paragraph')}" data-element-id="schedule-academic-year-filter-value">${yearLabel}</p>
          <button
            type="button"
            class="${classesFor('icon-button', 'ghost', 'sm')}"
            data-element-id="schedule-academic-year-filter-next"
            aria-label="Año académico siguiente"
            ?disabled=${!this._canGoToNextYear()}
          >
            ›
          </button>
        </div>

        <label class="flex items-center gap-2 ${classesFor('paragraph')}">
          Ciclo
          <select class="${classesFor('select')}" data-element-id="schedule-cycle-filter" ?disabled=${cycles.length === 0}>
            ${cycles.map(
              (cycle) => html`<option value="${cycle.id}" ?selected=${cycle.id === this._selectedCycleId}>${cycle.name}</option>`,
            )}
          </select>
        </label>

        <label class="flex items-center gap-2 ${classesFor('paragraph')}">
          Módulo
          <select class="${classesFor('select')}" data-element-id="schedule-module-filter" ?disabled=${modules.length === 0}>
            ${modules.map(
              (module) => html`<option value="${module.id}" ?selected=${module.id === this._selectedModuleId}>${module.name}</option>`,
            )}
          </select>
        </label>
      </section>
    `;
  }

  private _renderEmptyState(): TemplateResult {
    return html`<p class="${classesFor('paragraph')}" data-element-id="schedule-empty-state">
      Selecciona un módulo para ver y editar su horario.
    </p>`;
  }

  private _renderScheduleSection(): TemplateResult {
    return html`
      <section class="${classesFor('card')} flex flex-col gap-4 px-4 py-4">
        <div class="flex flex-wrap gap-4">${WEEKDAYS.map((weekdayDef) => this._renderWeekdaySelect(weekdayDef))}</div>
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="${classesFor('submit-button', 'primary', 'md')}"
            data-element-id="schedule-save-button"
            ?disabled=${this._saving}
          >
            ${this._saving ? 'Guardando…' : 'Guardar horario'}
          </button>
          ${this._renderSaveMessage()}
        </div>
      </section>
    `;
  }

  private _renderWeekdaySelect(weekdayDef: WeekdayDef): TemplateResult {
    const value = this._draft.has(weekdayDef.weekday) ? String(this._draft.get(weekdayDef.weekday)) : '';

    return html`
      <label class="flex flex-col gap-1 ${classesFor('paragraph')}">
        ${weekdayDef.label}
        <select class="${classesFor('select')}" data-element-id="${weekdayDef.elementId}">
          <option value="" ?selected=${value === ''}>Sin clase</option>
          ${HOURS_OPTIONS.map((hours) => html`<option value="${hours}" ?selected=${value === hours}>${hours}</option>`)}
        </select>
      </label>
    `;
  }

  private _renderSaveMessage(): TemplateResult | string {
    if (this._saveMessage === null) {
      return '';
    }
    return html`<p class="${classesFor('paragraph')}" data-element-id="schedule-save-message" aria-live="polite">
      ${this._saveMessage}
    </p>`;
  }
}

customElements.define('app-schedule-settings-view', ScheduleSettingsView);
