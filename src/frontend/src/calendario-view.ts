import { html, nothing, render, type TemplateResult } from 'lit-html';
import { attachSharedStyles } from './styles/shadow-styles';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { ToastController, renderToast } from './toast';
import type { SessionApiService } from './session-api-service';
import type { AcademicYear, AcademicYearApiService, AcademicYearModuleDetail } from './academic-year-api-service';
import type { CalendarioModuloApiService, CalendarioModuloEntry } from './calendario-modulo-api-service';

interface DistinctCycle {
  id: string;
  name: string;
}

/** This view only ever calls `list()`/`listModules()` on the injected academic-year
 * service (ISP) — the full `AcademicYearApiService` also carries write methods
 * (`update`/`remove`/`createWithSelection`/`extendSelection`/`removeModule`) this
 * read-only screen never uses. `Pick` keeps the two shared method signatures in sync with
 * `academic-year-api-service.ts` instead of redeclaring them. */
type CalendarioAcademicYearApiService = Pick<AcademicYearApiService, 'list' | 'listModules'>;

const RED_CATEGORIES: readonly string[] = ['academic_key_dates', 'holidays', 'public_holidays', 'free_disposal_days'];
const BLUE_CATEGORIES: readonly string[] = ['evaluations', 'feoe_project_days'];

const RED_HEX = '#fca5a5';
const BLUE_HEX = '#93c5fd';
const FALLBACK_HEX = '#cbd5e1';

const CATEGORY_COLOR_HEX: Record<string, string> = {
  ...Object.fromEntries(RED_CATEGORIES.map((category) => [category, RED_HEX])),
  ...Object.fromEntries(BLUE_CATEGORIES.map((category) => [category, BLUE_HEX])),
};

const FORWARD_YEAR_WINDOW = 5;
/** Beyond this many inclusive days, a range only marks its own boundaries (see
 * `views/calendario/use-cases.md` UC-04/A1). */
const LONG_RANGE_THRESHOLD_DAYS = 30;

const MONTH_LABELS: readonly string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAY_LABELS: readonly string[] = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const DAY_ELEMENT_ID_PATTERN = /^calendario-month-(\d{4})-(\d{2})-day-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** September (month index >= 8, 0-indexed) or later belongs to that calendar year's school
 * year; earlier months belong to the school year that started the previous calendar year. */
function currentSchoolYearStartYear(today: Date): number {
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
}

/** September of `startYear` through June of `startYear + 1`, in order — 10 months. */
function schoolYearMonths(startYear: number): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  for (let offset = 0; offset < 10; offset += 1) {
    const monthIndex = 8 + offset; // 0-indexed, wraps into the following calendar year past index 11
    const date = new Date(Date.UTC(startYear, monthIndex, 1));
    months.push({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
  }
  return months;
}

function monthElementId(year: number, month: number): string {
  return `calendario-month-${year}-${pad2(month)}`;
}

function dayDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** `month` is 1-indexed. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday-first weekday index (0 = Monday ... 6 = Sunday) for `month` (1-indexed), `day`. */
function mondayFirstWeekday(year: number, month: number, day: number): number {
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const millisBetween =
    Date.UTC(endYear!, endMonth! - 1, endDay!) - Date.UTC(startYear!, startMonth! - 1, startDay!);
  return Math.round(millisBetween / 86_400_000) + 1;
}

/** A `calendario_modulo` entry covers every day in its range when that range spans at most
 * `LONG_RANGE_THRESHOLD_DAYS` days (inclusive of both boundaries); a longer range only
 * covers its own `startDate`/`endDate` (see `views/calendario/use-cases.md` UC-04/A1). ISO
 * `YYYY-MM-DD` strings compare lexicographically the same as chronologically, so no `Date`
 * parsing is needed for the range-membership check itself. */
function entryCoversDay(entry: CalendarioModuloEntry, dayDate: string): boolean {
  if (dayDate < entry.startDate || dayDate > entry.endDate) return false;
  if (daysBetweenInclusive(entry.startDate, entry.endDate) <= LONG_RANGE_THRESHOLD_DAYS) return true;
  return dayDate === entry.startDate || dayDate === entry.endDate;
}

function entriesCoveringDay(entries: readonly CalendarioModuloEntry[], dayDate: string): CalendarioModuloEntry[] {
  return entries.filter((entry) => entryCoversDay(entry, dayDate));
}

/** Distinct category names covering `dayDate`, in first-seen order. */
function categoriesForDay(entries: readonly CalendarioModuloEntry[], dayDate: string): string[] {
  const categories: string[] = [];
  for (const entry of entriesCoveringDay(entries, dayDate)) {
    if (!categories.includes(entry.category)) categories.push(entry.category);
  }
  return categories;
}

/** One solid color when a single category (or several of the same color) applies; a hard-
 * stop `linear-gradient` band per distinct color when categories of both colors apply
 * (see `views/calendario/use-cases.md` UC-04/A2) — never a smooth blend. */
function backgroundStyleForCategories(categories: readonly string[]): string {
  const colors = Array.from(new Set(categories.map((category) => CATEGORY_COLOR_HEX[category] ?? FALLBACK_HEX)));
  if (colors.length === 0) return '';
  if (colors.length === 1) return `background-color: ${colors[0]};`;

  const bandWidth = 100 / colors.length;
  const stops = colors
    .map((color, index) => `${color} ${index * bandWidth}%, ${color} ${(index + 1) * bandWidth}%`)
    .join(', ');
  return `background-image: linear-gradient(90deg, ${stops});`;
}

function parseDayElementId(elementId: string): string | null {
  const match = DAY_ELEMENT_ID_PATTERN.exec(elementId);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Calendario screen — own top-level custom element, single Shadow DOM (CLAUDE.md's "no
 * nested Shadow DOM" rule). Read-only: renders exclusively from `calendario_modulo` via the
 * injected `calendarioModuloService`, never `key_dates` directly (see
 * `views/calendario/description_calendario.md`). See `views/calendario/ui-spec.json`
 * (`calendario-screen`) for element design and `views/calendario/use-cases.md` UC-01..UC-05
 * for the business rules implemented here.
 *
 * Three cascading filters — school year (simulated carousel, no real `<select>`) -> ciclo
 * -> módulo — each derived client-side from `academicYearService.listModules(id)`, the same
 * dedup-by-`catalogTrainingCycleId` derivation `academic-year-settings-view.ts` already
 * uses for `training-cycle-table`/`module-table` (see that file's
 * `_distinctCyclesFromYearModules`).
 *
 * `today` is a settable property (defaults to `new Date()`), a deliberate testing seam so
 * the date-dependent "current school year" default is deterministic in tests instead of
 * depending on the real wall-clock date — same setter-injection style already used for
 * services, applied here to a pure computation.
 */
export class CalendarioView extends HTMLElement {
  private _sessionService: SessionApiService | null = null;
  private _academicYearService: CalendarioAcademicYearApiService | null = null;
  private _calendarioModuloService: CalendarioModuloApiService | null = null;
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

  private _calendarEntries: CalendarioModuloEntry[] = [];

  private readonly _toast: ToastController = new ToastController(() => this._render());

  private _disposables: Array<() => void> = [];

  set sessionService(value: SessionApiService) {
    this._sessionService = value;
  }

  get sessionService(): SessionApiService {
    if (this._sessionService === null) {
      throw new Error('CalendarioView.sessionService must be set before use');
    }
    return this._sessionService;
  }

  set academicYearService(value: CalendarioAcademicYearApiService) {
    this._academicYearService = value;
  }

  get academicYearService(): CalendarioAcademicYearApiService {
    if (this._academicYearService === null) {
      throw new Error('CalendarioView.academicYearService must be set before use');
    }
    return this._academicYearService;
  }

  set calendarioModuloService(value: CalendarioModuloApiService) {
    this._calendarioModuloService = value;
  }

  get calendarioModuloService(): CalendarioModuloApiService {
    if (this._calendarioModuloService === null) {
      throw new Error('CalendarioView.calendarioModuloService must be set before use');
    }
    return this._calendarioModuloService;
  }

  set today(value: Date) {
    this._today = value;
  }

  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    attachSharedStyles(this.shadowRoot!);
    this._render();

    const onClick = (event: Event): void => this._handleClick(event);
    const onChange = (event: Event): void => this._handleChange(event);
    // `mouseenter`/`mouseleave` never bubble and, in practice, never reach a capture-phase
    // listener registered on a ShadowRoot for real pointer movement either — verified live
    // in Chrome: genuine mouse movement fires `mouseover`/`mouseout`/`mousemove` on the day
    // cell exactly as expected, but zero `mouseenter`/`mouseleave` events at all (only a
    // synthetic `dispatchEvent(new MouseEvent('mouseenter', ...))`, as unit tests and
    // Cypress's `.trigger()` both use, ever reached it — masking this in every automated
    // check). `mouseover`/`mouseout` bubble normally, so plain bubble-phase delegation
    // (same as click/change above) works reliably for real hover.
    const onDayMouseOver = (event: Event): void => this._handleDayMouseOver(event);
    const onDayMouseOut = (event: Event): void => this._handleDayMouseOut(event);
    this.shadowRoot!.addEventListener('click', onClick);
    this.shadowRoot!.addEventListener('change', onChange);
    this.shadowRoot!.addEventListener('mouseover', onDayMouseOver);
    this.shadowRoot!.addEventListener('mouseout', onDayMouseOut);
    this._disposables.push(
      () => this.shadowRoot!.removeEventListener('click', onClick),
      () => this.shadowRoot!.removeEventListener('change', onChange),
      () => this.shadowRoot!.removeEventListener('mouseover', onDayMouseOver),
      () => this.shadowRoot!.removeEventListener('mouseout', onDayMouseOut),
    );

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

    this._currentSchoolYearStartYear = currentSchoolYearStartYear(this._today);
    this._selectedStartYear = this._currentSchoolYearStartYear;

    this._academicYears = await this.academicYearService.list();
    this._loaded = true;

    void this._applySelectedYear();
  }

  // ---------------------------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------------------------

  private _handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;

    if (elementId === 'back-to-dashboard-link') {
      redirectTo('/dashboard');
      return;
    }
    if (elementId === 'academic-year-filter-prev') {
      this._goToPreviousYear();
      return;
    }
    if (elementId === 'academic-year-filter-next') {
      this._goToNextYear();
    }
  }

  private _handleChange(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;
    const value = (target as HTMLSelectElement).value;

    if (elementId === 'cycle-filter') {
      this._selectedCycleId = value;
      this._selectFirstModuleForCycle();
      this._render();
      void this._loadCalendar();
      return;
    }
    if (elementId === 'module-filter') {
      this._selectedModuleId = value;
      this._render();
      void this._loadCalendar();
    }
  }

  private _handleDayMouseOver(event: Event): void {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>('[data-calendario-day-categories]');
    if (!target) return;
    const dayDate = parseDayElementId(target.dataset.elementId ?? '');
    if (dayDate === null) return;

    const entries = entriesCoveringDay(this._calendarEntries, dayDate);
    if (entries.length === 0) return;

    this._toast.show(
      entries.map((entry) => entry.name).join('\n'),
      'info',
    );
  }

  private _handleDayMouseOut(event: Event): void {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>('[data-calendario-day-categories]');
    if (!target) return;
    this._toast.dismiss();
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

  /** Resets and re-derives cycle/módulo/calendar for `_selectedStartYear` — called on
   * first load and every carousel move. Leaves everything empty (→
   * `calendario-empty-state`) when this teacher has no `academic_years` row for that
   * school year yet. */
  private async _applySelectedYear(): Promise<void> {
    const row = this._academicYears.find((year) => year.startYear === this._selectedStartYear) ?? null;
    this._selectedAcademicYearId = row?.id ?? null;
    this._yearModules = [];
    this._selectedCycleId = null;
    this._selectedModuleId = null;
    this._calendarEntries = [];
    this._render();

    if (row === null) return;

    const modules = await this.academicYearService.listModules(row.id);
    if (this._selectedAcademicYearId !== row.id) return; // stale — the year changed again meanwhile
    this._yearModules = modules;
    this._selectFirstCycle();
    this._selectFirstModuleForCycle();
    this._render();
    void this._loadCalendar();
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

  private async _loadCalendar(): Promise<void> {
    const moduleId = this._selectedModuleId;
    if (moduleId === null) {
      this._calendarEntries = [];
      this._render();
      return;
    }

    const entries = await this.calendarioModuloService.findForModule(moduleId);
    if (this._selectedModuleId !== moduleId) return; // stale — the módulo changed again meanwhile
    this._calendarEntries = entries;
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
        <div class="flex flex-col gap-6 p-4">
          ${this._renderNav()} ${this._renderFilters()} ${this._renderCalendarSection()}
        </div>
        ${renderToast('calendario-day-toast', this._toast.current, () => this._toast.dismiss())}
      `,
      this.shadowRoot!,
    );
  }

  private _renderNav(): TemplateResult {
    return html`
      <nav class="${classesFor('card')} flex items-center justify-between px-4 py-3">
        <h1 class="${classesFor('heading')}" data-element-id="calendario-heading">Calendario</h1>
        <a class="${classesFor('link', 'link')} text-slate-500" data-element-id="back-to-dashboard-link" tabindex="0" role="link">
          Volver
        </a>
      </nav>
    `;
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
            data-element-id="academic-year-filter-prev"
            aria-label="Año académico anterior"
            ?disabled=${!this._canGoToPreviousYear()}
          >
            ‹
          </button>
          <p class="${classesFor('paragraph')}" data-element-id="academic-year-filter-value">${yearLabel}</p>
          <button
            type="button"
            class="${classesFor('icon-button', 'ghost', 'sm')}"
            data-element-id="academic-year-filter-next"
            aria-label="Año académico siguiente"
            ?disabled=${!this._canGoToNextYear()}
          >
            ›
          </button>
        </div>

        <label class="flex items-center gap-2 ${classesFor('paragraph')}">
          Ciclo
          <select class="${classesFor('select')}" data-element-id="cycle-filter" ?disabled=${cycles.length === 0}>
            ${cycles.map(
              (cycle) => html`<option value="${cycle.id}" ?selected=${cycle.id === this._selectedCycleId}>${cycle.name}</option>`,
            )}
          </select>
        </label>

        <label class="flex items-center gap-2 ${classesFor('paragraph')}">
          Módulo
          <select class="${classesFor('select')}" data-element-id="module-filter" ?disabled=${modules.length === 0}>
            ${modules.map(
              (module) => html`<option value="${module.id}" ?selected=${module.id === this._selectedModuleId}>${module.name}</option>`,
            )}
          </select>
        </label>
      </section>
    `;
  }

  /**
   * calendario-months only renders once the selected módulo's calendario_modulo snapshot
   * has at least one entry — zero entries (no year row for the selected school year, a year
   * row with no cycles/módulos, or a módulo assigned but never generated) always renders
   * calendario-empty-state instead, per functional-spec.json's calendario-months acceptance
   * criteria.
   */
  private _renderCalendarSection(): TemplateResult {
    return this._calendarEntries.length > 0 ? this._renderMonthsGrid() : this._renderEmptyState();
  }

  private _renderEmptyState(): TemplateResult {
    return html`<p class="${classesFor('paragraph')}" data-element-id="calendario-empty-state">
      Este módulo todavía no tiene calendario generado.
    </p>`;
  }

  private _renderMonthsGrid(): TemplateResult {
    return html`
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" data-element-id="calendario-months">
        ${schoolYearMonths(this._selectedStartYear).map(({ year, month }) => this._renderMonthCard(year, month))}
      </div>
    `;
  }

  private _renderMonthCard(year: number, month: number): TemplateResult {
    const monthId = monthElementId(year, month);
    const leadingBlanks = mondayFirstWeekday(year, month, 1);
    const totalDays = daysInMonth(year, month);

    return html`
      <div class="${classesFor('card')} flex flex-col gap-2 p-3" data-element-id="${monthId}">
        <h3 class="${classesFor('heading')} text-sm">${MONTH_LABELS[month - 1]} ${year}</h3>
        <div class="grid grid-cols-7 gap-1 text-center text-xs">
          ${WEEKDAY_LABELS.map((label) => html`<span class="text-slate-400">${label}</span>`)}
          ${Array.from({ length: leadingBlanks }, () => html`<span></span>`)}
          ${Array.from({ length: totalDays }, (_, index) => this._renderDayCell(year, month, index + 1))}
        </div>
      </div>
    `;
  }

  private _renderDayCell(year: number, month: number, day: number): TemplateResult {
    const dayDate = dayDateString(year, month, day);
    const categories = categoriesForDay(this._calendarEntries, dayDate);
    const style = categories.length > 0 ? backgroundStyleForCategories(categories) : '';

    return html`
      <div
        class="flex h-7 w-7 items-center justify-center rounded"
        style="${style}"
        data-element-id="${monthElementId(year, month)}-day-${pad2(day)}"
        data-calendario-day-categories="${categories.length > 0 ? categories.join(',') : nothing}"
      >
        ${day}
      </div>
    `;
  }
}

customElements.define('app-calendario-view', CalendarioView);
