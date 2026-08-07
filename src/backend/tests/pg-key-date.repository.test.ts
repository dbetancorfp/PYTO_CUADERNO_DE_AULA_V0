// elementId: academic-key-dates-table, holidays-table, public-holidays-table,
// free-disposal-days-table, evaluations-table, feoe-project-days-table (backend
// infrastructure — see views/fechas-senaladas/schema-changes.sql and api-contracts.md).
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgKeyDateRepository } from '../src/repositories/postgres/pg-key-date.repository';

const ROW = {
  id: 'kd1',
  category: 'public_holidays',
  name: 'Fiesta Nacional de España.',
  start_day: 12,
  start_month: 10,
  end_day: 12,
  end_month: 10,
  type: 'Nacional',
};

const DOMAIN = {
  id: 'kd1',
  category: 'public_holidays',
  name: 'Fiesta Nacional de España.',
  startDay: 12,
  startMonth: 10,
  endDay: 12,
  endMonth: 10,
  type: 'Nacional',
};

describe('PgKeyDateRepository', () => {
  it('findAll maps every returned row to the domain KeyDate shape', async () => {
    const fakeSql = createFakeSql([[ROW]]);
    const repo = new PgKeyDateRepository(fakeSql);

    const rows = await repo.findAll();

    expect(rows).toEqual([DOMAIN]);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM key_dates');
  });

  it('findAll(category) filters by category', async () => {
    const fakeSql = createFakeSql([[ROW]]);
    const repo = new PgKeyDateRepository(fakeSql);

    await repo.findAll('public_holidays');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('category');
    expect(fakeSql.calls[0].values).toContain('public_holidays');
  });

  it('findAll maps a null type row to type: null', async () => {
    const fakeSql = createFakeSql([[{ ...ROW, type: null }]]);
    const repo = new PgKeyDateRepository(fakeSql);

    const rows = await repo.findAll();

    expect(rows[0]!.type).toBeNull();
  });

  it('findById returns null when no row matches', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgKeyDateRepository(fakeSql);

    const result = await repo.findById('unknown');

    expect(result).toBeNull();
  });

  it('findById maps the returned row to the domain shape', async () => {
    const fakeSql = createFakeSql([[ROW]]);
    const repo = new PgKeyDateRepository(fakeSql);

    const result = await repo.findById('kd1');

    expect(result).toEqual(DOMAIN);
  });

  it('findByNaturalKey returns null when no row matches', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgKeyDateRepository(fakeSql);

    const result = await repo.findByNaturalKey('public_holidays', 'X', 1, 1);

    expect(result).toBeNull();
  });

  it('findByNaturalKey queries by category, name, start_day, start_month', async () => {
    const fakeSql = createFakeSql([[ROW]]);
    const repo = new PgKeyDateRepository(fakeSql);

    await repo.findByNaturalKey('public_holidays', 'Fiesta Nacional de España.', 12, 10);

    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('FROM key_dates');
    expect(fakeSql.calls[0].values).toEqual(['public_holidays', 'Fiesta Nacional de España.', 12, 10]);
  });

  it('create inserts and returns the created row', async () => {
    const fakeSql = createFakeSql([[ROW]]);
    const repo = new PgKeyDateRepository(fakeSql);

    const created = await repo.create({
      category: 'public_holidays',
      name: 'Fiesta Nacional de España.',
      startDay: 12,
      startMonth: 10,
      endDay: 12,
      endMonth: 10,
      type: 'Nacional',
    });

    expect(created).toEqual(DOMAIN);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('INSERT INTO key_dates');
  });

  it('update sends an UPDATE for the given id and returns the updated row', async () => {
    const fakeSql = createFakeSql([[{ ...ROW, name: 'Renombrada' }]]);
    const repo = new PgKeyDateRepository(fakeSql);

    const updated = await repo.update('kd1', { name: 'Renombrada' });

    expect(updated.name).toBe('Renombrada');
    expect(sqlTextOf(fakeSql.calls[0])).toContain('UPDATE key_dates');
  });

  it('delete sends a DELETE for the given id', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgKeyDateRepository(fakeSql);

    await repo.delete('kd1');

    expect(sqlTextOf(fakeSql.calls[0])).toContain('DELETE FROM key_dates');
    expect(fakeSql.calls[0].values).toEqual(['kd1']);
  });
});
