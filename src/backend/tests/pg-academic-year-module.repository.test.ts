// elementId: module-table, module-selection-table (backend infrastructure — backs this
// view's server-side data needs, see views/configuracion/api-contracts.md and
// schema-changes.sql). New module, doesn't exist yet. findAllForYear joins catalog_modules
// (+ catalog_cycles for the cycle's name) so the frontend gets everything it needs to
// render training-cycle-table/module-table without a second round trip.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgAcademicYearModuleRepository } from '../src/repositories/postgres/pg-academic-year-module.repository';

describe('PgAcademicYearModuleRepository', () => {
  it('findAllForYear maps the joined rows to the domain AcademicYearModuleDetail shape', async () => {
    const fakeSql = createFakeSql([
      [
        {
          id: 'am1',
          catalog_module_id: 'm1',
          catalog_training_cycle_id: 'c1',
          catalog_training_cycle_name: 'Desarrollo de Aplicaciones Web',
          course: 1,
          name: 'Programación',
        },
      ],
    ]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    const modules = await repo.findAllForYear('y1');

    expect(modules).toEqual([
      {
        id: 'am1',
        catalogModuleId: 'm1',
        catalogTrainingCycleId: 'c1',
        catalogTrainingCycleName: 'Desarrollo de Aplicaciones Web',
        course: 1,
        name: 'Programación',
      },
    ]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM academic_year_modules');
    expect(fakeSql.calls[0].values).toEqual(['y1']);
  });

  it('findById returns null when no row matches', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    const ref = await repo.findById('unknown');

    expect(ref).toBeNull();
  });

  it('findById maps the returned row to id/academicYearId/catalogModuleId', async () => {
    const fakeSql = createFakeSql([[{ id: 'am1', academic_year_id: 'y1', catalog_module_id: 'm1' }]]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    const ref = await repo.findById('am1');

    expect(ref).toEqual({ id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' });
  });

  it('countForYear returns the row count for the given academic year', async () => {
    const fakeSql = createFakeSql([[{ count: '2' }]]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    const count = await repo.countForYear('y1');

    expect(count).toBe(2);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('academic_year_modules');
  });

  it('createMany inserts every módulo not already assigned and returns how many were actually inserted', async () => {
    const fakeSql = createFakeSql([
      [{ id: 'am1' }], // m1 inserted
      [], // m2 already assigned — ON CONFLICT DO NOTHING, no row returned
    ]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    const insertedCount = await repo.createMany('y1', ['m1', 'm2']);

    expect(insertedCount).toBe(1);
    expect(fakeSql.calls.length).toBe(2);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('INSERT INTO academic_year_modules');
  });

  it('createMany with an empty list makes no INSERT calls and returns 0', async () => {
    const fakeSql = createFakeSql([]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    const insertedCount = await repo.createMany('y1', []);

    expect(insertedCount).toBe(0);
    expect(fakeSql.calls.length).toBe(0);
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    await repo.delete('am1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM academic_year_modules');
    expect(fakeSql.calls[0].values).toEqual(['am1']);
  });
});
