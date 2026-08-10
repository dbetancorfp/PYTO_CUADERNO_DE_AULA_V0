// elementId: evaluation-working-days-summary (backend infrastructure — see
// views/calendario/schema-changes.sql and api-contracts.md).
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgCalendarioEvaluationWorkingDaysRepository } from '../src/repositories/postgres/pg-calendario-evaluation-working-days.repository';

const ROW = {
  id: 'wd1',
  academic_year_module_id: 'am1',
  evaluation_number: 1,
  working_days: 56,
};

const DOMAIN = {
  id: 'wd1',
  academicYearModuleId: 'am1',
  evaluationNumber: 1,
  workingDays: 56,
};

describe('PgCalendarioEvaluationWorkingDaysRepository', () => {
  it('findAllForAcademicYearModule maps every returned row to the domain shape', async () => {
    const fakeSql = createFakeSql([[ROW]]);
    const repo = new PgCalendarioEvaluationWorkingDaysRepository(fakeSql);

    const rows = await repo.findAllForAcademicYearModule('am1');

    expect(rows).toEqual([DOMAIN]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM calendario_evaluation_working_days');
    expect(fakeSql.calls[0]!.values).toContain('am1');
  });

  it('findAllForAcademicYearModule returns an empty array when there are no rows', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCalendarioEvaluationWorkingDaysRepository(fakeSql);

    const rows = await repo.findAllForAcademicYearModule('unknown');

    expect(rows).toEqual([]);
  });

  it('createMany sends one INSERT per entry, ON CONFLICT DO NOTHING', async () => {
    const fakeSql = createFakeSql([[], []]);
    const repo = new PgCalendarioEvaluationWorkingDaysRepository(fakeSql);

    await repo.createMany([
      { academicYearModuleId: 'am1', evaluationNumber: 1, workingDays: 56 },
      { academicYearModuleId: 'am1', evaluationNumber: 2, workingDays: 121 },
    ]);

    expect(fakeSql.calls).toHaveLength(2);
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('INSERT INTO calendario_evaluation_working_days');
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('ON CONFLICT');
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('DO NOTHING');
    expect(fakeSql.calls[0]!.values).toEqual(['am1', 1, 56]);
    expect(fakeSql.calls[1]!.values).toEqual(['am1', 2, 121]);
  });

  it('createMany does nothing when entries is empty', async () => {
    const fakeSql = createFakeSql([]);
    const repo = new PgCalendarioEvaluationWorkingDaysRepository(fakeSql);

    await repo.createMany([]);

    expect(fakeSql.calls).toHaveLength(0);
  });
});
