// Domain shape + repository interface for the `calendario_evaluation_working_days` table
// (see views/calendario/schema-changes.sql) — a per-módulo, per-evaluación count of working
// days between the módulo's course start and that evaluación's "Examen final" date.
// Populated as a side effect of `CalendarioModuloService.seedForModules` (UC-09) and read
// back, ownership-checked, by the Calendario view's `GET
// /api/calendario-evaluation-working-days` (UC-10). Two implementations exist per DIP:
// in-memory (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface CalendarioEvaluationWorkingDaysEntry {
  id: string;
  academicYearModuleId: string;
  evaluationNumber: number;
  workingDays: number;
}

export interface CalendarioEvaluationWorkingDaysInsert {
  academicYearModuleId: string;
  evaluationNumber: number;
  workingDays: number;
}

export interface CalendarioEvaluationWorkingDaysRepository {
  findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioEvaluationWorkingDaysEntry[]>;
  /** Inserts every entry, ignoring ones that already exist (natural key:
   * `academicYearModuleId` + `evaluationNumber`) — idempotent, no error, no duplicate row. */
  createMany(entries: CalendarioEvaluationWorkingDaysInsert[]): Promise<void>;
}
