// Frontend-side contract for `training-cycle-table` (Año académico screen), consumed by
// `academic-year-settings-view.ts`. Implements the `/api/training-cycles` endpoints
// described in views/configuracion/api-contracts.md — this file only declares the shape
// the component depends on (DIP); the real HTTP client lives in
// `http-training-cycle-api-service.ts`, assembled at bootstrap in `main.ts`.
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
