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
  /** Copied from `key_dates.type` at seed time (UC-11) — `null` for `final_exams` rows
   * (computed, not copied) or a custom `key_dates` row saved with no `tipo`. */
  type: string | null;
}

export interface CalendarioModuloInsert {
  academicYearModuleId: string;
  category: string;
  name: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD" */
  endDate: string;
  /** Copied from `key_dates.type` at seed time (UC-11) — `null` for `final_exams` rows
   * (computed, not copied) or a custom `key_dates` row saved with no `tipo`. */
  type: string | null;
}

export interface CalendarioModuloRepository {
  findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]>;
  /** Inserts every entry, ignoring ones that already exist (natural key: `academicYearModuleId`
   * + `category` + `name` + `startDate`) — idempotent, no error, no duplicate row. */
  createMany(entries: CalendarioModuloInsert[]): Promise<void>;
  /** Full replace (2026-08-12, UC-08's horario-aware revision): deletes every existing
   * `category = 'final_exams'` row for `academicYearModuleId`, then inserts `entries` —
   * unlike `createMany`'s insert-if-absent semantics, a recomputed exam date can
   * legitimately differ from what was stored before (the teacher changed their weekly
   * schedule), so this never silently keeps a stale date. */
  replaceFinalExamsForModule(academicYearModuleId: string, entries: CalendarioModuloInsert[]): Promise<void>;
}
