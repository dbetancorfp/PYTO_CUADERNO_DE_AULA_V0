import type {
  AcademicYearModuleScheduleEntry,
  AcademicYearModuleScheduleRepository,
} from '../academic-year-module-schedule.repository';
import type { AcademicYearModuleScheduleStore } from './academic-year-module-schedule-store';

/** In-memory double for `AcademicYearModuleScheduleRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). */
export class InMemoryAcademicYearModuleScheduleRepository implements AcademicYearModuleScheduleRepository {
  constructor(private readonly store: AcademicYearModuleScheduleStore) {}

  async findByModuleId(academicYearModuleId: string): Promise<AcademicYearModuleScheduleEntry[]> {
    return this.store.entriesByModuleId.get(academicYearModuleId) ?? [];
  }

  async replaceAll(
    academicYearModuleId: string,
    entries: AcademicYearModuleScheduleEntry[],
  ): Promise<AcademicYearModuleScheduleEntry[]> {
    this.store.entriesByModuleId.set(academicYearModuleId, [...entries]);
    return entries;
  }
}
