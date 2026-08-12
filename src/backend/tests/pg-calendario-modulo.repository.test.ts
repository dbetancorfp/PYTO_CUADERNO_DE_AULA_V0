// elementId: calendario-months, calendario-empty-state (backend infrastructure — see
// views/calendario/schema-changes.sql and api-contracts.md).
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgCalendarioModuloRepository } from '../src/repositories/postgres/pg-calendario-modulo.repository';

const ROW = {
  id: 'cm1',
  academic_year_module_id: 'am1',
  category: 'holidays',
  name: 'Vacaciones de Navidad.',
  start_date: '2026-12-22',
  end_date: '2027-01-07',
  type: 'Vacaciones',
};

const DOMAIN = {
  id: 'cm1',
  academicYearModuleId: 'am1',
  category: 'holidays',
  name: 'Vacaciones de Navidad.',
  startDate: '2026-12-22',
  endDate: '2027-01-07',
  type: 'Vacaciones',
};

describe('PgCalendarioModuloRepository', () => {
  it('findAllForAcademicYearModule maps every returned row to the domain shape', async () => {
    const fakeSql = createFakeSql([[ROW]]);
    const repo = new PgCalendarioModuloRepository(fakeSql);

    const rows = await repo.findAllForAcademicYearModule('am1');

    expect(rows).toEqual([DOMAIN]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM calendario_modulo');
    expect(fakeSql.calls[0]!.values).toContain('am1');
  });

  it('findAllForAcademicYearModule maps a null type column to a null domain type (final_exams rows, or a custom key_dates row with no tipo)', async () => {
    const fakeSql = createFakeSql([[{ ...ROW, type: null }]]);
    const repo = new PgCalendarioModuloRepository(fakeSql);

    const rows = await repo.findAllForAcademicYearModule('am1');

    expect(rows).toEqual([{ ...DOMAIN, type: null }]);
  });

  it('findAllForAcademicYearModule returns an empty array when there are no rows', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCalendarioModuloRepository(fakeSql);

    const rows = await repo.findAllForAcademicYearModule('unknown');

    expect(rows).toEqual([]);
  });

  it('createMany sends one INSERT per entry, ON CONFLICT DO NOTHING, including the type column', async () => {
    const fakeSql = createFakeSql([[], []]);
    const repo = new PgCalendarioModuloRepository(fakeSql);

    await repo.createMany([
      { academicYearModuleId: 'am1', category: 'holidays', name: 'Vacaciones de Navidad.', startDate: '2026-12-22', endDate: '2027-01-07', type: 'Vacaciones' },
      { academicYearModuleId: 'am1', category: 'final_exams', name: '1ª Evaluación - Examen final.', startDate: '2027-03-01', endDate: '2027-03-01', type: null },
    ]);

    expect(fakeSql.calls).toHaveLength(2);
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('INSERT INTO calendario_modulo');
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('type');
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('ON CONFLICT');
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('DO NOTHING');
    expect(fakeSql.calls[0]!.values).toEqual(['am1', 'holidays', 'Vacaciones de Navidad.', '2026-12-22', '2027-01-07', 'Vacaciones']);
    expect(fakeSql.calls[1]!.values).toEqual(['am1', 'final_exams', '1ª Evaluación - Examen final.', '2027-03-01', '2027-03-01', null]);
  });

  it('createMany does nothing when entries is empty', async () => {
    const fakeSql = createFakeSql([]);
    const repo = new PgCalendarioModuloRepository(fakeSql);

    await repo.createMany([]);

    expect(fakeSql.calls).toHaveLength(0);
  });

  it('replaceFinalExamsForModule deletes every existing final_exams row for the módulo, then inserts one row per entry (2026-08-12, UC-08 revision)', async () => {
    const fakeSql = createFakeSql([
      [], // DELETE
      [], // INSERT
      [], // INSERT
    ]);
    const repo = new PgCalendarioModuloRepository(fakeSql);

    await repo.replaceFinalExamsForModule('am1', [
      { academicYearModuleId: 'am1', category: 'final_exams', name: '1ª Evaluación - Examen de recuperación final.', startDate: '2026-12-07', endDate: '2026-12-07', type: null },
      { academicYearModuleId: 'am1', category: 'final_exams', name: '1ª Evaluación - Examen final.', startDate: '2026-11-30', endDate: '2026-11-30', type: null },
    ]);

    expect(fakeSql.calls).toHaveLength(3);
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('DELETE FROM calendario_modulo');
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain("category = 'final_exams'");
    expect(fakeSql.calls[0]!.values).toEqual(['am1']);
    expect(sqlTextOf(fakeSql.calls[1]!)).toContain('INSERT INTO calendario_modulo');
    expect(fakeSql.calls[1]!.values).toEqual(['am1', 'final_exams', '1ª Evaluación - Examen de recuperación final.', '2026-12-07', '2026-12-07', null]);
  });

  it('replaceFinalExamsForModule with an empty entries array only deletes, making no INSERT calls', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgCalendarioModuloRepository(fakeSql);

    await repo.replaceFinalExamsForModule('am1', []);

    expect(fakeSql.calls).toHaveLength(1);
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('DELETE FROM calendario_modulo');
  });
});
