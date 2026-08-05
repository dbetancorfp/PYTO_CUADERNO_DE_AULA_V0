// elementId: (backend infrastructure — backs catalog-training-cycle-table's server-side
// data needs, see views/configuracion/api-contracts.md and schema-changes.sql). New module,
// doesn't exist yet. No findReferencingAcademicYears here — catalog_training_cycles has no
// FK relation to anything year-related, unlike the old (dropped) PgTrainingCycleRepository.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgCatalogTrainingCycleRepository } from '../src/repositories/postgres/pg-catalog-training-cycle.repository';

describe('PgCatalogTrainingCycleRepository', () => {
  it('findAllForTeacher maps rows to the domain CatalogTrainingCycle shape, scoped to the teacher', async () => {
    const fakeSql = createFakeSql([
      [
        { id: 'c1', teacher_id: 't1', name: 'DAW' },
        { id: 'c2', teacher_id: 't1', name: 'DAM' },
      ],
    ]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycles = await repo.findAllForTeacher('t1');

    expect(cycles).toEqual([
      { id: 'c1', teacherId: 't1', name: 'DAW' },
      { id: 'c2', teacherId: 't1', name: 'DAM' },
    ]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM catalog_training_cycles');
    expect(fakeSql.calls[0].values).toEqual(['t1']);
  });

  it('findById returns null when the row does not belong to this teacher', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.findById('t1', 'c1');

    expect(cycle).toBeNull();
    expect(fakeSql.calls[0].values).toEqual(['t1', 'c1']);
  });

  it('findByName maps the returned row, scoped to the teacher', async () => {
    const fakeSql = createFakeSql([[{ id: 'c1', teacher_id: 't1', name: 'DAW' }]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.findByName('t1', 'DAW');

    expect(cycle).toEqual({ id: 'c1', teacherId: 't1', name: 'DAW' });
    expect(fakeSql.calls[0].values).toEqual(['t1', 'DAW']);
  });

  it('create inserts and returns the new row', async () => {
    const fakeSql = createFakeSql([[{ id: 'c1', teacher_id: 't1', name: 'DAW' }]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.create('t1', 'DAW');

    expect(cycle).toEqual({ id: 'c1', teacherId: 't1', name: 'DAW' });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('INSERT INTO catalog_training_cycles');
    expect(sql).toContain('RETURNING');
  });

  it('rename updates the name and returns the updated row', async () => {
    const fakeSql = createFakeSql([[{ id: 'c1', teacher_id: 't1', name: 'DAW Renamed' }]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.rename('c1', 'DAW Renamed');

    expect(cycle).toEqual({ id: 'c1', teacherId: 't1', name: 'DAW Renamed' });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('UPDATE catalog_training_cycles');
    expect(sql).toContain('RETURNING');
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    await repo.delete('c1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM catalog_training_cycles');
    expect(fakeSql.calls[0].values).toEqual(['c1']);
  });
});
