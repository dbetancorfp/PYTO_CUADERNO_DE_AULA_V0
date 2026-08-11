// Concrete `CalendarioHorarioApiService` client, wired into `main.ts` at bootstrap — the
// real HTTP calls against `/api/calendario-horario` (see
// views/calendario/api-contracts.md). `calendario-horario-api-service.ts` only declares the
// interface `CalendarioView` depends on (DIP).
import type { CalendarioHorarioApiService, CalendarioHorarioEntry } from './calendario-horario-api-service';

export class HttpCalendarioHorarioApiService implements CalendarioHorarioApiService {
  /** Returns `[]` on a non-OK response instead of letting an error body with no `.entries`
   * field propagate as a non-array — same defensive convention
   * `http-calendario-modulo-api-service.ts`'s `findForModule` already follows. */
  async findForModule(academicYearModuleId: string): Promise<CalendarioHorarioEntry[]> {
    const response = await fetch(`/api/calendario-horario?academicYearModuleId=${encodeURIComponent(academicYearModuleId)}`);
    if (!response.ok) return [];
    const body = (await response.json()) as { entries: CalendarioHorarioEntry[] };
    return body.entries;
  }
}
