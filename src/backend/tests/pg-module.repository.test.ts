// elementId: (backend infrastructure — no single elementId; backs module-table's server-side
// data needs, see views/configuracion/api-contracts.md and schema-changes.sql). New module,
// doesn't exist yet.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgModuleRepository } from '../src/repositories/postgres/pg-module.repository';

describe('PgModuleRepository', () => {
  it('findAllForCycle maps rows to the domain Module shape', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', training_cycle_id: 'c1', course: 1, name: 'Programación' }]]);
    const repo = new PgModuleRepository(fakeSql);

    const modules = await repo.findAllForCycle('c1');

    expect(modules).toEqual([{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM modules');
    expect(fakeSql.calls[0].values).toEqual(['c1']);
  });

  it('findAllForTeacher maps joined rows including the cycle name', async () => {
    const fakeSql = createFakeSql([
      [
        {
          id: 'm1',
          training_cycle_id: 'c1',
          course: 1,
          name: 'Programación',
          training_cycle_name: 'DAW',
        },
      ],
    ]);
    const repo = new PgModuleRepository(fakeSql);

    const modules = await repo.findAllForTeacher('t1');

    expect(modules).toEqual([
      { id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación', trainingCycleName: 'DAW' },
    ]);
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('FROM modules');
    expect(sql).toContain('training_cycles');
    expect(fakeSql.calls[0].values).toEqual(['t1']);
  });

  it('findById returns null when no row matches', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgModuleRepository(fakeSql);

    expect(await repo.findById('unknown')).toBeNull();
  });

  it('findByNameAndCourse maps the returned row', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', training_cycle_id: 'c1', course: 1, name: 'Programación' }]]);
    const repo = new PgModuleRepository(fakeSql);

    const module = await repo.findByNameAndCourse('c1', 1, 'Programación');

    expect(module).toEqual({ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' });
    expect(fakeSql.calls[0].values).toEqual(['c1', 1, 'Programación']);
  });

  it('create inserts and returns the new row', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', training_cycle_id: 'c1', course: 1, name: 'Programación' }]]);
    const repo = new PgModuleRepository(fakeSql);

    const module = await repo.create('c1', 1, 'Programación');

    expect(module).toEqual({ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' });
    expect(sqlTextOf(fakeSql.calls[0])).toContain('INSERT INTO modules');
  });

  it('update sends only the provided fields and returns the updated row', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', training_cycle_id: 'c1', course: 2, name: 'Programación' }]]);
    const repo = new PgModuleRepository(fakeSql);

    const module = await repo.update('m1', { course: 2 });

    expect(module).toEqual({ id: 'm1', trainingCycleId: 'c1', course: 2, name: 'Programación' });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('UPDATE modules');
    expect(sql).toContain('course');
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgModuleRepository(fakeSql);

    await repo.delete('m1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM modules');
    expect(fakeSql.calls[0].values).toEqual(['m1']);
  });

  it('findReferencingAcademicYears maps the joined rows to { id, name }', async () => {
    const fakeSql = createFakeSql([[{ id: 'ay1', name: '2026/2027' }]]);
    const repo = new PgModuleRepository(fakeSql);

    const years = await repo.findReferencingAcademicYears('m1');

    expect(years).toEqual([{ id: 'ay1', name: '2026/2027' }]);
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('academic_year_modules');
    expect(fakeSql.calls[0].values).toEqual(['m1']);
  });
});
