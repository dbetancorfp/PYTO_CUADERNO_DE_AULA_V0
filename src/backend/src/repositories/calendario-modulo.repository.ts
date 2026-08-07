// Domain shape + repository interface for the `calendario_modulo` table (see
// views/calendario/schema-changes.sql) — a per-módulo snapshot of `key_dates` resolved to
// real dates for one academic year's `startYear`. Populated as a side effect of
// AcademicYearService.createWithSelection/extendSelection (see
// src/backend/src/services/calendario-modulo.service.ts) and read back, ownership-checked,
// by the Calendario view. Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface CalendarioModuloEntry {
  id: string;
  academicYearModuleId: string;
  category: string;
  name: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD" */
  endDate: string;
}

export interface CalendarioModuloInsert {
  academicYearModuleId: string;
  category: string;
  name: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD" */
  endDate: string;
}

export interface CalendarioModuloRepository {
  findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]>;
  /** Inserts every entry, ignoring ones that already exist (natural key: `academicYearModuleId`
   * + `category` + `name` + `startDate`) — idempotent, no error, no duplicate row. */
  createMany(entries: CalendarioModuloInsert[]): Promise<void>;
}
