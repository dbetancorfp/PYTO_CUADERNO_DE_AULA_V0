// Frontend-side contract for `academic-year-table`/`module-selection-table` (Año académico
// screen), consumed by `academic-year-settings-view.ts`. Implements the
// `/api/academic-years` and `/api/academic-years/:id/modules` endpoints described in
// views/configuracion/api-contracts.md — this file only declares the shape the component
// depends on (DIP); the real HTTP client lives in `http-academic-year-api-service.ts`,
// assembled at bootstrap in `main.ts`.
import type { DeleteCurrentBlockedResult, WriteResult } from './api-outcomes';
import type { TrainingCycle } from './training-cycle-api-service';
import type { ModuleRecord } from './module-api-service';

export interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

export type ReplaceSelectionResult = { outcome: 'success' } | { outcome: 'not-found' };

export interface AcademicYearApiService {
  list(): Promise<AcademicYear[]>;
  create(name: string): Promise<WriteResult<AcademicYear>>;
  rename(id: string, name: string): Promise<WriteResult<AcademicYear>>;
  setCurrent(id: string): Promise<WriteResult<AcademicYear>>;
  remove(id: string): Promise<DeleteCurrentBlockedResult>;
  getSelection(id: string): Promise<string[]>;
  replaceSelection(id: string, moduleIds: string[]): Promise<ReplaceSelectionResult>;
  /**
   * Normal-mode `training-cycle-table`: only the cycles with >=1 module currently selected
   * for this academic year (see views/configuracion/api-contracts.md's
   * `GET /api/academic-years/:id/training-cycles`).
   */
  listTrainingCyclesForYear(id: string): Promise<TrainingCycle[]>;
  /**
   * Normal-mode `module-table`: the modules of one training cycle that are also selected
   * for this academic year (see views/configuracion/api-contracts.md's
   * `GET /api/academic-years/:id/training-cycles/:cycleId/modules`).
   */
  listModulesForYearAndCycle(id: string, cycleId: string): Promise<ModuleRecord[]>;
}
