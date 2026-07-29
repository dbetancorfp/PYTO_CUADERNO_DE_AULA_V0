// elementId: training-cycle-table, training-cycle-table-add-button,
// training-cycle-delete-blocked-message (business-logic side of UC-05, see
// views/configuracion/use-cases.md). New module, doesn't exist yet.
import { describe, it, expect } from 'bun:test';
import { TrainingCycleService } from '../src/services/training-cycle.service';
import { DomainError } from '../src/errors/domain-error';
import type { TrainingCycle, TrainingCycleRepository } from '../src/repositories/training-cycle.repository';

function repositoryDouble(overrides: Partial<TrainingCycleRepository> = {}): TrainingCycleRepository {
  return {
    findAllForTeacher: async () => [],
    findById: async () => null,
    findByName: async () => null,
    create: async (teacherId, name) => ({ id: 'cycle-1', teacherId, name }),
    rename: async (id, name) => ({ id, teacherId: 'teacher-1', name }),
    delete: async () => {},
    findReferencingAcademicYears: async () => [],
    ...overrides,
  };
}

describe('TrainingCycleService — list', () => {
  it('returns every training cycle for the given teacher', async () => {
    const cycles: TrainingCycle[] = [{ id: 'c1', teacherId: 'teacher-1', name: 'DAW' }];
    const service = new TrainingCycleService(repositoryDouble({ findAllForTeacher: async () => cycles }));

    expect(await service.list('teacher-1')).toEqual(cycles);
  });
});

describe('TrainingCycleService — create', () => {
  it('creates a cycle when the name is not already taken', async () => {
    const calls: { createdWith: [string, string] | null } = { createdWith: null };
    const service = new TrainingCycleService(
      repositoryDouble({
        findByName: async () => null,
        create: async (teacherId, name) => {
          calls.createdWith = [teacherId, name];
          return { id: 'cycle-1', teacherId, name };
        },
      }),
    );

    const result = await service.create('teacher-1', 'DAW');

    expect(result).toEqual({ id: 'cycle-1', teacherId: 'teacher-1', name: 'DAW' });
    expect(calls.createdWith).toEqual(['teacher-1', 'DAW']);
  });

  it('throws DomainError(DUPLICATE_NAME) when the name already exists for this teacher, without creating', async () => {
    let createCalled = false;
    const service = new TrainingCycleService(
      repositoryDouble({
        findByName: async () => ({ id: 'existing', teacherId: 'teacher-1', name: 'DAW' }),
        create: async () => {
          createCalled = true;
          return { id: 'x', teacherId: 'teacher-1', name: 'DAW' };
        },
      }),
    );

    await expect(service.create('teacher-1', 'DAW')).rejects.toThrow(DomainError);
    expect(createCalled).toBe(false);
  });
});

describe('TrainingCycleService — rename', () => {
  it('renames when the cycle exists and the new name is free', async () => {
    const service = new TrainingCycleService(
      repositoryDouble({
        findById: async (teacherId, id) => (id === 'cycle-1' ? { id, teacherId, name: 'DAW' } : null),
        findByName: async () => null,
        rename: async (id, name) => ({ id, teacherId: 'teacher-1', name }),
      }),
    );

    const result = await service.rename('teacher-1', 'cycle-1', 'DAW Renamed');

    expect(result).toEqual({ id: 'cycle-1', teacherId: 'teacher-1', name: 'DAW Renamed' });
  });

  it('returns null when the cycle does not belong to this teacher (or does not exist)', async () => {
    const service = new TrainingCycleService(repositoryDouble({ findById: async () => null }));

    expect(await service.rename('teacher-1', 'unknown-cycle', 'DAW')).toBeNull();
  });

  it('throws DomainError(DUPLICATE_NAME) when renaming to a name already used by a different cycle', async () => {
    const service = new TrainingCycleService(
      repositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: 'DAW' }),
        findByName: async () => ({ id: 'other-cycle', teacherId: 'teacher-1', name: 'SMR' }),
      }),
    );

    await expect(service.rename('teacher-1', 'cycle-1', 'SMR')).rejects.toThrow(DomainError);
  });

  it('does not throw when renaming a cycle to the name it already has', async () => {
    const service = new TrainingCycleService(
      repositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: 'DAW' }),
        findByName: async () => ({ id: 'cycle-1', teacherId: 'teacher-1', name: 'DAW' }),
        rename: async (id, name) => ({ id, teacherId: 'teacher-1', name }),
      }),
    );

    await expect(service.rename('teacher-1', 'cycle-1', 'DAW')).resolves.toEqual({
      id: 'cycle-1',
      teacherId: 'teacher-1',
      name: 'DAW',
    });
  });
});

describe('TrainingCycleService — delete', () => {
  it('deletes a cycle with no modules referenced by any academic year', async () => {
    const calls: { deletedId: string | null } = { deletedId: null };
    const service = new TrainingCycleService(
      repositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: 'DAW' }),
        findReferencingAcademicYears: async () => [],
        delete: async (id) => {
          calls.deletedId = id;
        },
      }),
    );

    await service.delete('teacher-1', 'cycle-1');

    expect(calls.deletedId).toBe('cycle-1');
  });

  it('returns null when the cycle does not belong to this teacher (or does not exist)', async () => {
    const service = new TrainingCycleService(repositoryDouble({ findById: async () => null }));

    expect(await service.delete('teacher-1', 'unknown-cycle')).toBeNull();
  });

  it('throws DomainError(HAS_DEPENDENTS) naming the referencing academic years, without deleting', async () => {
    let deleteCalled = false;
    const service = new TrainingCycleService(
      repositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: 'DAW' }),
        findReferencingAcademicYears: async () => [{ id: 'ay1', name: '2026/2027' }],
        delete: async () => {
          deleteCalled = true;
        },
      }),
    );
    let caught: unknown = null;

    try {
      await service.delete('teacher-1', 'cycle-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe('HAS_DEPENDENTS');
    expect((caught as DomainError).details).toEqual({ academicYears: [{ id: 'ay1', name: '2026/2027' }] });
    expect(deleteCalled).toBe(false);
  });
});
