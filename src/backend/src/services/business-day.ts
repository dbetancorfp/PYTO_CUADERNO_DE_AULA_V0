// elementId: calendario-months (business-logic side of UC-08, see
// views/calendario/use-cases.md). Pure, category-agnostic date-walking helpers consumed by
// CalendarioModuloService.seedForModules to compute the "final_exams" rows. These functions
// have no notion of key_dates categories — the caller decides which resolved ranges count
// as non-working (see calendario-modulo.service.ts, which excludes academic_key_dates).

/** ISO "YYYY-MM-DD" date range, inclusive on both ends. */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/** Parses a "YYYY-MM-DD" string into a UTC-midnight timestamp (ms) without going through
 * `Date.parse`'s ISO-8601 string grammar, which caps the year at 4 digits — `academic_year`
 * rows may carry a synthetic 5+ digit `startYear` (see calendario-modulo.service.ts test
 * fixtures), and `new Date(string)` throws `Invalid Date` for those instead of parsing them. */
function toUtcMillis(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Formats a UTC-midnight timestamp (ms) back into "YYYY-MM-DD", zero-padded. Deliberately
 * not `.toISOString()`, which switches to the extended (signed, 6-digit year) format outside
 * year range 0000-9999 — a different shape than the plain "YYYY-MM-DD" used everywhere else
 * in `calendario_modulo`. */
function toDateString(millis: number): string {
  const d = new Date(millis);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekend(date: string): boolean {
  const dayOfWeek = new Date(toUtcMillis(date)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday, Saturday
}

function isWithinRange(date: string, range: DateRange): boolean {
  // "YYYY-MM-DD" strings compare lexicographically the same as their date order.
  return date >= range.startDate && date <= range.endDate;
}

/** Exported (2026-08-12) for callers that need plain day-arithmetic without the
 * laborable-day walk — e.g. calendario-modulo.service.ts's evaluation-range boundaries and
 * calendario-horario.service.ts's school-year date walk. */
export function shiftByOneDay(date: string, direction: 1 | -1): string {
  const shifted = new Date(toUtcMillis(date));
  shifted.setUTCDate(shifted.getUTCDate() + direction);
  return toDateString(shifted.getTime());
}

/** `true` when `date` is a weekday not covered by any of `nonWorkingRanges`. */
export function isLaborable(date: string, nonWorkingRanges: DateRange[]): boolean {
  if (isWeekend(date)) return false;
  return !nonWorkingRanges.some((range) => isWithinRange(date, range));
}

/** Walks forward from `start` (exclusive), skipping every non-laborable day, until `days`
 * laborable days have been found, and returns the last one landed on. */
export function addLaborableDays(start: string, days: number, nonWorkingRanges: DateRange[]): string {
  let current = start;
  let found = 0;
  while (found < days) {
    current = shiftByOneDay(current, 1);
    if (isLaborable(current, nonWorkingRanges)) found++;
  }
  return current;
}

/** Mirrors `addLaborableDays`, walking backward from `start` (exclusive). */
export function subtractLaborableDays(start: string, days: number, nonWorkingRanges: DateRange[]): string {
  let current = start;
  let found = 0;
  while (found < days) {
    current = shiftByOneDay(current, -1);
    if (isLaborable(current, nonWorkingRanges)) found++;
  }
  return current;
}

/** Counts laborable days in the half-open range `[start, end)` — `start` inclusive, `end`
 * exclusive (see calendario-modulo.service.ts's `computeEvaluationWorkingDaysEntries`,
 * UC-09). An empty or inverted range (`start >= end`) counts 0. */
export function countLaborableDays(start: string, end: string, nonWorkingRanges: DateRange[]): number {
  let current = start;
  let count = 0;
  while (current < end) {
    if (isLaborable(current, nonWorkingRanges)) count++;
    current = shiftByOneDay(current, 1);
  }
  return count;
}
