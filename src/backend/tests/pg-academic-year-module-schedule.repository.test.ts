// elementId: schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select,
// schedule-thursday-select, schedule-friday-select, schedule-save-button (backend
// infrastructure for UC-11 — see views/configuracion/api-contracts.md and
// schema-changes.sql). New module, doesn't exist yet. `replaceAll` is a full replace: one
// DELETE clearing every existing row for this academic_year_module_id, followed by one
// INSERT per entry — this repository is only ever called after the route layer's 1-5/1-3
// range and duplicate-weekday validation, so no CHECK-violation path is exercised here.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgAcademicYearModuleScheduleRepository } from '../src/repositories/postgres/pg-academic-year-module-schedule.repository';

describe('PgAcademicYearModuleScheduleRepository', () => {
  it('findByModuleId maps the returned rows to weekday/hours', async () => {
    const fakeSql = createFakeSql([
      [
        { weekday: 1, hours: 2 },
        { weekday: 3, hours: 1 },
      ],
    ]);
    const repo = new PgAcademicYearModuleScheduleRepository(fakeSql);

    const entries = await repo.findByModuleId('am1');

    expect(entries).toEqual([
      { weekday: 1, hours: 2 },
      { weekday: 3, hours: 1 },
    ]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM academic_year_module_schedules');
    expect(fakeSql.calls[0].values).toEqual(['am1']);
  });

  it('findByModuleId returns [] for a módulo with no saved schedule', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearModuleScheduleRepository(fakeSql);

    const entries = await repo.findByModuleId('am1');

    expect(entries).toEqual([]);
  });

  it('replaceAll deletes every existing row for the módulo, then inserts one row per entry', async () => {
    const fakeSql = createFakeSql([
      [], // DELETE
      [{ weekday: 1, hours: 2 }], // INSERT weekday 1
      [{ weekday: 5, hours: 3 }], // INSERT weekday 5
    ]);
    const repo = new PgAcademicYearModuleScheduleRepository(fakeSql);

    const result = await repo.replaceAll('am1', [
      { weekday: 1, hours: 2 },
      { weekday: 5, hours: 3 },
    ]);

    expect(result).toEqual([
      { weekday: 1, hours: 2 },
      { weekday: 5, hours: 3 },
    ]);
    expect(fakeSql.calls).toHaveLength(3);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM academic_year_module_schedules');
    expect(fakeSql.calls[0].values).toEqual(['am1']);
    expect(sqlTextOf(fakeSql.calls[1])).toContain('INSERT INTO academic_year_module_schedules');
  });

  it('replaceAll with an empty entries array only deletes, making no INSERT calls', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgAcademicYearModuleScheduleRepository(fakeSql);

    const result = await repo.replaceAll('am1', []);

    expect(result).toEqual([]);
    expect(fakeSql.calls).toHaveLength(1);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM academic_year_module_schedules');
  });
});
