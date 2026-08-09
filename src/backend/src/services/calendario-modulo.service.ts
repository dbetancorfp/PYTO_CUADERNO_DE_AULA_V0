// elementId: calendario-months, calendario-empty-state (business logic side of
// UC-04/UC-06/UC-08, see views/calendario/use-cases.md). Owns both sides of
// `calendario_modulo`: seeding it from `key_dates` when a módulo is assigned to an academic
// year (`seedForModules`, called by `AcademicYearService.createWithSelection`/
// `extendSelection` — see views/calendario/description_calendario.md's "Ciclo de vida de
// calendario_modulo"), computing the `final_exams` rows from the just-resolved `evaluations`
// rows in the same pass (UC-08), and reading everything back, ownership-checked, for the
// Calendario view's `GET /api/calendario-modulo` (`findForTeacher`).
import type {
  CalendarioModuloEntry,
  CalendarioModuloInsert,
  CalendarioModuloRepository,
} from '../repositories/calendario-modulo.repository';
import type { KeyDateRepository } from '../repositories/key-date.repository';
import type { AcademicYearRepository } from '../repositories/academic-year.repository';
import type { AcademicYearModuleDetail, AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import { addLaborableDays, subtractLaborableDays, type DateRange } from './business-day';

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

/** Matches "<prefix> - Último día para poner notas." — capturing `<prefix>` as-is, with no
 * assumption about a fixed evaluación/curso format (see UC-08 step 1). */
const LAST_DAY_FOR_GRADES_PATTERN = /^(.+) - Último día para poner notas\.$/;

/** Categories that count as an actual day off for the business-day walk. `academic_key_dates`
 * is deliberately excluded — its ranges (e.g. "Curso escolar") are informational spans, not
 * real non-working days (see UC-08 step 2 and its A1/last acceptance criterion). */
const NON_WORKING_CATEGORIES = new Set(['holidays', 'public_holidays', 'free_disposal_days']);

/** Computes the `final_exams` pair for every "Último día para poner notas" entry found among
 * this módulo's already-resolved entries (UC-08 steps 1-5). Pure with respect to its input —
 * takes only what's already been resolved for this módulo in the same seeding pass. */
function computeFinalExamsEntries(
  academicYearModuleId: string,
  resolvedEntries: CalendarioModuloInsert[],
): CalendarioModuloInsert[] {
  const nonWorkingRanges: DateRange[] = resolvedEntries
    .filter((entry) => NON_WORKING_CATEGORIES.has(entry.category))
    .map((entry) => ({ startDate: entry.startDate, endDate: entry.endDate }));

  const finalExamsEntries: CalendarioModuloInsert[] = [];
  for (const entry of resolvedEntries) {
    if (entry.category !== 'evaluations') continue;
    const match = LAST_DAY_FOR_GRADES_PATTERN.exec(entry.name);
    if (!match) continue;
    const prefix = match[1];

    const retakeExamDate = addLaborableDays(entry.startDate, 2, nonWorkingRanges);
    const finalExamDate = subtractLaborableDays(retakeExamDate, 4, nonWorkingRanges);

    finalExamsEntries.push({
      academicYearModuleId,
      category: 'final_exams',
      name: `${prefix} - Examen de recuperación final.`,
      startDate: retakeExamDate,
      endDate: retakeExamDate,
    });
    finalExamsEntries.push({
      academicYearModuleId,
      category: 'final_exams',
      name: `${prefix} - Examen final.`,
      startDate: finalExamDate,
      endDate: finalExamDate,
    });
  }
  return finalExamsEntries;
}

export class CalendarioModuloService implements CalendarioModuloSeeder {
  constructor(
    private readonly calendarioModuloRepository: CalendarioModuloRepository,
    private readonly keyDateRepository: KeyDateRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly academicYearRepository: AcademicYearRepository,
  ) {}

  /** Snapshots every `key_dates` category (no filtering — all 6) for every módulo passed in,
   * resolved to real dates for `startYear`, then computes and appends the `final_exams` rows
   * derived from those just-resolved `evaluations` entries (UC-08). Idempotent at the
   * repository layer (`ON CONFLICT DO NOTHING`), so re-seeding an already-snapshotted módulo
   * never duplicates rows — `final_exams` included, same natural key. */
  async seedForModules(modules: AcademicYearModuleDetail[], startYear: number): Promise<void> {
    const keyDates = await this.keyDateRepository.findAll();
    const resolvedKeyDates = keyDates.map((keyDate) => ({
      category: keyDate.category,
      name: keyDate.name,
      startDate: toIsoDate(resolveCalendarYear(keyDate.startMonth, startYear), keyDate.startMonth, keyDate.startDay),
      endDate: toIsoDate(resolveCalendarYear(keyDate.endMonth, startYear), keyDate.endMonth, keyDate.endDay),
    }));

    const entries: CalendarioModuloInsert[] = [];
    for (const module of modules) {
      const moduleEntries: CalendarioModuloInsert[] = resolvedKeyDates.map((resolved) => ({
        academicYearModuleId: module.id,
        ...resolved,
      }));
      entries.push(...moduleEntries, ...computeFinalExamsEntries(module.id, moduleEntries));
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
