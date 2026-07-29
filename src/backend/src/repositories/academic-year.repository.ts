// Domain shape + repository interface for the `academic_years` table (see
// views/configuracion/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface AcademicYear {
  id: string;
  teacherId: string;
  name: string;
  isCurrent: boolean;
}

export interface AcademicYearRepository {
  findAllForTeacher(teacherId: string): Promise<AcademicYear[]>;
  findById(teacherId: string, id: string): Promise<AcademicYear | null>;
  findByName(teacherId: string, name: string): Promise<AcademicYear | null>;
  /** Always inserts with `is_current = false` — the teacher marks a year current via
   * `setCurrent` (see api-contracts.md's POST /api/academic-years). */
  create(teacherId: string, name: string): Promise<AcademicYear>;
  rename(id: string, name: string): Promise<AcademicYear>;
  /** Atomically un-marks whichever row was previously current for this teacher and marks
   * `id` current (see schema-changes.sql's `academic_years_one_current_per_teacher` partial
   * unique index). */
  setCurrent(teacherId: string, id: string): Promise<AcademicYear>;
  delete(id: string): Promise<void>;
}
