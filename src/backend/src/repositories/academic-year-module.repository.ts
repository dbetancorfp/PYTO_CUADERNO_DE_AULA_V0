// Domain shape + repository interface for the `academic_year_modules` join table (see
// views/configuracion/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface AcademicYearModuleRepository {
  findModuleIdsForYear(academicYearId: string): Promise<string[]>;
  /** Deletes every existing selection row for `academicYearId`, then inserts exactly
   * `moduleIds` (see api-contracts.md's PUT /api/academic-years/:id/modules). */
  replaceSelection(academicYearId: string, moduleIds: string[]): Promise<void>;
}
