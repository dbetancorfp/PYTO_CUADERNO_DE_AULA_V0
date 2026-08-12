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
//
// 2026-08-12 bugfix: the walk range is this módulo's own real teaching period — the
// single-day `"Inicio curso: <sufijo>."`/`"Fin de curso: <sufijo>."` `academic_key_dates`
// rows UC-06/A2 already splits into `calendario_modulo` (16/09-22/06 for course 1,
// 16/09-27/05 for course 2, per the real `key_dates` seed) — never a fixed 1
// September-30 June window (the original, incorrect implementation this replaced: it both
// started 15 days too early and, for a course-2 módulo, ran a full month past the real end
// date).
import type { CalendarioHorarioEntry, CalendarioHorarioRepository } from '../repositories/calendario-horario.repository';
import type { CalendarioModuloEntry, CalendarioModuloRepository } from '../repositories/calendario-modulo.repository';
import type { AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import type { AcademicYearRepository } from '../repositories/academic-year.repository';
import type { AcademicYearModuleScheduleEntry } from '../repositories/academic-year-module-schedule.repository';
import { isLaborable, type DateRange } from './business-day';
import { nonWorkingRangesFor, type FinalExamsRecomputer } from './calendario-modulo.service';

/** Narrow seam `AcademicYearModuleScheduleService` depends on (ISP) — it only ever needs to
 * trigger regeneration, never to read `calendario_horario` back. Mirrors
 * `CalendarioModuloSeeder` (see calendario-modulo.service.ts). No `startYear` param (removed
 * 2026-08-12) — the walk range now comes entirely from the módulo's own `calendario_modulo`
 * Inicio/Fin curso rows, not from the academic year's `startYear`. */
export interface CalendarioHorarioSeeder {
  seedForModule(academicYearModuleId: string, scheduleEntries: AcademicYearModuleScheduleEntry[]): Promise<void>;
}

const INICIO_CURSO_PREFIX = 'Inicio curso:';
const FIN_CURSO_PREFIX = 'Fin de curso:';

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

function addOneDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000);
  return toIsoDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** Walks every date in `[start, end]` inclusive. */
function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let current = start; current <= end; current = addOneDay(current)) {
    dates.push(current);
  }
  return dates;
}

/** This módulo's own real teaching-period bounds — the single-day `"Inicio curso: ..."`/
 * `"Fin de curso: ..."` rows UC-06/A2 already produced in `calendario_modulo` (course-
 * specific: `calendario_modulo` is already course-filtered at seed time, per UC-06/A1, so
 * exactly one of each exists for a módulo that has gone through UC-06's seeding). `null`
 * only if neither has been seeded yet — shouldn't happen for a real, assigned módulo (see
 * this file's header comment), but `seedForModule` treats it as "nothing to walk" rather
 * than throwing. */
function teachingPeriod(moduloEntries: readonly CalendarioModuloEntry[]): DateRange | null {
  const inicio = moduloEntries.find((entry) => entry.category === 'academic_key_dates' && entry.name.startsWith(INICIO_CURSO_PREFIX));
  const fin = moduloEntries.find((entry) => entry.category === 'academic_key_dates' && entry.name.startsWith(FIN_CURSO_PREFIX));
  if (!inicio || !fin) return null;
  return { startDate: inicio.startDate, endDate: fin.startDate };
}

export class CalendarioHorarioService implements CalendarioHorarioSeeder {
  constructor(
    private readonly calendarioHorarioRepository: CalendarioHorarioRepository,
    private readonly calendarioModuloRepository: CalendarioModuloRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly academicYearRepository: AcademicYearRepository,
    private readonly finalExamsRecomputer: FinalExamsRecomputer,
  ) {}

  /** Regenerates `calendario_horario` for this módulo in full (UC-12's Main flow): walks
   * every real date in this módulo's own `[Inicio curso, Fin de curso]` teaching period,
   * and for each one whose weekday has a matching entry in `scheduleEntries` and that isn't
   * inside a real non-working range (`calendario_modulo`'s holidays/public_holidays/
   * free_disposal_days rows for this módulo), includes `{ date, hours }` — always calls
   * `replaceAll`, even with an empty result, so an all-blank schedule (or a módulo whose
   * teaching period can't be determined yet) still clears any previously generated rows.
   * 2026-08-12: also triggers `finalExamsRecomputer` with the just-computed entries, right
   * after — see UC-08/UC-09's revisions and `CalendarioModuloService.recomputeForModule`. */
  async seedForModule(academicYearModuleId: string, scheduleEntries: AcademicYearModuleScheduleEntry[]): Promise<void> {
    const hoursByWeekday = new Map(scheduleEntries.map((entry) => [entry.weekday, entry.hours]));

    const moduloEntries = await this.calendarioModuloRepository.findAllForAcademicYearModule(academicYearModuleId);
    const period = teachingPeriod(moduloEntries);
    const nonWorkingRanges: DateRange[] = nonWorkingRangesFor(moduloEntries);

    const entries: CalendarioHorarioEntry[] = [];
    if (period) {
      for (const date of datesBetween(period.startDate, period.endDate)) {
        const hours = hoursByWeekday.get(weekdayOf(date));
        if (hours === undefined) continue;
        if (!isLaborable(date, nonWorkingRanges)) continue;
        entries.push({ date, hours });
      }
    }

    await this.calendarioHorarioRepository.replaceAll(academicYearModuleId, entries);
    await this.finalExamsRecomputer.recomputeForModule(academicYearModuleId, entries);
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
