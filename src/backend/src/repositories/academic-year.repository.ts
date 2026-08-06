// Domain shape + repository interface for the `academic_years` table (see
// views/configuracion/schema-changes.sql). Unlike catalog_cycles/catalog_modules, this table
// is scoped per teacher — every read/write either takes a teacherId or is only ever reached
// through a row already confirmed to belong to one (see AcademicYearService). Two
// implementations exist per DIP: in-memory (repositories/in-memory/) and Postgres
// (repositories/postgres/) — see tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface AcademicYear {
  id: string;
  teacherId: string;
  startYear: number;
  isCurrent: boolean;
}

export interface AcademicYearRepository {
  findAllForTeacher(teacherId: string): Promise<AcademicYear[]>;
  findById(teacherId: string, id: string): Promise<AcademicYear | null>;
  findByStartYear(teacherId: string, startYear: number): Promise<AcademicYear | null>;
  create(teacherId: string, startYear: number): Promise<AcademicYear>;
  rename(id: string, startYear: number): Promise<AcademicYear>;
  /** Un-marks every other row for this teacher and marks this one, atomically from the
   * caller's point of view. */
  markCurrent(teacherId: string, id: string): Promise<AcademicYear>;
  delete(id: string): Promise<void>;
}
