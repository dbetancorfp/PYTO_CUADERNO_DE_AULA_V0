// elementId: (backend infrastructure — backs catalog-training-cycle-table's server-side
// data needs, see views/configuracion/api-contracts.md and schema-changes.sql). Shared,
// global catalog table (`catalog_cycles`) — no per-teacher scoping, no
// findReferencingAcademicYears here — catalog_cycles has no FK relation to anything
// year-related, unlike the old (dropped) PgTrainingCycleRepository.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgCatalogTrainingCycleRepository } from '../src/repositories/postgres/pg-catalog-training-cycle.repository';

describe('PgCatalogTrainingCycleRepository', () => {
  it('findAll maps rows to the domain CatalogTrainingCycle shape', async () => {
    const fakeSql = createFakeSql([
      [
        { id: 'c1', name: 'DAW' },
        { id: 'c2', name: 'DAM' },
      ],
    ]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycles = await repo.findAll();

    expect(cycles).toEqual([
      { id: 'c1', name: 'DAW' },
      { id: 'c2', name: 'DAM' },
    ]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM catalog_cycles');
  });

  it('findById returns null when no row matches', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.findById('c1');

    expect(cycle).toBeNull();
    expect(fakeSql.calls[0].values).toEqual(['c1']);
  });

  it('findByName maps the returned row', async () => {
    const fakeSql = createFakeSql([[{ id: 'c1', name: 'DAW' }]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.findByName('DAW');

    expect(cycle).toEqual({ id: 'c1', name: 'DAW' });
    expect(fakeSql.calls[0].values).toEqual(['DAW']);
  });

  it('create inserts and returns the new row', async () => {
    const fakeSql = createFakeSql([[{ id: 'c1', name: 'DAW' }]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.create('DAW');

    expect(cycle).toEqual({ id: 'c1', name: 'DAW' });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('INSERT INTO catalog_cycles');
    expect(sql).toContain('RETURNING');
  });

  it('rename updates the name and returns the updated row', async () => {
    const fakeSql = createFakeSql([[{ id: 'c1', name: 'DAW Renamed' }]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    const cycle = await repo.rename('c1', 'DAW Renamed');

    expect(cycle).toEqual({ id: 'c1', name: 'DAW Renamed' });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('UPDATE catalog_cycles');
    expect(sql).toContain('RETURNING');
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCatalogTrainingCycleRepository(fakeSql);

    await repo.delete('c1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM catalog_cycles');
    expect(fakeSql.calls[0].values).toEqual(['c1']);
  });
});
