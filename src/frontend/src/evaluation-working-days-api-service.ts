// Frontend-side contract for `evaluation-working-days-summary` (Calendario screen),
// consumed by `calendario-view.ts`. This file only declares the shape the component
// depends on (DIP); the real HTTP client lives in
// `http-evaluation-working-days-api-service.ts`, assembled at bootstrap in `main.ts`.
//
// See `views/calendario/api-contracts.md`'s `GET /api/calendario-evaluation-working-days`
// section — same read-only, per-módulo shape as `calendario-modulo-api-service.ts`.

export interface EvaluationWorkingDaysEntry {
  evaluationNumber: number;
  workingDays: number;
}

export interface EvaluationWorkingDaysApiService {
  findForModule(academicYearModuleId: string): Promise<EvaluationWorkingDaysEntry[]>;
}
