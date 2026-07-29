// Frontend-side contract for `module-cycle-select`/`module-table`/`module-selection-table`
// (Año académico screen), consumed by `academic-year-settings-view.ts`. Implements the
// `/api/training-cycles/:cycleId/modules`, `/api/modules` and `/api/modules/:id` endpoints
// described in views/configuracion/api-contracts.md — this file only declares the shape
// the component depends on (DIP); the real HTTP client lives in
// `http-module-api-service.ts`, assembled at bootstrap in `main.ts`.
import type { DeleteWithDependentsResult, UpdateWithDependentsResult, WriteResult } from './api-outcomes';

export interface ModuleRecord {
  id: string;
  trainingCycleId: string;
  course: number;
  name: string;
}

export interface ModuleWithCycleName extends ModuleRecord {
  trainingCycleName: string;
}

export interface ModuleChanges {
  name?: string;
  course?: number;
}

export interface ModuleApiService {
  listForCycle(cycleId: string): Promise<ModuleRecord[]>;
  listAll(): Promise<ModuleWithCycleName[]>;
  create(cycleId: string, name: string, course: number): Promise<WriteResult<ModuleRecord>>;
  update(id: string, changes: ModuleChanges, confirm?: boolean): Promise<UpdateWithDependentsResult<ModuleRecord>>;
  remove(id: string): Promise<DeleteWithDependentsResult>;
}
