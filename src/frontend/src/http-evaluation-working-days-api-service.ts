// Concrete `EvaluationWorkingDaysApiService` client, wired into `main.ts` at bootstrap —
// the real HTTP calls against `/api/calendario-evaluation-working-days` (see
// views/calendario/api-contracts.md). `evaluation-working-days-api-service.ts` only
// declares the interface `CalendarioView` depends on (DIP).
import type { EvaluationWorkingDaysApiService, EvaluationWorkingDaysEntry } from './evaluation-working-days-api-service';

export class HttpEvaluationWorkingDaysApiService implements EvaluationWorkingDaysApiService {
  /** Returns `[]` on a non-OK response — same defensive convention
   * `http-calendario-modulo-api-service.ts`'s `findForModule` already follows. */
  async findForModule(academicYearModuleId: string): Promise<EvaluationWorkingDaysEntry[]> {
    const response = await fetch(`/api/calendario-evaluation-working-days?academicYearModuleId=${encodeURIComponent(academicYearModuleId)}`);
    if (!response.ok) return [];
    const body = (await response.json()) as { entries: EvaluationWorkingDaysEntry[] };
    return body.entries;
  }
}
