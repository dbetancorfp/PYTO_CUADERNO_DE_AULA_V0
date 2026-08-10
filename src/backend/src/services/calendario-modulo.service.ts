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
import type {
  CalendarioEvaluationWorkingDaysEntry,
  CalendarioEvaluationWorkingDaysInsert,
  CalendarioEvaluationWorkingDaysRepository,
} from '../repositories/calendario-evaluation-working-days.repository';
import type { KeyDateRepository } from '../repositories/key-date.repository';
import type { AcademicYearRepository } from '../repositories/academic-year.repository';
import type { AcademicYearModuleDetail, AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import { countLaborableDays, subtractLaborableDays, type DateRange } from './business-day';

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

/** Resolves the course a `key_dates.name` is exclusive to, per the UC-06/A1 token table —
 * `null` means course-agnostic (applies to both). The masculine ordinal `º` (course token)
 * never collides with the feminine `ª` (evaluación-number token, `1ª`/`2ª`/`3ª`), so no
 * explicit exclusion is needed for names like "1ª Evaluación - ...". */
function courseTokenFor(name: string): 1 | 2 | null {
  if (name.includes('1º de Grado') || name.startsWith('1º ') || name.startsWith('1º-') || name.includes('(1º)')) return 1;
  if (name.includes('2º de Grado') || name.startsWith('2º ') || name.startsWith('2º-') || name.includes('(2º)')) return 2;
  return null;
}

/** Categories that count as an actual day off for the business-day walk. `academic_key_dates`
 * is deliberately excluded — its ranges (e.g. "Curso escolar") are informational spans, not
 * real non-working days (see UC-08 step 2 and its A1/last acceptance criterion). */
const NON_WORKING_CATEGORIES = new Set(['holidays', 'public_holidays', 'free_disposal_days']);

/** Shared by `computeFinalExamsEntries` and `computeEvaluationWorkingDaysEntries` — both walk
 * business days over the same módulo, so both exclude the same real non-working ranges. */
function nonWorkingRangesFor(resolvedEntries: CalendarioModuloInsert[]): DateRange[] {
  return resolvedEntries
    .filter((entry) => NON_WORKING_CATEGORIES.has(entry.category))
    .map((entry) => ({ startDate: entry.startDate, endDate: entry.endDate }));
}

/** Computes the `final_exams` pair for every "Último día para poner notas" entry found among
 * this módulo's already-resolved entries (UC-08 steps 1-5). Pure with respect to its input —
 * takes only what's already been resolved for this módulo in the same seeding pass. */
function computeFinalExamsEntries(
  academicYearModuleId: string,
  resolvedEntries: CalendarioModuloInsert[],
): CalendarioModuloInsert[] {
  const nonWorkingRanges = nonWorkingRangesFor(resolvedEntries);

  const finalExamsEntries: CalendarioModuloInsert[] = [];
  for (const entry of resolvedEntries) {
    if (entry.category !== 'evaluations') continue;
    const match = LAST_DAY_FOR_GRADES_PATTERN.exec(entry.name);
    if (!match) continue;
    const prefix = match[1];

    const retakeExamDate = subtractLaborableDays(entry.startDate, 2, nonWorkingRanges);
    const finalExamDate = subtractLaborableDays(retakeExamDate, 4, nonWorkingRanges);

    finalExamsEntries.push(
      {
        academicYearModuleId,
        category: 'final_exams',
        name: `${prefix} - Examen de recuperación final.`,
        startDate: retakeExamDate,
        endDate: retakeExamDate,
        type: null,
      },
      {
        academicYearModuleId,
        category: 'final_exams',
        name: `${prefix} - Examen final.`,
        startDate: finalExamDate,
        endDate: finalExamDate,
        type: null,
      },
    );
  }
  return finalExamsEntries;
}

/** `evaluationNumber` -> the "Examen final" `final_exams` name it anchors to, and whether it
 * applies to a given módulo's `course` at all — 3ª evaluación has no "(2º)" variant, so a
 * curso-2 módulo simply never gets an `evaluationNumber: 3` row (UC-09 step 2). */
function finalExamNameFor(evaluationNumber: 1 | 2 | 3, course: 1 | 2): string | null {
  if (evaluationNumber === 1) return '1ª Evaluación - Examen final.';
  if (evaluationNumber === 2) return course === 1 ? '2ª Evaluación (1º) - Examen final.' : '2ª Evaluación (2º) - Examen final.';
  return course === 1 ? '3ª Evaluación (1º) - Examen final.' : null;
}

/** Computes the `calendario_evaluation_working_days` rows for one módulo (UC-09): the count
 * of working days between the módulo's own course-start `academic_key_dates` entry and each
 * evaluación's already-computed `final_exams` "Examen final" date. Pure with respect to its
 * input, same shape as `computeFinalExamsEntries`. */
function computeEvaluationWorkingDaysEntries(
  module: AcademicYearModuleDetail,
  moduleEntries: CalendarioModuloInsert[],
  finalExamsEntries: CalendarioModuloInsert[],
): CalendarioEvaluationWorkingDaysInsert[] {
  const courseStartName = module.course === 1 ? 'Inicio curso: 1º de Grado Superior de FP.' : 'Inicio curso: 2º de Grado Superior de FP.';
  const courseStartEntry = moduleEntries.find(
    (entry) => entry.category === 'academic_key_dates' && entry.name === courseStartName,
  );
  if (!courseStartEntry) return [];

  const nonWorkingRanges = nonWorkingRangesFor(moduleEntries);

  const workingDaysEntries: CalendarioEvaluationWorkingDaysInsert[] = [];
  for (const evaluationNumber of [1, 2, 3] as const) {
    const examName = finalExamNameFor(evaluationNumber, module.course as 1 | 2);
    if (!examName) continue;

    const finalExamEntry = finalExamsEntries.find((entry) => entry.category === 'final_exams' && entry.name === examName);
    if (!finalExamEntry) continue;

    workingDaysEntries.push({
      academicYearModuleId: module.id,
      evaluationNumber,
      workingDays: countLaborableDays(courseStartEntry.startDate, finalExamEntry.startDate, nonWorkingRanges),
    });
  }
  return workingDaysEntries;
}

export class CalendarioModuloService implements CalendarioModuloSeeder {
  constructor(
    private readonly calendarioModuloRepository: CalendarioModuloRepository,
    private readonly calendarioEvaluationWorkingDaysRepository: CalendarioEvaluationWorkingDaysRepository,
    private readonly keyDateRepository: KeyDateRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly academicYearRepository: AcademicYearRepository,
  ) {}

  /** Snapshots every `key_dates` category (all 6) for every módulo passed in, resolved to
   * real dates for `startYear` and filtered to the entries applicable to that módulo's own
   * `course` (see `courseTokenFor` and UC-06/A1), then computes and appends the
   * `final_exams` rows derived from those just-resolved, already course-filtered
   * `evaluations` entries (UC-08), and finally computes and inserts the
   * `calendario_evaluation_working_days` rows derived from those `final_exams` dates
   * (UC-09). Idempotent at the repository layer (`ON CONFLICT DO NOTHING`), so re-seeding
   * an already-snapshotted módulo never duplicates rows in either table. */
  async seedForModules(modules: AcademicYearModuleDetail[], startYear: number): Promise<void> {
    const keyDates = await this.keyDateRepository.findAll();
    const resolvedKeyDates = keyDates.map((keyDate) => ({
      category: keyDate.category,
      name: keyDate.name,
      startDate: toIsoDate(resolveCalendarYear(keyDate.startMonth, startYear), keyDate.startMonth, keyDate.startDay),
      endDate: toIsoDate(resolveCalendarYear(keyDate.endMonth, startYear), keyDate.endMonth, keyDate.endDay),
      type: keyDate.type,
    }));

    const entries: CalendarioModuloInsert[] = [];
    const workingDaysEntries: CalendarioEvaluationWorkingDaysInsert[] = [];
    for (const module of modules) {
      const moduleEntries: CalendarioModuloInsert[] = resolvedKeyDates
        .filter((resolved) => {
          const courseToken = courseTokenFor(resolved.name);
          return courseToken === null || courseToken === module.course;
        })
        .map((resolved) => ({
          academicYearModuleId: module.id,
          ...resolved,
        }));
      const finalExamsEntries = computeFinalExamsEntries(module.id, moduleEntries);
      entries.push(...moduleEntries, ...finalExamsEntries);
      workingDaysEntries.push(...computeEvaluationWorkingDaysEntries(module, moduleEntries, finalExamsEntries));
    }

    await this.calendarioModuloRepository.createMany(entries);
    await this.calendarioEvaluationWorkingDaysRepository.createMany(workingDaysEntries);
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

  /** Same ownership-check pattern as `findForTeacher`, reading `calendario_evaluation_working_
   * days` instead (UC-10). */
  async findEvaluationWorkingDaysForTeacher(
    teacherId: string,
    academicYearModuleId: string,
  ): Promise<CalendarioEvaluationWorkingDaysEntry[] | null> {
    const ref = await this.academicYearModuleRepository.findById(academicYearModuleId);
    if (!ref) return null;

    const year = await this.academicYearRepository.findById(teacherId, ref.academicYearId);
    if (!year) return null;

    return this.calendarioEvaluationWorkingDaysRepository.findAllForAcademicYearModule(academicYearModuleId);
  }
}
