// elementId: (backend infrastructure — no single elementId; backs module-selection-table's
// server-side data needs, see views/configuracion/api-contracts.md and schema-changes.sql).
// New module, doesn't exist yet.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgAcademicYearModuleRepository } from '../src/repositories/postgres/pg-academic-year-module.repository';

describe('PgAcademicYearModuleRepository', () => {
  it('findModuleIdsForYear maps rows to a flat array of module ids', async () => {
    const fakeSql = createFakeSql([[{ module_id: 'm1' }, { module_id: 'm2' }]]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    const moduleIds = await repo.findModuleIdsForYear('ay1');

    expect(moduleIds).toEqual(['m1', 'm2']);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM academic_year_modules');
    expect(fakeSql.calls[0].values).toEqual(['ay1']);
  });

  it('findModuleIdsForYear returns an empty array when nothing is selected', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    expect(await repo.findModuleIdsForYear('ay1')).toEqual([]);
  });

  it('replaceSelection clears the previous selection and inserts exactly the given module ids', async () => {
    const fakeSql = createFakeSql([[], []]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    await repo.replaceSelection('ay1', ['m1', 'm2']);

    const deleteCall = fakeSql.calls.find((call) => sqlTextOf(call).includes('DELETE'));
    const insertCall = fakeSql.calls.find((call) => sqlTextOf(call).includes('INSERT'));
    expect(deleteCall).toBeDefined();
    expect(sqlTextOf(deleteCall!)).toContain('academic_year_modules');
    expect(insertCall).toBeDefined();
    expect(sqlTextOf(insertCall!)).toContain('academic_year_modules');
  });

  it('replaceSelection with an empty array clears the selection and inserts nothing', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearModuleRepository(fakeSql);

    await repo.replaceSelection('ay1', []);

    const deleteCall = fakeSql.calls.find((call) => sqlTextOf(call).includes('DELETE'));
    expect(deleteCall).toBeDefined();
    const insertCall = fakeSql.calls.find((call) => sqlTextOf(call).includes('INSERT'));
    expect(insertCall).toBeUndefined();
  });
});
