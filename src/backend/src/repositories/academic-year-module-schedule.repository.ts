// Domain shape + repository interface for the `academic_year_module_schedules` table (see
// views/configuracion/schema-changes.sql) — one weekly Mon-Fri hours entry per
// `academic_year_module`. Absence of a row for a given weekday means "no class that day"; 0
// is never stored (see use-cases.md UC-10/UC-11). Two implementations exist per DIP:
// in-memory (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface AcademicYearModuleScheduleEntry {
  /** 1 = Monday ... 5 = Friday, Spanish school-week convention. */
  weekday: number;
  /** 1-3. */
  hours: number;
}

export interface AcademicYearModuleScheduleRepository {
  findByModuleId(academicYearModuleId: string): Promise<AcademicYearModuleScheduleEntry[]>;
  /** Full replace: deletes every existing row for this `academicYearModuleId`, then inserts
   * one row per entry — never a partial patch (see api-contracts.md's PUT
   * /api/academic-year-modules/:id/schedule). Callers are expected to have already validated
   * `entries` (1-5/1-3 range, no duplicate weekday) at the route layer. */
  replaceAll(
    academicYearModuleId: string,
    entries: AcademicYearModuleScheduleEntry[],
  ): Promise<AcademicYearModuleScheduleEntry[]>;
}
