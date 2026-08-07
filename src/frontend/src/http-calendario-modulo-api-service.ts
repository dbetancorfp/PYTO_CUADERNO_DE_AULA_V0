// Concrete `CalendarioModuloApiService` client, wired into `main.ts` at bootstrap — the
// real HTTP calls against `/api/calendario-modulo` (see
// views/calendario/api-contracts.md). `calendario-modulo-api-service.ts` only declares the
// interface `CalendarioView` depends on (DIP).
import type { CalendarioModuloApiService, CalendarioModuloEntry } from './calendario-modulo-api-service';

export class HttpCalendarioModuloApiService implements CalendarioModuloApiService {
  /** Returns `[]` on a non-OK response (e.g. a 404 for a module id no longer owned by this
   * teacher) instead of letting an error body with no `.entries` field propagate as a
   * non-array — same defensive convention `http-key-date-api-service.ts`'s `list` already
   * follows. */
  async findForModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]> {
    const response = await fetch(`/api/calendario-modulo?academicYearModuleId=${encodeURIComponent(academicYearModuleId)}`);
    if (!response.ok) return [];
    const body = (await response.json()) as { entries: CalendarioModuloEntry[] };
    return body.entries;
  }
}
