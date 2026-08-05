// elementId: (backend infrastructure — backs catalog-module-table's server-side data
// needs, see views/configuracion/api-contracts.md and schema-changes.sql). New module,
// doesn't exist yet. No findReferencingAcademicYears here — catalog_modules has no FK
// relation to anything year-related, unlike the old (dropped) PgModuleRepository. No
// findAllForTeacher flat cross-cycle listing either — api-contracts.md defines no such
// endpoint for this catalog.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgCatalogModuleRepository } from '../src/repositories/postgres/pg-catalog-module.repository';

describe('PgCatalogModuleRepository', () => {
  it('findAllForCycle maps rows to the domain CatalogModule shape', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', catalog_training_cycle_id: 'c1', course: 1, name: 'Programación' }]]);
    const repo = new PgCatalogModuleRepository(fakeSql);

    const modules = await repo.findAllForCycle('c1');

    expect(modules).toEqual([{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM catalog_modules');
    expect(fakeSql.calls[0].values).toEqual(['c1']);
  });

  it('findById returns null when no row matches', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCatalogModuleRepository(fakeSql);

    expect(await repo.findById('unknown')).toBeNull();
  });

  it('findByNameAndCourse maps the returned row', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', catalog_training_cycle_id: 'c1', course: 1, name: 'Programación' }]]);
    const repo = new PgCatalogModuleRepository(fakeSql);

    const module = await repo.findByNameAndCourse('c1', 1, 'Programación');

    expect(module).toEqual({ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' });
    expect(fakeSql.calls[0].values).toEqual(['c1', 1, 'Programación']);
  });

  it('create inserts and returns the new row', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', catalog_training_cycle_id: 'c1', course: 1, name: 'Programación' }]]);
    const repo = new PgCatalogModuleRepository(fakeSql);

    const module = await repo.create('c1', 1, 'Programación');

    expect(module).toEqual({ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' });
    expect(sqlTextOf(fakeSql.calls[0])).toContain('INSERT INTO catalog_modules');
  });

  it('update sends only the provided fields and returns the updated row', async () => {
    const fakeSql = createFakeSql([[{ id: 'm1', catalog_training_cycle_id: 'c1', course: 2, name: 'Programación' }]]);
    const repo = new PgCatalogModuleRepository(fakeSql);

    const module = await repo.update('m1', { course: 2 });

    expect(module).toEqual({ id: 'm1', catalogTrainingCycleId: 'c1', course: 2, name: 'Programación' });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('UPDATE catalog_modules');
    expect(sql).toContain('course');
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCatalogModuleRepository(fakeSql);

    await repo.delete('m1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM catalog_modules');
    expect(fakeSql.calls[0].values).toEqual(['m1']);
  });
});
