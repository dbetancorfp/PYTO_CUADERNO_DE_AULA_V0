// elementId: module-cycle-select, module-table, module-table-add-button,
// module-delete-blocked-message, module-edit-confirm-modal (business-logic side of UC-06,
// see views/configuracion/use-cases.md). New module, doesn't exist yet.
import { describe, it, expect } from 'bun:test';
import { ModuleService } from '../src/services/module.service';
import { DomainError } from '../src/errors/domain-error';
import type { Module, ModuleRepository } from '../src/repositories/module.repository';
import type { TrainingCycle, TrainingCycleRepository } from '../src/repositories/training-cycle.repository';

function moduleRepositoryDouble(overrides: Partial<ModuleRepository> = {}): ModuleRepository {
  return {
    findAllForCycle: async () => [],
    findAllForTeacher: async () => [],
    findById: async () => null,
    findByNameAndCourse: async () => null,
    create: async (trainingCycleId, course, name) => ({ id: 'module-1', trainingCycleId, course, name }),
    update: async (id, changes) => ({ id, trainingCycleId: 'cycle-1', course: 1, name: 'Módulo', ...changes }),
    delete: async () => {},
    findReferencingAcademicYears: async () => [],
    ...overrides,
  };
}

function cycleRepositoryDouble(overrides: Partial<TrainingCycleRepository> = {}): TrainingCycleRepository {
  return {
    findAllForTeacher: async () => [],
    findById: async (teacherId, id) => ({ id, teacherId, name: 'DAW' }),
    findByName: async () => null,
    create: async (teacherId, name) => ({ id: 'cycle-1', teacherId, name }),
    rename: async (id, name) => ({ id, teacherId: 'teacher-1', name }),
    delete: async () => {},
    findReferencingAcademicYears: async () => [],
    ...overrides,
  };
}

describe('ModuleService — create', () => {
  it('creates a module under a cycle owned by the teacher', async () => {
    const service = new ModuleService(moduleRepositoryDouble(), cycleRepositoryDouble());

    const result = await service.create('teacher-1', 'cycle-1', 'Programación', 1);

    expect(result).toEqual({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' });
  });

  it('returns null when the cycle does not belong to this teacher', async () => {
    const service = new ModuleService(
      moduleRepositoryDouble(),
      cycleRepositoryDouble({ findById: async () => null }),
    );

    expect(await service.create('teacher-1', 'unknown-cycle', 'Programación', 1)).toBeNull();
  });

  it('throws DomainError(DUPLICATE_NAME) for a (name, course) already used in this cycle', async () => {
    let createCalled = false;
    const service = new ModuleService(
      moduleRepositoryDouble({
        findByNameAndCourse: async () => ({ id: 'existing', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' }),
        create: async (trainingCycleId, course, name) => {
          createCalled = true;
          return { id: 'x', trainingCycleId, course, name };
        },
      }),
      cycleRepositoryDouble(),
    );

    await expect(service.create('teacher-1', 'cycle-1', 'Programación', 1)).rejects.toThrow(DomainError);
    expect(createCalled).toBe(false);
  });
});

describe('ModuleService — update (rename/change course)', () => {
  it('saves immediately when the module has no references', async () => {
    const calls: { updatedWith: [string, Partial<Module>] | null } = { updatedWith: null };
    const service = new ModuleService(
      moduleRepositoryDouble({
        findById: async () => ({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' }),
        findReferencingAcademicYears: async () => [],
        update: async (id, changes) => {
          calls.updatedWith = [id, changes];
          return { id, trainingCycleId: 'cycle-1', course: 1, name: 'Programación', ...changes };
        },
      }),
      cycleRepositoryDouble(),
    );

    const result = await service.update('teacher-1', 'module-1', { name: 'Programación II' }, false);

    expect(result).toEqual({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación II' });
    expect(calls.updatedWith).toEqual(['module-1', { name: 'Programación II' }]);
  });

  it('throws DomainError(HAS_DEPENDENTS) naming referencing academic years when referenced and confirm is not true, without saving', async () => {
    let updateCalled = false;
    const service = new ModuleService(
      moduleRepositoryDouble({
        findById: async () => ({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' }),
        findReferencingAcademicYears: async () => [{ id: 'ay1', name: '2026/2027' }],
        update: async () => {
          updateCalled = true;
          return { id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación II' };
        },
      }),
      cycleRepositoryDouble(),
    );
    let caught: unknown = null;

    try {
      await service.update('teacher-1', 'module-1', { name: 'Programación II' }, false);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe('HAS_DEPENDENTS');
    expect((caught as DomainError).details).toEqual({ academicYears: [{ id: 'ay1', name: '2026/2027' }] });
    expect(updateCalled).toBe(false);
  });

  it('saves when referenced but confirm is true', async () => {
    let updateCalled = false;
    const service = new ModuleService(
      moduleRepositoryDouble({
        findById: async () => ({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' }),
        findReferencingAcademicYears: async () => [{ id: 'ay1', name: '2026/2027' }],
        update: async (id, changes) => {
          updateCalled = true;
          return { id, trainingCycleId: 'cycle-1', course: 1, name: 'Programación', ...changes };
        },
      }),
      cycleRepositoryDouble(),
    );

    await service.update('teacher-1', 'module-1', { name: 'Programación II' }, true);

    expect(updateCalled).toBe(true);
  });

  it('returns null when the module does not belong to this teacher (or does not exist)', async () => {
    const service = new ModuleService(
      moduleRepositoryDouble({ findById: async () => null }),
      cycleRepositoryDouble(),
    );

    expect(await service.update('teacher-1', 'unknown-module', { name: 'X' }, false)).toBeNull();
  });

  it('throws DomainError(DUPLICATE_NAME) for a (name, course) collision with a different module', async () => {
    const service = new ModuleService(
      moduleRepositoryDouble({
        findById: async () => ({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' }),
        findByNameAndCourse: async () => ({ id: 'other-module', trainingCycleId: 'cycle-1', course: 1, name: 'Bases de Datos' }),
      }),
      cycleRepositoryDouble(),
    );

    await expect(service.update('teacher-1', 'module-1', { name: 'Bases de Datos' }, false)).rejects.toThrow(
      DomainError,
    );
  });
});

describe('ModuleService — delete', () => {
  it('deletes an unreferenced module', async () => {
    const calls: { deletedId: string | null } = { deletedId: null };
    const service = new ModuleService(
      moduleRepositoryDouble({
        findById: async () => ({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' }),
        findReferencingAcademicYears: async () => [],
        delete: async (id) => {
          calls.deletedId = id;
        },
      }),
      cycleRepositoryDouble(),
    );

    await service.delete('teacher-1', 'module-1');

    expect(calls.deletedId).toBe('module-1');
  });

  it('throws DomainError(HAS_DEPENDENTS) naming referencing academic years, without deleting', async () => {
    let deleteCalled = false;
    const service = new ModuleService(
      moduleRepositoryDouble({
        findById: async () => ({ id: 'module-1', trainingCycleId: 'cycle-1', course: 1, name: 'Programación' }),
        findReferencingAcademicYears: async () => [{ id: 'ay1', name: '2026/2027' }],
        delete: async () => {
          deleteCalled = true;
        },
      }),
      cycleRepositoryDouble(),
    );

    await expect(service.delete('teacher-1', 'module-1')).rejects.toThrow(DomainError);
    expect(deleteCalled).toBe(false);
  });

  it('returns null when the module does not belong to this teacher (or does not exist)', async () => {
    const service = new ModuleService(
      moduleRepositoryDouble({ findById: async () => null }),
      cycleRepositoryDouble(),
    );

    expect(await service.delete('teacher-1', 'unknown-module')).toBeNull();
  });
});

describe('ModuleService — listForTeacher', () => {
  it('returns every module across every one of the teacher\'s cycles', async () => {
    const modules = [
      { id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación', trainingCycleName: 'DAW' },
    ];
    const service = new ModuleService(
      moduleRepositoryDouble({ findAllForTeacher: async () => modules }),
      cycleRepositoryDouble(),
    );

    expect(await service.listForTeacher('teacher-1')).toEqual(modules);
  });
});
