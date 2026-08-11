// Shared in-process store backing InMemoryCalendarioHorarioRepository (repositories/in-memory/)
// — mirrors repositories/in-memory/calendario-modulo-store.ts's role, but for the per-módulo
// `calendario_horario` snapshot table (see views/calendario/schema-changes.sql). One instance
// lives for the lifetime of the Express app (see app.ts's composition root). Keyed only by
// academic_year_module_id — no cross-store dependency, same isolation as calendario_modulo's
// store.
import type { CalendarioHorarioEntry } from '../calendario-horario.repository';

export class CalendarioHorarioStore {
  readonly entriesByAcademicYearModuleId = new Map<string, CalendarioHorarioEntry[]>();
}
