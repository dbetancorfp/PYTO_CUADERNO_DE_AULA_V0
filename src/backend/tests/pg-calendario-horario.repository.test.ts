// elementId: calendario-months, calendario-legend, calendario-day-tooltip (backend
// infrastructure for UC-12/UC-13 — see views/calendario/api-contracts.md and
// schema-changes.sql). New module, doesn't exist yet. `replaceAll` is a full replace, same
// shape as pg-academic-year-module-schedule.repository.ts's own `replaceAll`: one DELETE
// clearing every existing row for this academic_year_module_id, followed by one INSERT per
// entry.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgCalendarioHorarioRepository } from '../src/repositories/postgres/pg-calendario-horario.repository';

describe('PgCalendarioHorarioRepository', () => {
  it('findAllForAcademicYearModule maps the returned rows to date/hours, sorted by date', async () => {
    const fakeSql = createFakeSql([
      [
        { date: '2026-09-07', hours: 2 },
        { date: '2026-09-11', hours: 3 },
      ],
    ]);
    const repo = new PgCalendarioHorarioRepository(fakeSql);

    const entries = await repo.findAllForAcademicYearModule('am1');

    expect(entries).toEqual([
      { date: '2026-09-07', hours: 2 },
      { date: '2026-09-11', hours: 3 },
    ]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM calendario_horario');
    expect(fakeSql.calls[0].values).toEqual(['am1']);
  });

  it('findAllForAcademicYearModule returns [] for a módulo with no calendario_horario rows', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCalendarioHorarioRepository(fakeSql);

    const entries = await repo.findAllForAcademicYearModule('am1');

    expect(entries).toEqual([]);
  });

  it('replaceAll deletes every existing row for the módulo, then inserts one row per entry', async () => {
    const fakeSql = createFakeSql([
      [], // DELETE
      [{ date: '2026-09-07', hours: 2 }], // INSERT
      [{ date: '2026-09-11', hours: 3 }], // INSERT
    ]);
    const repo = new PgCalendarioHorarioRepository(fakeSql);

    await repo.replaceAll('am1', [
      { date: '2026-09-07', hours: 2 },
      { date: '2026-09-11', hours: 3 },
    ]);

    expect(fakeSql.calls).toHaveLength(3);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM calendario_horario');
    expect(fakeSql.calls[0].values).toEqual(['am1']);
    expect(sqlTextOf(fakeSql.calls[1])).toContain('INSERT INTO calendario_horario');
  });

  it('replaceAll with an empty entries array only deletes, making no INSERT calls', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCalendarioHorarioRepository(fakeSql);

    await repo.replaceAll('am1', []);

    expect(fakeSql.calls).toHaveLength(1);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM calendario_horario');
  });
});
