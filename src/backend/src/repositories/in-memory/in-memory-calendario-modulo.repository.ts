import type {
  CalendarioModuloEntry,
  CalendarioModuloInsert,
  CalendarioModuloRepository,
} from '../calendario-modulo.repository';
import type { CalendarioModuloStore } from './calendario-modulo-store';

/** In-memory double for `CalendarioModuloRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). */
export class InMemoryCalendarioModuloRepository implements CalendarioModuloRepository {
  constructor(private readonly store: CalendarioModuloStore) {}

  async findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]> {
    return [...this.store.entries.values()].filter((entry) => entry.academicYearModuleId === academicYearModuleId);
  }

  async createMany(entries: CalendarioModuloInsert[]): Promise<void> {
    for (const insert of entries) {
      const alreadyExists = [...this.store.entries.values()].some(
        (entry) =>
          entry.academicYearModuleId === insert.academicYearModuleId &&
          entry.category === insert.category &&
          entry.name === insert.name &&
          entry.startDate === insert.startDate,
      );
      if (alreadyExists) continue;

      const entry: CalendarioModuloEntry = { id: crypto.randomUUID(), ...insert };
      this.store.entries.set(entry.id, entry);
    }
  }

  async replaceFinalExamsForModule(academicYearModuleId: string, entries: CalendarioModuloInsert[]): Promise<void> {
    for (const [id, entry] of this.store.entries) {
      if (entry.academicYearModuleId === academicYearModuleId && entry.category === 'final_exams') {
        this.store.entries.delete(id);
      }
    }
    for (const insert of entries) {
      const entry: CalendarioModuloEntry = { id: crypto.randomUUID(), ...insert };
      this.store.entries.set(entry.id, entry);
    }
  }
}
