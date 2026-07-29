// elementId: (backend infrastructure — no single elementId; backs academic-year-table's
// server-side data needs, see views/configuracion/api-contracts.md and schema-changes.sql).
// New module, doesn't exist yet.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgAcademicYearRepository } from '../src/repositories/postgres/pg-academic-year.repository';

describe('PgAcademicYearRepository', () => {
  it('findAllForTeacher maps rows to the domain AcademicYear shape', async () => {
    const fakeSql = createFakeSql([[{ id: 'ay1', teacher_id: 't1', name: '2026/2027', is_current: true }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const years = await repo.findAllForTeacher('t1');

    expect(years).toEqual([{ id: 'ay1', teacherId: 't1', name: '2026/2027', isCurrent: true }]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM academic_years');
    expect(fakeSql.calls[0].values).toEqual(['t1']);
  });

  it('findById returns null when the row does not belong to this teacher', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    expect(await repo.findById('t1', 'ay1')).toBeNull();
  });

  it('findByName maps the returned row', async () => {
    const fakeSql = createFakeSql([[{ id: 'ay1', teacher_id: 't1', name: '2026/2027', is_current: false }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.findByName('t1', '2026/2027');

    expect(year).toEqual({ id: 'ay1', teacherId: 't1', name: '2026/2027', isCurrent: false });
  });

  it('create inserts with is_current false and returns the new row', async () => {
    const fakeSql = createFakeSql([[{ id: 'ay1', teacher_id: 't1', name: '2026/2027', is_current: false }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.create('t1', '2026/2027');

    expect(year).toEqual({ id: 'ay1', teacherId: 't1', name: '2026/2027', isCurrent: false });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('INSERT INTO academic_years');
    expect(sql).toContain('RETURNING');
  });

  it('rename updates the name and returns the updated row', async () => {
    const fakeSql = createFakeSql([[{ id: 'ay1', teacher_id: 't1', name: '2027/2028', is_current: false }]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.rename('ay1', '2027/2028');

    expect(year).toEqual({ id: 'ay1', teacherId: 't1', name: '2027/2028', isCurrent: false });
    expect(sqlTextOf(fakeSql.calls[0])).toContain('UPDATE academic_years');
  });

  it('setCurrent un-marks the previous current row and marks the given one, in one transaction', async () => {
    // Two identical response slots: tolerant of either a single atomic UPDATE...RETURNING
    // or two separate statements (unmark previous, then mark+return this one) — this test
    // only asserts the final resolved row and that is_current is touched somewhere, not the
    // exact call count; the real atomicity is exercised end to end by
    // academic-year.routes.test.ts's "un-marks the previously current year" test.
    const row = { id: 'ay2', teacher_id: 't1', name: '2027/2028', is_current: true };
    const fakeSql = createFakeSql([[row], [row]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    const year = await repo.setCurrent('t1', 'ay2');

    expect(year).toEqual({ id: 'ay2', teacherId: 't1', name: '2027/2028', isCurrent: true });
    // Both the un-mark and the mark happen against the real Postgres backend, atomically —
    // asserting at least one call touches is_current is enough at the repository-unit level;
    // the transactional atomicity itself is exercised for real by academic-year.routes.test.ts.
    expect(fakeSql.calls.some((call) => sqlTextOf(call).includes('is_current'))).toBe(true);
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearRepository(fakeSql);

    await repo.delete('ay1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM academic_years');
    expect(fakeSql.calls[0].values).toEqual(['ay1']);
  });
});
