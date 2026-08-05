// Frontend-side contract for `catalog-training-cycle-table` (Ciclos/Módulos screen),
// consumed by `training-catalog-settings-view.ts`. Implements the
// `/api/catalog/training-cycles` endpoints described in
// views/configuracion/api-contracts.md — this file only declares the shape the component
// depends on (DIP); the real HTTP client lives in
// `http-catalog-training-cycle-api-service.ts`, assembled at bootstrap in `main.ts`.
//
// Brand-new, standalone catalog (2026-08-04 redesign) — unrelated to
// `training-cycle-api-service.ts`, which still backs the frozen, not-wired Año académico
// screen. Nothing references this catalog, so deletion is never dependency-blocked:
// `DeleteResult` (api-outcomes.ts) has no `has-dependents` outcome.
import type { DeleteResult, WriteResult } from './api-outcomes';

export interface CatalogTrainingCycle {
  id: string;
  name: string;
}

export interface CatalogTrainingCycleApiService {
  list(): Promise<CatalogTrainingCycle[]>;
  create(name: string): Promise<WriteResult<CatalogTrainingCycle>>;
  rename(id: string, name: string): Promise<WriteResult<CatalogTrainingCycle>>;
  remove(id: string): Promise<DeleteResult>;
}
