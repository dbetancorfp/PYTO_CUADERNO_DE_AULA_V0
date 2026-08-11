// Shared in-process store backing InMemoryAcademicYearModuleScheduleRepository — the weekly
// Mon-Fri schedule for each academic_year_module (see
// views/configuracion/schema-changes.sql). Its own isolated store, no cross-store dependency
// needed, same isolation as calendario-modulo-store.ts.
import type { AcademicYearModuleScheduleEntry } from '../academic-year-module-schedule.repository';

export class AcademicYearModuleScheduleStore {
  readonly entriesByModuleId = new Map<string, AcademicYearModuleScheduleEntry[]>();
}
