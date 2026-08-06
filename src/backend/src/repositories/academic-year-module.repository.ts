// Domain shapes + repository interface for the `academic_year_modules` table (see
// views/configuracion/schema-changes.sql) — the join table between a teacher's
// `academic_years` row and the shared, global `catalog_modules` catalog. `findAllForYear`
// returns the joined shape (`catalog_modules` + `catalog_cycles`) the frontend needs to
// render `training-cycle-table`/`module-table` without a second round trip.

export interface AcademicYearModuleDetail {
  id: string;
  catalogModuleId: string;
  catalogTrainingCycleId: string;
  catalogTrainingCycleName: string;
  course: number;
  name: string;
}

export interface AcademicYearModuleRef {
  id: string;
  academicYearId: string;
  catalogModuleId: string;
}

export interface AcademicYearModuleRepository {
  findAllForYear(academicYearId: string): Promise<AcademicYearModuleDetail[]>;
  findById(id: string): Promise<AcademicYearModuleRef | null>;
  countForYear(academicYearId: string): Promise<number>;
  /** Inserts one row per `catalogModuleId`, ignoring ones already assigned (no error, no
   * duplicate row). Returns how many were actually inserted. */
  createMany(academicYearId: string, catalogModuleIds: string[]): Promise<number>;
  delete(id: string): Promise<void>;
}
