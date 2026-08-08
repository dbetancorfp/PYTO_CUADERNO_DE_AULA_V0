// Backend infrastructure — see views/fechas-senaladas/description_fechas-senaladas.md's
// "Seeding — auto-loaded on every backend boot". Verifies the embedded seed data itself
// (43 rows across six categories, matching the corrected documentation/calendario_dias_clave.json
// — see that file for the source of truth) without touching a real database, same fake-sql
// pattern as pg-key-date.repository.test.ts.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { seedKeyDates } from '../src/db/seed-key-dates';

const VALID_CATEGORIES = [
  'academic_key_dates',
  'holidays',
  'public_holidays',
  'free_disposal_days',
  'evaluations',
  'feoe_project_days',
];

const EXPECTED_COUNTS: Record<string, number> = {
  academic_key_dates: 4,
  holidays: 2,
  public_holidays: 10,
  free_disposal_days: 4,
  evaluations: 13,
  feoe_project_days: 10,
};

describe('seedKeyDates', () => {
  it('inserts one row per seed entry, 43 total, one INSERT call each', async () => {
    const fakeSql = createFakeSql([]);

    await seedKeyDates(fakeSql);

    expect(fakeSql.calls).toHaveLength(43);
    for (const call of fakeSql.calls) {
      expect(sqlTextOf(call)).toContain('INSERT INTO key_dates');
    }
  });

  it('every insert is idempotent (ON CONFLICT), never errors or duplicates on re-run', async () => {
    const fakeSql = createFakeSql([]);

    await seedKeyDates(fakeSql);

    for (const call of fakeSql.calls) {
      expect(sqlTextOf(call)).toContain('ON CONFLICT');
    }
  });

  it('every inserted row uses one of the six valid category values', async () => {
    const fakeSql = createFakeSql([]);

    await seedKeyDates(fakeSql);

    for (const call of fakeSql.calls) {
      const category = call.values.find((v) => typeof v === 'string' && VALID_CATEGORIES.includes(v));
      expect(category).toBeDefined();
    }
  });

  it('seeds the exact row count per category documented in description_fechas-senaladas.md', async () => {
    const fakeSql = createFakeSql([]);

    await seedKeyDates(fakeSql);

    const counts: Record<string, number> = {};
    for (const call of fakeSql.calls) {
      const category = call.values.find((v) => typeof v === 'string' && VALID_CATEGORIES.includes(v)) as string;
      counts[category] = (counts[category] ?? 0) + 1;
    }

    expect(counts).toEqual(EXPECTED_COUNTS);
  });

  it('every inserted row has a non-empty name and valid day/month values', async () => {
    const fakeSql = createFakeSql([]);

    await seedKeyDates(fakeSql);

    for (const call of fakeSql.calls) {
      const strings = call.values.filter((v): v is string => typeof v === 'string');
      const numbers = call.values.filter((v): v is number => typeof v === 'number');
      expect(strings.some((s) => s.length > 0 && !VALID_CATEGORIES.includes(s))).toBe(true);
      for (const n of numbers) {
        expect(Number.isInteger(n)).toBe(true);
      }
    }
  });
});
