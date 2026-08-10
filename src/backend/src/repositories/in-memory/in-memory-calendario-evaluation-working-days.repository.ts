import type {
  CalendarioEvaluationWorkingDaysEntry,
  CalendarioEvaluationWorkingDaysInsert,
  CalendarioEvaluationWorkingDaysRepository,
} from '../calendario-evaluation-working-days.repository';
import type { CalendarioEvaluationWorkingDaysStore } from './calendario-evaluation-working-days-store';

/** In-memory double for `CalendarioEvaluationWorkingDaysRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). */
export class InMemoryCalendarioEvaluationWorkingDaysRepository implements CalendarioEvaluationWorkingDaysRepository {
  constructor(private readonly store: CalendarioEvaluationWorkingDaysStore) {}

  async findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioEvaluationWorkingDaysEntry[]> {
    return [...this.store.entries.values()].filter((entry) => entry.academicYearModuleId === academicYearModuleId);
  }

  async createMany(entries: CalendarioEvaluationWorkingDaysInsert[]): Promise<void> {
    for (const insert of entries) {
      const alreadyExists = [...this.store.entries.values()].some(
        (entry) =>
          entry.academicYearModuleId === insert.academicYearModuleId &&
          entry.evaluationNumber === insert.evaluationNumber,
      );
      if (alreadyExists) continue;

      const entry: CalendarioEvaluationWorkingDaysEntry = { id: crypto.randomUUID(), ...insert };
      this.store.entries.set(entry.id, entry);
    }
  }
}
