// Frontend-side contract for `schedule-monday-select`..`schedule-friday-select`/
// `schedule-save-button` (Horario screen), consumed by `schedule-settings-view.ts`. This
// file only declares the shape the component depends on (DIP); the real HTTP client lives
// in `http-academic-year-module-schedule-api-service.ts`, assembled at bootstrap in
// `main.ts`.
//
// See `views/configuracion/api-contracts.md`'s "Horario" section — `find` mirrors the
// simple-list style of `calendario-modulo-api-service.ts`, `save` mirrors the
// outcome-union style of `academic-year-api-service.ts`'s write methods (full replace, not
// a partial patch — see `PUT /api/academic-year-modules/:id/schedule`).

export interface ScheduleEntry {
  weekday: number;
  hours: number;
}

export type SaveScheduleResult =
  | { outcome: 'success'; value: ScheduleEntry[] }
  | { outcome: 'not-found' }
  | { outcome: 'validation-error' };

export interface AcademicYearModuleScheduleApiService {
  find(academicYearModuleId: string): Promise<ScheduleEntry[]>;
  save(academicYearModuleId: string, entries: ScheduleEntry[]): Promise<SaveScheduleResult>;
}
