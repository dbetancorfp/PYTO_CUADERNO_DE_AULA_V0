// Frontend-side contract for `academic-year-table`/`training-cycle-table`/`module-table`/
// `module-selection-table` (Año académico screen), consumed by
// `academic-year-settings-view.ts`. This file only declares the shape the component
// depends on (DIP); the real HTTP client lives in `http-academic-year-api-service.ts`,
// assembled at bootstrap in `main.ts`.
//
// Real backend as of the 2026-08-05 redesign — see
// views/configuracion/api-contracts.md's "Academic years"/"Academic year módulo selection"
// sections. `academic_years`/`academic_year_modules` rows are scoped per teacher. The
// cycle/módulo picker in adding mode reuses `CatalogTrainingCycleApiService`/
// `CatalogModuleApiService` (catalog-training-cycle-api-service.ts, catalog-module-api-
// service.ts) as-is — no duplicate catalog-browsing service here.
import type {
  CreateSelectionResult,
  DeleteHasDependentsResult,
  DeleteResult,
  ExtendSelectionResult,
  WriteResult,
} from './api-outcomes';

export interface AcademicYear {
  id: string;
  startYear: number;
  isCurrent: boolean;
}

/**
 * One of the signed-in teacher's módulos assigned to an academic year — joined with its
 * catalog cycle/módulo info so the frontend can derive `training-cycle-table`'s normal-mode
 * list and group `module-table` by curso without a second round trip (see
 * `GET /api/academic-years/:id/modules`).
 */
export interface AcademicYearModuleDetail {
  id: string;
  catalogModuleId: string;
  catalogTrainingCycleId: string;
  catalogTrainingCycleName: string;
  course: number;
  name: string;
}

export interface AcademicYearApiService {
  list(): Promise<AcademicYear[]>;
  update(id: string, changes: { startYear?: number; isCurrent?: boolean }): Promise<WriteResult<AcademicYear>>;
  remove(id: string): Promise<DeleteHasDependentsResult>;
  listModules(id: string): Promise<AcademicYearModuleDetail[]>;
  createWithSelection(startYear: number, moduleIds: string[]): Promise<CreateSelectionResult>;
  extendSelection(id: string, moduleIds: string[]): Promise<ExtendSelectionResult>;
  removeModule(academicYearModuleId: string): Promise<DeleteResult>;
}
