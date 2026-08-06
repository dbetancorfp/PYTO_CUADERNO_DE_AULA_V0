// elementId: (backend infrastructure — backs academic-year-table's server-side data needs,
// see views/configuracion/api-contracts.md and schema-changes.sql). New module, doesn't
// exist yet. Per-teacher table, unlike the shared catalog_cycles/catalog_modules tables.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgAcademicYearRepository } from '../src/repositories/postgres/pg-academic-year.repository';

describe('PgAcademicYearRepository', () => {
  it('findAllForTeacher maps rows to the domain AcademicYear shape, scoped to the teacher', async () => {
    const fakeSql = createFakeSql([
      [
        { id: 'y1', teacher_id: 't1', start_year: 2026, is_current: true },
        { id: 'y2', teacher_id: 't1', start_year: 2025, is_current: false },
      ],
    ]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const years = await repo.findAllForTeacher('t1');

    expect(years).toEqual([
      { id: 'y1', teacherId: 't1', startYear: 2026, isCurrent: true },
      { id: 'y2', teacherId: 't1', startYear: 2025, isCurrent: false },
    ]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM academic_years');
    expect(fakeSql.calls[0].values).toEqual(['t1']);
  });

  it('findById returns null when the row does not belong to this teacher', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.findById('t1', 'y1');

    expect(year).toBeNull();
    expect(fakeSql.calls[0].values).toEqual(['t1', 'y1']);
  });

  it('findByStartYear maps the returned row, scoped to the teacher', async () => {
    const fakeSql = createFakeSql([[{ id: 'y1', teacher_id: 't1', start_year: 2026, is_current: false }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.findByStartYear('t1', 2026);

    expect(year).toEqual({ id: 'y1', teacherId: 't1', startYear: 2026, isCurrent: false });
    expect(fakeSql.calls[0].values).toEqual(['t1', 2026]);
  });

  it('create inserts and returns the new row', async () => {
    const fakeSql = createFakeSql([[{ id: 'y1', teacher_id: 't1', start_year: 2026, is_current: false }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.create('t1', 2026);

    expect(year).toEqual({ id: 'y1', teacherId: 't1', startYear: 2026, isCurrent: false });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('INSERT INTO academic_years');
    expect(sql).toContain('RETURNING');
  });

  it('rename updates start_year and returns the updated row', async () => {
    const fakeSql = createFakeSql([[{ id: 'y1', teacher_id: 't1', start_year: 2027, is_current: false }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.rename('y1', 2027);

    expect(year).toEqual({ id: 'y1', teacherId: 't1', startYear: 2027, isCurrent: false });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('UPDATE academic_years');
    expect(sql).toContain('RETURNING');
  });

  it('markCurrent un-marks every other row for this teacher and marks the given one, in one transaction', async () => {
    const fakeSql = createFakeSql([[{ id: 'y1', teacher_id: 't1', start_year: 2026, is_current: true }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.markCurrent('t1', 'y1');

    expect(year).toEqual({ id: 'y1', teacherId: 't1', startYear: 2026, isCurrent: true });
    const calledSql = fakeSql.calls.map(sqlTextOf).join(' ');
    expect(calledSql).toContain('UPDATE academic_years');
    expect(calledSql).toContain('is_current');
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    await repo.delete('y1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM academic_years');
    expect(fakeSql.calls[0].values).toEqual(['y1']);
  });
});
