// Shared school-year carousel + Ciclo/Módulo cascade — the exact shape both
// calendario-view.ts and schedule-settings-view.ts already documented as identical
// (`lib/patterns/cascading-select.md`'s underlying idea, applied to a client-side-filtered
// yearModules list rather than a per-level fetch), extracted 2026-08-12 to close a
// SonarCloud duplication finding between the two files. Pure functions + one pure render
// helper — no state, no service dependency; each view still owns its own private fields
// and still decides what else happens on a filter change (SRP: this module only ever
// answers "what does the cascade allow/derive", never "what should reload because of it").
import { html, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';
import type { AcademicYear, AcademicYearModuleDetail } from './academic-year-api-service';

export interface DistinctCycle {
  id: string;
  name: string;
}

export const FORWARD_YEAR_WINDOW = 5;

/** September (month index >= 8, 0-indexed) or later belongs to that calendar year's school
 * year; earlier months belong to the school year that started the previous calendar year. */
export function currentSchoolYearStartYear(today: Date): number {
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
}

export function canGoToPreviousYear(academicYears: readonly AcademicYear[], selectedStartYear: number): boolean {
  return academicYears.some((year) => year.startYear < selectedStartYear);
}

export function canGoToNextYear(selectedStartYear: number, currentSchoolYearStartYearValue: number): boolean {
  return selectedStartYear < currentSchoolYearStartYearValue + FORWARD_YEAR_WINDOW;
}

/** Distinct cycles present in `yearModules`, in first-seen order. */
export function distinctCyclesFromYearModules(yearModules: readonly AcademicYearModuleDetail[]): DistinctCycle[] {
  const seen = new Set<string>();
  const cycles: DistinctCycle[] = [];
  for (const module of yearModules) {
    if (!seen.has(module.catalogTrainingCycleId)) {
      seen.add(module.catalogTrainingCycleId);
      cycles.push({ id: module.catalogTrainingCycleId, name: module.catalogTrainingCycleName });
    }
  }
  return cycles;
}

/** Módulos belonging to `selectedCycleId`, sorted by course then name. */
export function modulesForSelectedCycle(
  yearModules: readonly AcademicYearModuleDetail[],
  selectedCycleId: string | null,
): AcademicYearModuleDetail[] {
  if (selectedCycleId === null) return [];
  return [...yearModules.filter((module) => module.catalogTrainingCycleId === selectedCycleId)].sort(
    (a, b) => a.course - b.course || a.name.localeCompare(b.name),
  );
}

/** Renders the year-carousel + Ciclo/Módulo `<select>` markup shared by both screens' own
 * filters `<section>` — the caller supplies its own `<section>` wrapper (classes differ:
 * `calendario-view.ts` adds `relative min-h-24` for its absolutely-positioned working-days
 * summary) and its own `data-element-id` prefix (`''` for calendario, `'schedule-'` for
 * Configuración → Horario). */
export function renderYearCycleModuleFilters(params: {
  idPrefix: string;
  yearLabel: string;
  canGoToPreviousYear: boolean;
  canGoToNextYear: boolean;
  cycles: readonly DistinctCycle[];
  selectedCycleId: string | null;
  modules: readonly AcademicYearModuleDetail[];
  selectedModuleId: string | null;
}): TemplateResult {
  const { idPrefix, yearLabel, cycles, selectedCycleId, modules, selectedModuleId } = params;

  return html`
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="${classesFor('icon-button', 'ghost', 'sm')}"
        data-element-id="${idPrefix}academic-year-filter-prev"
        aria-label="Año académico anterior"
        ?disabled=${!params.canGoToPreviousYear}
      >
        ‹
      </button>
      <p class="${classesFor('paragraph')}" data-element-id="${idPrefix}academic-year-filter-value">${yearLabel}</p>
      <button
        type="button"
        class="${classesFor('icon-button', 'ghost', 'sm')}"
        data-element-id="${idPrefix}academic-year-filter-next"
        aria-label="Año académico siguiente"
        ?disabled=${!params.canGoToNextYear}
      >
        ›
      </button>
    </div>

    <label class="flex items-center gap-2 ${classesFor('paragraph')}">
      Ciclo
      <select class="${classesFor('select')}" data-element-id="${idPrefix}cycle-filter" ?disabled=${cycles.length === 0}>
        ${cycles.map((cycle) => html`<option value="${cycle.id}" ?selected=${cycle.id === selectedCycleId}>${cycle.name}</option>`)}
      </select>
    </label>

    <label class="flex items-center gap-2 ${classesFor('paragraph')}">
      Módulo
      <select class="${classesFor('select')}" data-element-id="${idPrefix}module-filter" ?disabled=${modules.length === 0}>
        ${modules.map((module) => html`<option value="${module.id}" ?selected=${module.id === selectedModuleId}>${module.name}</option>`)}
      </select>
    </label>
  `;
}
