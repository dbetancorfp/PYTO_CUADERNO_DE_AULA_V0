import { html, nothing, render, type TemplateResult } from 'lit-html';
import { attachSharedStyles } from './styles/shadow-styles';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import type { SessionApiService } from './session-api-service';
import type { AcademicYear, AcademicYearApiService, AcademicYearModuleDetail } from './academic-year-api-service';
import type { CalendarioModuloApiService, CalendarioModuloEntry } from './calendario-modulo-api-service';
import type { EvaluationWorkingDaysApiService, EvaluationWorkingDaysEntry } from './evaluation-working-days-api-service';
import type { CalendarioHorarioApiService, CalendarioHorarioEntry } from './calendario-horario-api-service';

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

/** One row of UC-11's canonical color table — the single source of truth both
 * `calendario-months`'s day-cell backgrounds and `calendario-legend`'s swatches read from
 * (see `views/calendario/use-cases.md` UC-11, 2026-08-10). Rows 1-12 match a
 * `calendario_modulo` entry by `(category, type)` equality; rows 13-14 (`final_exams`, which
 * has no `type` column) match by `name`'s suffix instead — the two match kinds are mutually
 * exclusive per row (OCP: a new row is just a new table entry, never a code change to the
 * matching logic itself). */
interface ColorTableRowBase {
  readonly row: number;
  readonly category: string;
  readonly label: string;
  readonly hex: string;
}
interface ColorTableRowByType extends ColorTableRowBase {
  readonly type: string;
  readonly nameSuffix?: undefined;
}
interface ColorTableRowBySuffix extends ColorTableRowBase {
  readonly type?: undefined;
  readonly nameSuffix: string;
}
type ColorTableRow = ColorTableRowByType | ColorTableRowBySuffix;

/** UC-11's canonical color table, in its canonical (also `calendario-legend`'s render)
 * order — row numbers 1-14 double as `calendario-legend-item-<N>`'s `<N>`. */
const COLOR_TABLE: readonly ColorTableRow[] = [
  { row: 1, category: 'academic_key_dates', type: 'Curso escolar', label: 'Curso escolar', hex: '#2a78d6' },
  { row: 2, category: 'academic_key_dates', type: 'Presentación de proyectos', label: 'Presentación de proyectos', hex: '#75a7e4' },
  { row: 3, category: 'holidays', type: 'Vacaciones', label: 'Vacaciones', hex: '#eda100' },
  { row: 4, category: 'public_holidays', type: 'Festivo nacional', label: 'Festivo nacional', hex: '#eb6834' },
  { row: 5, category: 'public_holidays', type: 'Festivo autonómico', label: 'Festivo autonómico', hex: '#ef8961' },
  { row: 6, category: 'public_holidays', type: 'Festivo insular (Tenerife)', label: 'Festivo insular (Tenerife)', hex: '#f4aa8d' },
  { row: 7, category: 'public_holidays', type: 'Festivo local (Puerto de la Cruz)', label: 'Festivo local (Puerto de la Cruz)', hex: '#f7c6b2' },
  { row: 8, category: 'free_disposal_days', type: 'Libre disposición', label: 'Libre disposición', hex: '#1baf7a' },
  // `type`'s real value has no accent on "dia" and is singular "nota" — the label shown in
  // the legend is the correctly accented, plural "notas" spelling. Deliberately different
  // literals; not a typo.
  { row: 9, category: 'evaluations', type: 'Último dia para poner nota', label: 'Último día para poner notas', hex: '#e87ba4' },
  { row: 10, category: 'evaluations', type: 'Sesión evaluación', label: 'Sesión de evaluación', hex: '#ee9cbb' },
  { row: 11, category: 'evaluations', type: 'Atención familiar', label: 'Atención familiar', hex: '#f4bdd2' },
  { row: 12, category: 'feoe_project_days', type: 'Día de alternancia', label: 'Día de alternancia (FEOE)', hex: '#4a3aa7' },
  { row: 13, category: 'final_exams', nameSuffix: 'Examen final.', label: 'Examen final', hex: '#008300' },
  { row: 14, category: 'final_exams', nameSuffix: 'Examen de recuperación final.', label: 'Examen de recuperación final', hex: '#59ae59' },
];

/** Plain Saturday/Sunday with no `calendario_modulo` entry covering it — a calendar-
 * structure cue, not a `(category, type)` color, so it has no `calendario-legend` entry (see
 * `views/calendario/use-cases.md` UC-04/A4). */
const WEEKEND_NEUTRAL_HEX = '#cbd5e1';

/** The Horario overlay's ring color (UC-12/UC-13, 2026-08-11) — an independent data source
 * from `calendario_modulo`'s color table, never a 15th color-table row: it's layered as a
 * ring/border around the day number over whatever `(category,type)` fill already covers
 * that day, never replacing it. */
const HORARIO_RING_HEX = '#06b6d4';

function isSuffixRow(row: ColorTableRow): row is ColorTableRowBySuffix {
  return row.nameSuffix !== undefined;
}

function rowMatchesEntry(row: ColorTableRow, entry: CalendarioModuloEntry): boolean {
  if (row.category !== entry.category) return false;
  return isSuffixRow(row) ? entry.name.endsWith(row.nameSuffix) : entry.type === row.type;
}

/** The color-table row a `calendario_modulo` entry's day cell / legend swatch is drawn from:
 * an exact `(category, type)` (or `final_exams` name-suffix) match when one exists, otherwise
 * that category's own row-1 as the documented fallback (see UC-04/UC-11). Every category this
 * screen ever receives from the backend has at least one table row, so the fallback always
 * resolves. */
function colorRowForEntry(entry: CalendarioModuloEntry): ColorTableRow | undefined {
  return COLOR_TABLE.find((row) => rowMatchesEntry(row, entry)) ?? COLOR_TABLE.find((row) => row.category === entry.category);
}

function entryHex(entry: CalendarioModuloEntry): string {
  return colorRowForEntry(entry)?.hex ?? WEEKEND_NEUTRAL_HEX;
}

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

/** Distinct resolved hex colors (per entry, via `entryHex`/UC-11's color table) covering
 * `dayDate`, in first-seen order. */
function hexesForDay(entries: readonly CalendarioModuloEntry[], dayDate: string): string[] {
  const hexes: string[] = [];
  for (const entry of entriesCoveringDay(entries, dayDate)) {
    const hex = entryHex(entry);
    if (!hexes.includes(hex)) hexes.push(hex);
  }
  return hexes;
}

/** One solid color when a single hex (or several entries resolving to the same hex)
 * applies; a hard-stop `linear-gradient` band per distinct hex when entries of different
 * colors apply (see `views/calendario/use-cases.md` UC-04/A2) — never a smooth blend. */
function backgroundStyleForHexes(hexes: readonly string[]): string {
  if (hexes.length === 0) return '';
  if (hexes.length === 1) return `background-color: ${hexes[0]};`;

  const bandWidth = 100 / hexes.length;
  const stops = hexes
    .map((hex, index) => `${hex} ${index * bandWidth}%, ${hex} ${(index + 1) * bandWidth}%`)
    .join(', ');
  return `background-image: linear-gradient(90deg, ${stops});`;
}

/** A day covered by at least one `calendario_modulo` entry always renders that entry's (or
 * those entries') real resolved color(s) — weekday or weekend alike, never darkened (see
 * `views/calendario/use-cases.md` UC-04/A4, 2026-08-10). A plain Saturday/Sunday with no
 * entry covering it renders `WEEKEND_NEUTRAL_HEX` instead of the plain-weekday's uncolored
 * background; an uncovered weekday renders uncolored. */
function backgroundStyleForDay(weekday: number, entries: readonly CalendarioModuloEntry[], dayDate: string): string {
  const hexes = hexesForDay(entries, dayDate);
  if (hexes.length > 0) return backgroundStyleForHexes(hexes);

  const isWeekend = weekday >= 5;
  return isWeekend ? `background-color: ${WEEKEND_NEUTRAL_HEX};` : '';
}

/** The `calendario_horario` row covering `dayDate`, if any (UC-12/UC-13, 2026-08-11) — at
 * most one row exists per date, per module, since UC-12's generation is a full
 * delete-then-reinsert keyed by date. */
function horarioEntryForDay(entries: readonly CalendarioHorarioEntry[], dayDate: string): CalendarioHorarioEntry | undefined {
  return entries.find((entry) => entry.date === dayDate);
}

/** An inset ring, layered over (never replacing) `backgroundStyleForDay`'s own
 * background-color/-image declaration in the same `style` attribute (UC-13). */
function ringStyleForDay(hasHorarioEntry: boolean): string {
  return hasHorarioEntry ? `box-shadow: inset 0 0 0 2px ${HORARIO_RING_HEX};` : '';
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
  private _evaluationWorkingDaysService: EvaluationWorkingDaysApiService | null = null;
  private _calendarioHorarioService: CalendarioHorarioApiService | null = null;
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
  private _evaluationWorkingDaysEntries: EvaluationWorkingDaysEntry[] = [];
  private _calendarioHorarioEntries: CalendarioHorarioEntry[] = [];

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

  set evaluationWorkingDaysService(value: EvaluationWorkingDaysApiService) {
    this._evaluationWorkingDaysService = value;
  }

  get evaluationWorkingDaysService(): EvaluationWorkingDaysApiService {
    if (this._evaluationWorkingDaysService === null) {
      throw new Error('CalendarioView.evaluationWorkingDaysService must be set before use');
    }
    return this._evaluationWorkingDaysService;
  }

  set calendarioHorarioService(value: CalendarioHorarioApiService) {
    this._calendarioHorarioService = value;
  }

  get calendarioHorarioService(): CalendarioHorarioApiService {
    if (this._calendarioHorarioService === null) {
      throw new Error('CalendarioView.calendarioHorarioService must be set before use');
    }
    return this._calendarioHorarioService;
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
    this.shadowRoot!.addEventListener('click', onClick);
    this.shadowRoot!.addEventListener('change', onChange);
    this._disposables.push(
      () => this.shadowRoot!.removeEventListener('click', onClick),
      () => this.shadowRoot!.removeEventListener('change', onChange),
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
      void this._loadEvaluationWorkingDays();
      void this._loadCalendarioHorario();
      return;
    }
    if (elementId === 'module-filter') {
      this._selectedModuleId = value;
      this._render();
      void this._loadCalendar();
      void this._loadEvaluationWorkingDays();
      void this._loadCalendarioHorario();
    }
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
    this._evaluationWorkingDaysEntries = [];
    this._calendarioHorarioEntries = [];
    this._render();

    if (row === null) return;

    const modules = await this.academicYearService.listModules(row.id);
    if (this._selectedAcademicYearId !== row.id) return; // stale — the year changed again meanwhile
    this._yearModules = modules;
    this._selectFirstCycle();
    this._selectFirstModuleForCycle();
    this._render();
    void this._loadCalendar();
    void this._loadEvaluationWorkingDays();
    void this._loadCalendarioHorario();
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

  /** Loads `evaluation-working-days-summary`'s data for the selected módulo — same
   * trigger points as `_loadCalendar` (initial load, cycle change, módulo change; see
   * `views/calendario/use-cases.md` UC-10). */
  private async _loadEvaluationWorkingDays(): Promise<void> {
    const moduleId = this._selectedModuleId;
    if (moduleId === null) {
      this._evaluationWorkingDaysEntries = [];
      this._render();
      return;
    }

    const entries = await this.evaluationWorkingDaysService.findForModule(moduleId);
    if (this._selectedModuleId !== moduleId) return; // stale — the módulo changed again meanwhile
    this._evaluationWorkingDaysEntries = entries;
    this._render();
  }

  /** Loads the Horario overlay's data for the selected módulo — same trigger points as
   * `_loadCalendar`/`_loadEvaluationWorkingDays` (initial load, cycle change, módulo
   * change; see `views/calendario/use-cases.md` UC-13). An independent data source from
   * `calendario_modulo`: most days it covers have no `calendario_modulo` entry at all. */
  private async _loadCalendarioHorario(): Promise<void> {
    const moduleId = this._selectedModuleId;
    if (moduleId === null) {
      this._calendarioHorarioEntries = [];
      this._render();
      return;
    }

    const entries = await this.calendarioHorarioService.findForModule(moduleId);
    if (this._selectedModuleId !== moduleId) return; // stale — the módulo changed again meanwhile
    this._calendarioHorarioEntries = entries;
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
          ${this._renderNav()} ${this._renderFilters()} ${this._renderLegend()} ${this._renderCalendarSection()}
        </div>
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
      <section class="${classesFor('card')} relative flex min-h-24 flex-wrap items-center gap-6 px-4 py-3">
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

        ${this._renderEvaluationWorkingDaysSummary()}
      </section>
    `;
  }

  /**
   * Far-right column of the filters row — one small-text line per `evaluationNumber`
   * present in the selected módulo's `calendario_evaluation_working_days` rows. The
   * filters `<section>` is `flex flex-wrap` (year carousel + Ciclo + Módulo already share
   * that row), so this block is deliberately taken out of that flex flow with `absolute`
   * positioning instead of `ml-auto` — an `ml-auto` flex child still participates in
   * wrapping, and on an ordinary desktop viewport the combined width of the carousel +
   * Ciclo + Módulo + this (fairly wide, 3-line) block exceeds the row's width, which wraps
   * it onto a second line and doubles the row's height. Positioned `absolute` against the
   * `relative` `<section>`, it overlays the top-right corner (`right-4 top-3`, matching the
   * section's own `px-4 py-3`) and can never affect the flex row's height regardless of
   * viewport or text width (see `views/calendario/use-cases.md` UC-10). `max-w-[13rem]` keeps
   * it from visually colliding with Ciclo/Módulo when both are long, and the section's own
   * `min-h-24` reserves enough room below `top-3` to contain all 3 lines even though this
   * block is taken out of the section's own height calculation by `absolute` — this keeps the
   * card's height constant across the empty/populated states instead of merely not-wrapping.
   * Text inside each line is left-aligned (`items-start`/`text-left`) for readability — only
   * the block itself, not its text, is anchored toward the section's right edge.
   * Renders nothing at all when the selected módulo has no rows yet (UC-10/A1).
   */
  private _renderEvaluationWorkingDaysSummary(): TemplateResult | typeof nothing {
    if (this._evaluationWorkingDaysEntries.length === 0) return nothing;

    return html`
      <div
        class="absolute right-4 top-3 flex max-w-[13rem] flex-col items-start gap-0.5 text-left text-xs"
        data-element-id="evaluation-working-days-summary"
      >
        ${[1, 2, 3].map((evaluationNumber) => this._renderEvaluationWorkingDaysLine(evaluationNumber))}
      </div>
    `;
  }

  private _renderEvaluationWorkingDaysLine(evaluationNumber: number): TemplateResult | typeof nothing {
    const entry = this._evaluationWorkingDaysEntries.find((candidate) => candidate.evaluationNumber === evaluationNumber);
    if (entry === undefined) return nothing;

    return html`<p data-element-id="evaluation-working-days-${evaluationNumber}">Días laborables ${evaluationNumber}ª evaluación: ${entry.workingDays}</p>`;
  }

  /**
   * calendario-legend — own card-style row directly below the filters row, one swatch+label
   * per UC-11 color-table row that has at least one matching entry in the currently loaded
   * `_calendarEntries` snapshot (the same full-módulo data `calendario-months` reads from,
   * not just what's visible on screen), in the table's fixed canonical order. Renders
   * nothing at all when the módulo has no `calendario_modulo` rows — same precondition
   * `calendario-empty-state` covers for `calendario-months` (UC-11/A1).
   */
  private _renderLegend(): TemplateResult | typeof nothing {
    const rows = COLOR_TABLE.filter((row) => this._calendarEntries.some((entry) => rowMatchesEntry(row, entry)));
    const showHorarioItem = this._calendarioHorarioEntries.length > 0;
    if (rows.length === 0 && !showHorarioItem) return nothing;

    return html`
      <section class="${classesFor('card')} flex flex-wrap items-center gap-3 px-4 py-3" data-element-id="calendario-legend">
        ${rows.map((row) => this._renderLegendItem(row))} ${showHorarioItem ? this._renderHorarioLegendItem() : nothing}
      </section>
    `;
  }

  private _renderLegendItem(row: ColorTableRow): TemplateResult {
    return html`
      <span
        class="${classesFor('badge')} gap-1"
        data-element-id="calendario-legend-item-${row.row}"
        style="background-color: ${row.hex};"
      >
        ${row.label}
      </span>
    `;
  }

  /** UC-13's 15th, always-last legend item — an outlined/ring swatch (not filled), since it
   * marks an overlay independent of `calendario_modulo`'s own 14-row color table, never one
   * more entry in that table. */
  private _renderHorarioLegendItem(): TemplateResult {
    return html`
      <span
        class="${classesFor('badge')} gap-1"
        data-element-id="calendario-legend-item-horario"
        style="background-color: transparent; border: 2px solid ${HORARIO_RING_HEX};"
      >
        Horario
      </span>
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
    const hasAnyData = this._calendarEntries.length > 0 || this._calendarioHorarioEntries.length > 0;
    return hasAnyData ? this._renderMonthsGrid() : this._renderEmptyState();
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
    const weekday = mondayFirstWeekday(year, month, day);
    const horarioEntry = horarioEntryForDay(this._calendarioHorarioEntries, dayDate);
    const style = `${backgroundStyleForDay(weekday, this._calendarEntries, dayDate)} ${ringStyleForDay(horarioEntry !== undefined)}`;
    const coveringEntries = entriesCoveringDay(this._calendarEntries, dayDate);

    return html`
      <div
        class="group relative flex h-7 w-7 items-center justify-center rounded"
        style="${style}"
        data-element-id="${monthElementId(year, month)}-day-${pad2(day)}"
        data-calendario-day-categories="${categories.length > 0 ? categories.join(',') : nothing}"
        data-calendario-horario="${horarioEntry !== undefined ? 'true' : nothing}"
      >
        ${day} ${this._renderDayTooltip(year, month, day, coveringEntries, horarioEntry)}
      </div>
    `;
  }

  /**
   * calendario-day-tooltip — pure Tailwind `group`/`group-hover:block` reveal (2026-08-10,
   * replaces the earlier `ToastController`/`renderToast`-based hover mechanism — see
   * `views/calendario/use-cases.md` UC-05). Always present in the DOM, hidden by default,
   * for a day covered by at least one `calendario_modulo` entry and/or a `calendario_horario`
   * row (2026-08-11, UC-13); absent entirely (not just visually hidden) for a day covered by
   * neither, per UC-05/A1. `calendario_modulo` event name(s) list first, unchanged; a final
   * "Horario: N horas" line is appended when that day also has a `calendario_horario` row.
   */
  private _renderDayTooltip(
    year: number,
    month: number,
    day: number,
    coveringEntries: readonly CalendarioModuloEntry[],
    horarioEntry: CalendarioHorarioEntry | undefined,
  ): TemplateResult | typeof nothing {
    if (coveringEntries.length === 0 && horarioEntry === undefined) return nothing;

    const lines = coveringEntries.map((entry) => entry.name);
    if (horarioEntry !== undefined) lines.push(`Horario: ${horarioEntry.hours} horas`);

    return html`
      <span
        class="${classesFor('card')} hidden group-hover:block absolute left-full top-0 z-20 ml-1 p-2 text-xs whitespace-pre-line"
        data-element-id="${monthElementId(year, month)}-day-${pad2(day)}-tooltip"
        >${lines.join('\n')}</span
      >
    `;
  }
}

customElements.define('app-calendario-view', CalendarioView);
