// elementId: calendario-months, calendario-empty-state (business logic side of UC-04/UC-06,
// see views/calendario/use-cases.md). Owns both sides of `calendario_modulo`: seeding it from
// `key_dates` when a módulo is assigned to an academic year (`seedForModules`, called by
// `AcademicYearService.createWithSelection`/`extendSelection` — see
// views/calendario/description_calendario.md's "Ciclo de vida de calendario_modulo") and
// reading it back, ownership-checked, for the Calendario view's `GET /api/calendario-modulo`
// (`findForTeacher`).
import type {
  CalendarioModuloEntry,
  CalendarioModuloInsert,
  CalendarioModuloRepository,
} from '../repositories/calendario-modulo.repository';
import type { KeyDateRepository } from '../repositories/key-date.repository';
import type { AcademicYearRepository } from '../repositories/academic-year.repository';
import type { AcademicYearModuleDetail, AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';

/** Narrow seam `AcademicYearService` depends on (ISP) — it only ever needs to trigger
 * seeding, never to read `calendario_modulo` back. */
export interface CalendarioModuloSeeder {
  seedForModules(modules: AcademicYearModuleDetail[], startYear: number): Promise<void>;
}

/** month >= 9 (Sept-Dec) falls in `startYear`; month <= 8 (Jan-Aug) falls in `startYear + 1` —
 * see views/calendario/description_calendario.md's "Resolución de fecha real". */
function resolveCalendarYear(month: number, startYear: number): number {
  return month >= 9 ? startYear : startYear + 1;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export class CalendarioModuloService implements CalendarioModuloSeeder {
  constructor(
    private readonly calendarioModuloRepository: CalendarioModuloRepository,
    private readonly keyDateRepository: KeyDateRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly academicYearRepository: AcademicYearRepository,
  ) {}

  /** Snapshots every `key_dates` category (no filtering — all 6) for every módulo passed in,
   * resolved to real dates for `startYear`. Idempotent at the repository layer (`ON CONFLICT
   * DO NOTHING`), so re-seeding an already-snapshotted módulo never duplicates rows. */
  async seedForModules(modules: AcademicYearModuleDetail[], startYear: number): Promise<void> {
    const keyDates = await this.keyDateRepository.findAll();

    const entries: CalendarioModuloInsert[] = [];
    for (const module of modules) {
      for (const keyDate of keyDates) {
        entries.push({
          academicYearModuleId: module.id,
          category: keyDate.category,
          name: keyDate.name,
          startDate: toIsoDate(resolveCalendarYear(keyDate.startMonth, startYear), keyDate.startMonth, keyDate.startDay),
          endDate: toIsoDate(resolveCalendarYear(keyDate.endMonth, startYear), keyDate.endMonth, keyDate.endDay),
        });
      }
    }

    await this.calendarioModuloRepository.createMany(entries);
  }

  /** Returns `null` when `academicYearModuleId` doesn't exist, or its academic year isn't
   * owned by this teacher — same ownership-check pattern as
   * `AcademicYearService.removeModule`. An empty array is a valid, non-null result (owned,
   * but the snapshot hasn't been generated, or has zero rows). */
  async findForTeacher(teacherId: string, academicYearModuleId: string): Promise<CalendarioModuloEntry[] | null> {
    const ref = await this.academicYearModuleRepository.findById(academicYearModuleId);
    if (!ref) return null;

    const year = await this.academicYearRepository.findById(teacherId, ref.academicYearId);
    if (!year) return null;

    return this.calendarioModuloRepository.findAllForAcademicYearModule(academicYearModuleId);
  }
}
