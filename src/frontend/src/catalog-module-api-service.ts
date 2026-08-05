// Frontend-side contract for `catalog-module-table` (Ciclos/Módulos screen), consumed by
// `training-catalog-settings-view.ts`. Implements the
// `/api/catalog/training-cycles/:cycleId/modules` and `/api/catalog/modules/:id` endpoints
// described in views/configuracion/api-contracts.md — this file only declares the shape
// the component depends on (DIP); the real HTTP client lives in
// `http-catalog-module-api-service.ts`, assembled at bootstrap in `main.ts`.
//
// Brand-new, standalone catalog (2026-08-04 redesign) — unrelated to `module-api-service.ts`,
// which still backs the frozen, not-wired Año académico screen. `course` is `1 | 2` only
// (the seeded BOC curricula only go up to 2º) and nothing references a catalog module, so
// editing/deleting are always unconditional — no confirm step, no `has-dependents` outcome.
import type { DeleteResult, WriteResult } from './api-outcomes';

export interface CatalogModuleRecord {
  id: string;
  catalogTrainingCycleId: string;
  course: number;
  name: string;
}

export interface CatalogModuleChanges {
  name?: string;
  course?: number;
}

export interface CatalogModuleApiService {
  listForCycle(cycleId: string): Promise<CatalogModuleRecord[]>;
  create(cycleId: string, name: string, course: number): Promise<WriteResult<CatalogModuleRecord>>;
  update(id: string, changes: CatalogModuleChanges): Promise<WriteResult<CatalogModuleRecord>>;
  remove(id: string): Promise<DeleteResult>;
}
