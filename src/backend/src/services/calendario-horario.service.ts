// elementId: calendario-months, calendario-legend, calendario-day-tooltip (business-logic
// side of UC-12/UC-13, see views/calendario/use-cases.md). Owns both sides of
// `calendario_horario`: regenerating it from a just-saved weekly schedule (`seedForModule`,
// called by `AcademicYearModuleScheduleService.saveSchedule`) and reading it back,
// ownership-checked, for the Calendario view's `GET /api/calendario-horario`
// (`findForTeacher`). Non-working ranges are derived from this same módulo's own
// already-seeded `calendario_modulo` rows (holidays/public_holidays/free_disposal_days
// only — `academic_key_dates` is informational, same exclusion
// `calendario-modulo.service.ts`'s `NON_WORKING_CATEGORIES` already applies for UC-08/UC-09),
// not from `key_dates` directly.
import type { CalendarioHorarioEntry, CalendarioHorarioRepository } from '../repositories/calendario-horario.repository';
import type { CalendarioModuloRepository } from '../repositories/calendario-modulo.repository';
import type { AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import type { AcademicYearRepository } from '../repositories/academic-year.repository';
import type { AcademicYearModuleScheduleEntry } from '../repositories/academic-year-module-schedule.repository';
import { isLaborable, type DateRange } from './business-day';

/** Narrow seam `AcademicYearModuleScheduleService` depends on (ISP) — it only ever needs to
 * trigger regeneration, never to read `calendario_horario` back. Mirrors
 * `CalendarioModuloSeeder` (see calendario-modulo.service.ts). */
export interface CalendarioHorarioSeeder {
  seedForModule(academicYearModuleId: string, startYear: number, scheduleEntries: AcademicYearModuleScheduleEntry[]): Promise<void>;
}

/** Same categories `calendario-modulo.service.ts`'s `NON_WORKING_CATEGORIES` treats as a
 * real day off — `academic_key_dates` deliberately excluded (informational, not a real
 * non-working day). Kept as its own constant (rather than importing the private one) since
 * `calendario-modulo.service.ts` doesn't export it; both lists must be kept in sync by hand
 * if the category set ever changes. */
const NON_WORKING_CATEGORIES = new Set(['holidays', 'public_holidays', 'free_disposal_days']);

const SCHOOL_YEAR_START_MONTH = 9; // September
const SCHOOL_YEAR_START_DAY = 1;
const SCHOOL_YEAR_END_MONTH = 6; // June
const SCHOOL_YEAR_END_DAY = 30;

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Monday=1 ... Friday=5, matching `AcademicYearModuleScheduleEntry.weekday`'s convention —
 * `Date.UTC`/`getUTCDay()`'s own Sunday=0..Saturday=6 mapping shifted by the same walk
 * `business-day.ts` already uses. */
function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Walks every date from `${startYear}-09-01` to `${startYear + 1}-06-30` inclusive — the
 * same 10-month window `calendario-months` renders (UC-04), never July. */
function schoolYearDates(startYear: number): string[] {
  const dates: string[] = [];
  let current = new Date(Date.UTC(startYear, SCHOOL_YEAR_START_MONTH - 1, SCHOOL_YEAR_START_DAY));
  const end = new Date(Date.UTC(startYear + 1, SCHOOL_YEAR_END_MONTH - 1, SCHOOL_YEAR_END_DAY));
  while (current.getTime() <= end.getTime()) {
    dates.push(toIsoDate(current.getUTCFullYear(), current.getUTCMonth() + 1, current.getUTCDate()));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

export class CalendarioHorarioService implements CalendarioHorarioSeeder {
  constructor(
    private readonly calendarioHorarioRepository: CalendarioHorarioRepository,
    private readonly calendarioModuloRepository: CalendarioModuloRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly academicYearRepository: AcademicYearRepository,
  ) {}

  /** Regenerates `calendario_horario` for this módulo in full (UC-12's Main flow): walks
   * every real date of the `startYear` school year, and for each one whose weekday has a
   * matching entry in `scheduleEntries` and that isn't inside a real non-working range
   * (`calendario_modulo`'s holidays/public_holidays/free_disposal_days rows for this
   * módulo), includes `{ date, hours }` — always calls `replaceAll`, even with an empty
   * result, so an all-blank schedule still clears any previously generated rows. */
  async seedForModule(
    academicYearModuleId: string,
    startYear: number,
    scheduleEntries: AcademicYearModuleScheduleEntry[],
  ): Promise<void> {
    const hoursByWeekday = new Map(scheduleEntries.map((entry) => [entry.weekday, entry.hours]));

    const moduloEntries = await this.calendarioModuloRepository.findAllForAcademicYearModule(academicYearModuleId);
    const nonWorkingRanges: DateRange[] = moduloEntries
      .filter((entry) => NON_WORKING_CATEGORIES.has(entry.category))
      .map((entry) => ({ startDate: entry.startDate, endDate: entry.endDate }));

    const entries: CalendarioHorarioEntry[] = [];
    for (const date of schoolYearDates(startYear)) {
      const hours = hoursByWeekday.get(weekdayOf(date));
      if (hours === undefined) continue;
      if (!isLaborable(date, nonWorkingRanges)) continue;
      entries.push({ date, hours });
    }

    await this.calendarioHorarioRepository.replaceAll(academicYearModuleId, entries);
  }

  /** Returns `null` when `academicYearModuleId` doesn't exist, or its academic year isn't
   * owned by this teacher — same ownership-check pattern as
   * `CalendarioModuloService.findForTeacher`. An empty array is a valid, non-null result
   * (owned, but Horario has never been saved, or was saved all-blank). */
  async findForTeacher(teacherId: string, academicYearModuleId: string): Promise<CalendarioHorarioEntry[] | null> {
    const ref = await this.academicYearModuleRepository.findById(academicYearModuleId);
    if (!ref) return null;

    const year = await this.academicYearRepository.findById(teacherId, ref.academicYearId);
    if (!year) return null;

    return this.calendarioHorarioRepository.findAllForAcademicYearModule(academicYearModuleId);
  }
}
