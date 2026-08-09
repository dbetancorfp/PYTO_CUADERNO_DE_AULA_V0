// elementId: calendario-months (business-logic side of UC-08, see
// views/calendario/use-cases.md). Pure, category-agnostic date-walking helpers
// CalendarioModuloService.seedForModules uses to compute "final_exams" rows — the caller
// decides which category ranges count as non-working (see calendario-modulo.service.test.ts
// for the academic_key_dates-exclusion rule, which lives in the caller, not here).
import { describe, it, expect } from 'bun:test';
import { isLaborable, addLaborableDays, subtractLaborableDays } from '../src/services/business-day';
import type { DateRange } from '../src/services/business-day';

describe('elementId: calendario-months (business-day helpers — UC-08)', () => {
  describe('isLaborable', () => {
    it('returns true for a plain weekday with no non-working ranges', () => {
      expect(isLaborable('2026-08-14', [])).toBe(true); // Friday
    });

    it('returns false for a Saturday', () => {
      expect(isLaborable('2026-08-15', [])).toBe(false);
    });

    it('returns false for a Sunday', () => {
      expect(isLaborable('2026-08-16', [])).toBe(false);
    });

    it('returns false for a weekday inside a non-working range', () => {
      const ranges: DateRange[] = [{ startDate: '2026-10-12', endDate: '2026-10-12' }];
      expect(isLaborable('2026-10-12', ranges)).toBe(false); // Monday, Fiesta Nacional
    });

    it('returns true for a weekday just outside a non-working range boundary', () => {
      const ranges: DateRange[] = [{ startDate: '2026-10-12', endDate: '2026-10-12' }];
      expect(isLaborable('2026-10-13', ranges)).toBe(true);
    });

    it('returns false for every day inside a long non-working range (Navidad), including weekends', () => {
      const ranges: DateRange[] = [{ startDate: '2026-12-22', endDate: '2027-01-07' }];
      expect(isLaborable('2026-12-25', ranges)).toBe(false);
      expect(isLaborable('2026-12-27', ranges)).toBe(false); // a Sunday inside the range too
      expect(isLaborable('2027-01-07', ranges)).toBe(false); // inclusive end boundary
    });

    it('does not exclude a day just because it falls inside an unrelated, wide range the caller chooses not to pass', () => {
      // No academic_key_dates-style range passed at all — isLaborable has no notion of
      // categories, it only ever sees the ranges it's given.
      expect(isLaborable('2026-12-15', [])).toBe(true);
    });
  });

  describe('addLaborableDays', () => {
    it('skips a weekend entirely (Friday + 2 business days = the following Tuesday)', () => {
      expect(addLaborableDays('2026-08-14', 2, [])).toBe('2026-08-18');
    });

    it('skips a public holiday that falls on a weekday', () => {
      const ranges: DateRange[] = [{ startDate: '2026-10-12', endDate: '2026-10-12' }];
      // Friday 10-09 -> Sat/Sun skipped -> Mon 10-12 skipped (holiday) -> Tue 10-13 (1) -> Wed 10-14 (2)
      expect(addLaborableDays('2026-10-09', 2, ranges)).toBe('2026-10-14');
    });

    it('skips an entire long holidays range (Vacaciones de Navidad) as a block', () => {
      const ranges: DateRange[] = [{ startDate: '2026-12-22', endDate: '2027-01-07' }];
      // Friday 12-18 -> Mon 12-21 (1, plain weekday before the range) -> range skipped whole -> Fri 01-08 (2)
      expect(addLaborableDays('2026-12-18', 2, ranges)).toBe('2027-01-08');
    });

    it('skips a free-disposal single day', () => {
      const ranges: DateRange[] = [{ startDate: '2026-11-03', endDate: '2026-11-03' }];
      // Mon 11-02 -> Tue 11-03 skipped (libre disposición) -> Wed 11-04 (1) -> Thu 11-05 (2)
      expect(addLaborableDays('2026-11-02', 2, ranges)).toBe('2026-11-05');
    });

    it('skips several disjoint non-working ranges combined', () => {
      const ranges: DateRange[] = [
        { startDate: '2026-02-09', endDate: '2026-02-09' },
        { startDate: '2026-02-10', endDate: '2026-02-10' },
      ];
      // Fri 02-06 -> Sat/Sun skipped -> Mon 02-09 skipped -> Tue 02-10 skipped -> Wed 02-11 (1) -> Thu 02-12 (2)
      expect(addLaborableDays('2026-02-06', 2, ranges)).toBe('2026-02-12');
    });
  });

  describe('subtractLaborableDays', () => {
    it('skips a weekend entirely walking backward (mirrors addLaborableDays)', () => {
      expect(subtractLaborableDays('2026-08-18', 2, [])).toBe('2026-08-14');
    });

    it('skips a long holidays range walking backward', () => {
      const ranges: DateRange[] = [{ startDate: '2026-12-22', endDate: '2027-01-07' }];
      expect(subtractLaborableDays('2027-01-08', 2, ranges)).toBe('2026-12-18');
    });

    it('computes the 4-business-day walk used for "Examen final" (recuperación − 4)', () => {
      // Recuperación final on Tue 2026-12-15 -> Mon 12-14 (1) -> Sun/Sat skipped -> Fri 12-11 (2) -> Thu 12-10 (3) -> Wed 12-09 (4)
      expect(subtractLaborableDays('2026-12-15', 4, [])).toBe('2026-12-09');
    });
  });
});
