// Concrete `AcademicYearModuleScheduleApiService` client, wired into `main.ts` at
// bootstrap — the real HTTP calls against `/api/academic-year-modules/:id/schedule` (see
// views/configuracion/api-contracts.md's "Horario" section). `academic-year-module-
// schedule-api-service.ts` only declares the interface `ScheduleSettingsView` depends on
// (DIP).
import type {
  AcademicYearModuleScheduleApiService,
  SaveScheduleResult,
  ScheduleEntry,
} from './academic-year-module-schedule-api-service';

export class HttpAcademicYearModuleScheduleApiService implements AcademicYearModuleScheduleApiService {
  /** Returns `[]` on a non-OK response (e.g. a 404 for an `academic_year_modules` id no
   * longer owned by this teacher) instead of letting an error body with no `.schedule`
   * field propagate as a non-array — same defensive convention
   * `http-calendario-modulo-api-service.ts`'s `findForModule` already follows. */
  async find(academicYearModuleId: string): Promise<ScheduleEntry[]> {
    const response = await fetch(`/api/academic-year-modules/${academicYearModuleId}/schedule`);
    if (!response.ok) return [];
    const body = (await response.json()) as { schedule: ScheduleEntry[] };
    return body.schedule;
  }

  async save(academicYearModuleId: string, entries: ScheduleEntry[]): Promise<SaveScheduleResult> {
    const response = await fetch(`/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: entries }),
    });

    if (response.status === 404) {
      return { outcome: 'not-found' };
    }
    if (!response.ok) {
      return { outcome: 'validation-error' };
    }
    const body = (await response.json()) as { schedule: ScheduleEntry[] };
    return { outcome: 'success', value: body.schedule };
  }
}
