import type { CalendarioHorarioEntry, CalendarioHorarioRepository } from '../calendario-horario.repository';
import type { CalendarioHorarioStore } from './calendario-horario-store';

/** In-memory double for `CalendarioHorarioRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). */
export class InMemoryCalendarioHorarioRepository implements CalendarioHorarioRepository {
  constructor(private readonly store: CalendarioHorarioStore) {}

  async findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioHorarioEntry[]> {
    const entries = this.store.entriesByAcademicYearModuleId.get(academicYearModuleId) ?? [];
    return [...entries].sort((a, b) => a.date.localeCompare(b.date));
  }

  async replaceAll(academicYearModuleId: string, entries: CalendarioHorarioEntry[]): Promise<void> {
    this.store.entriesByAcademicYearModuleId.set(academicYearModuleId, [...entries]);
  }
}
