// Frontend-side contract for `training-cycle-table` (Año académico screen), consumed by
// `academic-year-settings-view.ts`. This file only declares the shape the component
// depends on (DIP).
//
// **2026-08-04 redesign**: this screen has no backend in this pass — its former
// `/api/training-cycles` endpoints and tables were dropped (see
// views/configuracion/functional-spec.json's "NOT WIRED" elementSpecs). The concrete
// implementation wired at bootstrap in `main.ts` is now
// `local-training-cycle-api-service.ts`, an in-memory-only stub — the old
// `http-training-cycle-api-service.ts` was removed. Unrelated to the brand-new
// `catalog-training-cycle-api-service.ts` that backs Ciclos/Módulos.
import type { DeleteWithDependentsResult, WriteResult } from './api-outcomes';

export interface TrainingCycle {
  id: string;
  name: string;
}

export interface TrainingCycleApiService {
  list(): Promise<TrainingCycle[]>;
  create(name: string): Promise<WriteResult<TrainingCycle>>;
  rename(id: string, name: string): Promise<WriteResult<TrainingCycle>>;
  remove(id: string): Promise<DeleteWithDependentsResult>;
}
