// elementId: academic-key-dates-table, holidays-table, public-holidays-table,
// free-disposal-days-table, evaluations-table, feoe-project-days-table (business-logic side
// of UC-02..UC-07, see views/fechas-senaladas/use-cases.md). key_dates is a single, shared,
// global table — one service handles all six categories (see api-contracts.md's "one
// resource, not six").
import { describe, it, expect } from 'bun:test';
import { KeyDateService } from '../src/services/key-date.service';
import { DomainError } from '../src/errors/domain-error';
import type { KeyDate, KeyDateRepository } from '../src/repositories/key-date.repository';

function makeKeyDate(overrides: Partial<KeyDate> = {}): KeyDate {
  return {
    id: 'kd1',
    category: 'public_holidays',
    name: 'Fiesta Nacional de España.',
    startDay: 12,
    startMonth: 10,
    endDay: 12,
    endMonth: 10,
    type: 'Nacional',
    ...overrides,
  };
}

function fakeRepo(overrides: Partial<KeyDateRepository> = {}): KeyDateRepository {
  return {
    findAll: async (_category?: string) => [],
    findById: async (_id: string) => null,
    findByNaturalKey: async (_category: string, _name: string, _startDay: number, _startMonth: number) => null,
    create: async (data: Omit<KeyDate, 'id'>) => ({ id: 'new-id', ...data }),
    update: async (id: string, changes: Partial<Omit<KeyDate, 'id' | 'category'>>) => ({ ...makeKeyDate({ id }), ...changes }),
    delete: async (_id: string) => {},
    ...overrides,
  };
}

describe('elementId: academic-key-dates-table, holidays-table, public-holidays-table, free-disposal-days-table, evaluations-table, feoe-project-days-table', () => {
  it('list() with no category returns every row', async () => {
    const rows = [makeKeyDate({ id: 'a' }), makeKeyDate({ id: 'b', category: 'holidays' })];
    const service = new KeyDateService(fakeRepo({ findAll: async () => rows }));

    const result = await service.list();

    expect(result).toEqual(rows);
  });

  it('list(category) delegates the filter to the repository', async () => {
    const calls: (string | undefined)[] = [];
    const service = new KeyDateService(
      fakeRepo({
        findAll: async (category?: string) => {
          calls.push(category);
          return [];
        },
      }),
    );

    await service.list('holidays');

    expect(calls).toEqual(['holidays']);
  });

  it('create() persists a new row when no (category, name, startDay, startMonth) collision exists', async () => {
    const service = new KeyDateService(fakeRepo());

    const created = await service.create({
      category: 'holidays',
      name: 'Vacaciones de Navidad.',
      startDay: 22,
      startMonth: 12,
      endDay: 7,
      endMonth: 1,
      type: null,
    });

    expect(created.id).toBe('new-id');
    expect(created.name).toBe('Vacaciones de Navidad.');
  });

  it('create() throws DUPLICATE_NAME when (category, name, startDay, startMonth) already exists', async () => {
    const service = new KeyDateService(
      fakeRepo({ findByNaturalKey: async () => makeKeyDate({ id: 'existing' }) }),
    );

    await expect(
      service.create({
        category: 'public_holidays',
        name: 'Fiesta Nacional de España.',
        startDay: 12,
        startMonth: 10,
        endDay: 12,
        endMonth: 10,
        type: 'Nacional',
      }),
    ).rejects.toThrow(DomainError);
  });

  it('update() returns null when id doesn\'t match an existing row', async () => {
    const service = new KeyDateService(fakeRepo({ findById: async () => null }));

    const result = await service.update('unknown', { name: 'X' });

    expect(result).toBeNull();
  });

  it('update() renames a row when the new (name, startDay, startMonth) doesn\'t collide', async () => {
    const service = new KeyDateService(
      fakeRepo({
        findById: async () => makeKeyDate({ id: 'kd1' }),
        findByNaturalKey: async () => null,
      }),
    );

    const updated = await service.update('kd1', { name: 'Renombrado' });

    expect(updated?.name).toBe('Renombrado');
  });

  it('update() throws DUPLICATE_NAME when the change collides with a different row', async () => {
    const service = new KeyDateService(
      fakeRepo({
        findById: async () => makeKeyDate({ id: 'kd1' }),
        findByNaturalKey: async () => makeKeyDate({ id: 'kd2' }),
      }),
    );

    await expect(service.update('kd1', { name: 'Colisiona' })).rejects.toThrow(DomainError);
  });

  it('update() does not throw when the natural key collides with itself (unchanged fields)', async () => {
    const service = new KeyDateService(
      fakeRepo({
        findById: async () => makeKeyDate({ id: 'kd1' }),
        findByNaturalKey: async () => makeKeyDate({ id: 'kd1' }),
      }),
    );

    const updated = await service.update('kd1', { type: 'Autonómico' });

    expect(updated?.type).toBe('Autonómico');
  });

  it('delete() returns null when id doesn\'t match an existing row', async () => {
    const service = new KeyDateService(fakeRepo({ findById: async () => null }));

    const result = await service.delete('unknown');

    expect(result).toBeNull();
  });

  it('delete() removes the row unconditionally when it exists', async () => {
    const deleted: string[] = [];
    const service = new KeyDateService(
      fakeRepo({
        findById: async () => makeKeyDate({ id: 'kd1' }),
        delete: async (id: string) => {
          deleted.push(id);
        },
      }),
    );

    await service.delete('kd1');

    expect(deleted).toEqual(['kd1']);
  });
});
