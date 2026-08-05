// Frontend-side contract for `module-cycle-select`/`module-table`/`module-selection-table`
// (Año académico screen), consumed by `academic-year-settings-view.ts`. This file only
// declares the shape the component depends on (DIP).
//
// **2026-08-04 redesign**: this screen has no backend in this pass — its former endpoints
// (`/api/training-cycles/:cycleId/modules`, `/api/modules`, `/api/modules/:id`) and tables
// were dropped (see views/configuracion/functional-spec.json's "NOT WIRED" elementSpecs).
// The concrete implementation wired at bootstrap in `main.ts` is now
// `local-module-api-service.ts`, an in-memory-only stub — the old
// `http-module-api-service.ts` was removed.
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
