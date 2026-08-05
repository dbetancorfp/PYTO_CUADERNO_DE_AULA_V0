// In-memory-only backing store shared by Año académico's three local service stubs
// (`local-training-cycle-api-service.ts`, `local-module-api-service.ts`,
// `local-academic-year-api-service.ts`). 2026-08-04 redesign: this screen's real tables
// (training_cycles, modules, academic_years, academic_year_modules) were dropped and are
// not recreated in this pass — see views/configuracion/functional-spec.json's "NOT WIRED"
// elementSpecs and use-cases.md UC-06..UC-09. A fresh instance is created per bootstrap
// (see `main.ts`), scoped to the page's lifetime only: never persisted, no `fetch` call
// anywhere in this file or its three consumers. A future view rebuilds this screen's real
// data layer.
import type { TrainingCycle } from './training-cycle-api-service';
import type { ModuleRecord } from './module-api-service';
import type { AcademicYear } from './academic-year-api-service';

export class LocalAcademicYearStore {
  trainingCycles: TrainingCycle[] = [];
  modules: ModuleRecord[] = [];
  academicYears: AcademicYear[] = [];

  private readonly _selections = new Map<string, Set<string>>();
  private _nextId = 1;

  newId(prefix: string): string {
    return `${prefix}-${this._nextId++}`;
  }

  selectionFor(academicYearId: string): Set<string> {
    return this._selections.get(academicYearId) ?? new Set<string>();
  }

  setSelection(academicYearId: string, moduleIds: readonly string[]): void {
    this._selections.set(academicYearId, new Set(moduleIds));
  }

  dropSelection(academicYearId: string): void {
    this._selections.delete(academicYearId);
  }

  /** Academic years whose in-progress/committed selection currently includes `moduleId`. */
  academicYearsSelecting(moduleId: string): AcademicYear[] {
    return this.academicYears.filter((year) => this.selectionFor(year.id).has(moduleId));
  }

  /** Academic years whose selection currently includes any module of `trainingCycleId`. */
  academicYearsSelectingCycle(trainingCycleId: string): AcademicYear[] {
    const cycleModuleIds = new Set(
      this.modules.filter((module) => module.trainingCycleId === trainingCycleId).map((module) => module.id),
    );
    return this.academicYears.filter((year) => {
      for (const moduleId of this.selectionFor(year.id)) {
        if (cycleModuleIds.has(moduleId)) return true;
      }
      return false;
    });
  }
}
