// Domain shape + repository interface for the `calendario_horario` table (see
// views/calendario/schema-changes.sql) — a per-módulo snapshot of the real, laborable
// school-year dates matching a módulo's saved weekly Horario schedule (see
// src/backend/src/services/academic-year-module-schedule.service.ts's `saveSchedule` side
// effect and src/backend/src/services/calendario-horario.service.ts's `seedForModule`, UC-12).
// Read back, ownership-checked, by the Calendario view (UC-13). Two implementations exist
// per DIP: in-memory (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface CalendarioHorarioEntry {
  /** "YYYY-MM-DD" */
  date: string;
  hours: number;
}

export interface CalendarioHorarioRepository {
  /** Sorted by `date`, ascending — see api-contracts.md's "GET /api/calendario-horario". */
  findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioHorarioEntry[]>;
  /** Full replace: deletes every existing row for this módulo, then inserts one row per
   * entry — always called, even with an empty `entries` array (an all-blank schedule must
   * still clear any previously generated rows). */
  replaceAll(academicYearModuleId: string, entries: CalendarioHorarioEntry[]): Promise<void>;
}
