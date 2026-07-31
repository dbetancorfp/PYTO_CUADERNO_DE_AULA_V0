// elementId: academic-year-table, academic-year-table-add-button,
// academic-year-delete-blocked-message, module-selection-table, module-selection-save-button
// (business-logic side of UC-04/UC-07, see views/configuracion/use-cases.md). New module,
// doesn't exist yet.
import { describe, it, expect } from 'bun:test';
import { AcademicYearService } from '../src/services/academic-year.service';
import { DomainError } from '../src/errors/domain-error';
import type { AcademicYear, AcademicYearRepository } from '../src/repositories/academic-year.repository';
import type { AcademicYearModuleRepository } from '../src/repositories/academic-year-module.repository';
import type { Module, ModuleRepository } from '../src/repositories/module.repository';

function yearRepositoryDouble(overrides: Partial<AcademicYearRepository> = {}): AcademicYearRepository {
  return {
    findAllForTeacher: async () => [],
    findById: async () => null,
    findByName: async () => null,
    create: async (teacherId, name) => ({ id: 'year-1', teacherId, name, isCurrent: false }),
    rename: async (id, name) => ({ id, teacherId: 'teacher-1', name, isCurrent: false }),
    setCurrent: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: true }),
    delete: async () => {},
    ...overrides,
  };
}

function selectionRepositoryDouble(overrides: Partial<AcademicYearModuleRepository> = {}): AcademicYearModuleRepository {
  return {
    findModuleIdsForYear: async () => [],
    replaceSelection: async () => {},
    ...overrides,
  };
}

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

describe('AcademicYearService — create', () => {
  it('creates a year, never current on creation', async () => {
    const service = new AcademicYearService(yearRepositoryDouble(), selectionRepositoryDouble(), moduleRepositoryDouble());

    const result = await service.create('teacher-1', '2026/2027');

    expect(result).toEqual({ id: 'year-1', teacherId: 'teacher-1', name: '2026/2027', isCurrent: false });
  });

  it('throws DomainError(DUPLICATE_NAME) for a name already used by this teacher', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({ findByName: async () => ({ id: 'existing', teacherId: 'teacher-1', name: '2026/2027', isCurrent: false }) }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    await expect(service.create('teacher-1', '2026/2027')).rejects.toThrow(DomainError);
  });
});

describe('AcademicYearService — rename', () => {
  it('renames when the year exists and the new name is free', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }),
        findByName: async () => null,
        rename: async (id, name) => ({ id, teacherId: 'teacher-1', name, isCurrent: false }),
      }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    const result = await service.rename('teacher-1', 'year-1', '2026/2027 Renamed');

    expect(result).toEqual({ id: 'year-1', teacherId: 'teacher-1', name: '2026/2027 Renamed', isCurrent: false });
  });

  it('returns null when the year does not belong to this teacher (or does not exist)', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async () => null }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    expect(await service.rename('teacher-1', 'unknown-year', '2026/2027')).toBeNull();
  });

  it('throws DomainError(DUPLICATE_NAME) when renaming to a name already used by a different year', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }),
        findByName: async () => ({ id: 'other-year', teacherId: 'teacher-1', name: '2027/2028', isCurrent: false }),
      }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    await expect(service.rename('teacher-1', 'year-1', '2027/2028')).rejects.toThrow(DomainError);
  });

  it('does not throw when renaming a year to the name it already has', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }),
        findByName: async () => ({ id: 'year-1', teacherId: 'teacher-1', name: '2026/2027', isCurrent: false }),
        rename: async (id, name) => ({ id, teacherId: 'teacher-1', name, isCurrent: false }),
      }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    await expect(service.rename('teacher-1', 'year-1', '2026/2027')).resolves.toEqual({
      id: 'year-1',
      teacherId: 'teacher-1',
      name: '2026/2027',
      isCurrent: false,
    });
  });
});

describe('AcademicYearService — setCurrent', () => {
  it('marks the given year current', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    const result = await service.setCurrent('teacher-1', 'year-1');

    expect(result?.isCurrent).toBe(true);
  });

  it('returns null when the year does not belong to this teacher', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async () => null }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    expect(await service.setCurrent('teacher-1', 'unknown-year')).toBeNull();
  });
});

describe('AcademicYearService — delete', () => {
  it('deletes a year that is not current', async () => {
    const calls: { deletedId: string | null } = { deletedId: null };
    const service = new AcademicYearService(
      yearRepositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }),
        delete: async (id) => {
          calls.deletedId = id;
        },
      }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    await service.delete('teacher-1', 'year-1');

    expect(calls.deletedId).toBe('year-1');
  });

  it('throws DomainError(IS_CURRENT) for the year marked current, without deleting', async () => {
    let deleteCalled = false;
    const service = new AcademicYearService(
      yearRepositoryDouble({
        findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: true }),
        delete: async () => {
          deleteCalled = true;
        },
      }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );
    let caught: unknown = null;

    try {
      await service.delete('teacher-1', 'year-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe('IS_CURRENT');
    expect(deleteCalled).toBe(false);
  });

  it('returns null when the year does not belong to this teacher', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async () => null }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    expect(await service.delete('teacher-1', 'unknown-year')).toBeNull();
  });
});

describe('AcademicYearService — module selection', () => {
  it('getSelection returns the module ids selected for the year', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
      selectionRepositoryDouble({ findModuleIdsForYear: async () => ['m1', 'm2'] }),
      moduleRepositoryDouble(),
    );

    expect(await service.getSelection('teacher-1', 'year-1')).toEqual(['m1', 'm2']);
  });

  it('getSelection returns null when the year does not belong to this teacher', async () => {
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async () => null }),
      selectionRepositoryDouble(),
      moduleRepositoryDouble(),
    );

    expect(await service.getSelection('teacher-1', 'unknown-year')).toBeNull();
  });

  it('replaceSelection persists exactly the submitted module ids, all owned by the teacher', async () => {
    const teacherModules: Module[] = [
      { id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' },
      { id: 'm2', trainingCycleId: 'c1', course: 2, name: 'Bases de Datos' },
    ];
    const calls: { replacedWith: [string, string[]] | null } = { replacedWith: null };
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
      selectionRepositoryDouble({
        replaceSelection: async (yearId, moduleIds) => {
          calls.replacedWith = [yearId, moduleIds];
        },
      }),
      moduleRepositoryDouble({ findAllForTeacher: async () => teacherModules as never }),
    );

    await service.replaceSelection('teacher-1', 'year-1', ['m1', 'm2']);

    expect(calls.replacedWith).toEqual(['year-1', ['m1', 'm2']]);
  });

  it('replaceSelection returns null when one of the submitted module ids is not owned by the teacher', async () => {
    const teacherModules: Module[] = [{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }];
    let replaceCalled = false;
    const service = new AcademicYearService(
      yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
      selectionRepositoryDouble({
        replaceSelection: async () => {
          replaceCalled = true;
        },
      }),
      moduleRepositoryDouble({ findAllForTeacher: async () => teacherModules as never }),
    );

    const result = await service.replaceSelection('teacher-1', 'year-1', ['m1', 'not-owned-by-teacher']);

    expect(result).toBeNull();
    expect(replaceCalled).toBe(false);
  });
});

// three-mode Año académico redesign (2026-07-30 reopen, see views/configuracion/use-cases.md
// UC-04/UC-05): normal mode's training-cycle-table and module-table are always derived from
// the selected year's module selection, never a stored cycle<->year relation — these two
// methods are that derivation, reused by both new GET endpoints in api-contracts.md.
describe('AcademicYearService — cascading lists for normal mode (UC-04, UC-05)', () => {
  type ModuleWithCycleName = Module & { trainingCycleName: string };

  const teacherModulesWithCycleName: ModuleWithCycleName[] = [
    { id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación', trainingCycleName: 'DAW' },
    { id: 'm2', trainingCycleId: 'c1', course: 2, name: 'Bases de Datos', trainingCycleName: 'DAW' },
    { id: 'm3', trainingCycleId: 'c2', course: 1, name: 'Redes', trainingCycleName: 'SMR' },
  ];

  describe('listSelectedTrainingCycles', () => {
    it('returns only the cycles with at least one module selected for the year', async () => {
      const service = new AcademicYearService(
        yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
        selectionRepositoryDouble({ findModuleIdsForYear: async () => ['m1'] }),
        moduleRepositoryDouble({ findAllForTeacher: async () => teacherModulesWithCycleName as never }),
      );

      const result = await service.listSelectedTrainingCycles('teacher-1', 'year-1');

      expect(result).toEqual([{ id: 'c1', name: 'DAW' }]);
    });

    it('deduplicates a cycle appearing via more than one selected module', async () => {
      const service = new AcademicYearService(
        yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
        selectionRepositoryDouble({ findModuleIdsForYear: async () => ['m1', 'm2'] }),
        moduleRepositoryDouble({ findAllForTeacher: async () => teacherModulesWithCycleName as never }),
      );

      const result = await service.listSelectedTrainingCycles('teacher-1', 'year-1');

      expect(result).toEqual([{ id: 'c1', name: 'DAW' }]);
    });

    it('returns an empty list when nothing is selected for the year', async () => {
      const service = new AcademicYearService(
        yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
        selectionRepositoryDouble({ findModuleIdsForYear: async () => [] }),
        moduleRepositoryDouble({ findAllForTeacher: async () => teacherModulesWithCycleName as never }),
      );

      expect(await service.listSelectedTrainingCycles('teacher-1', 'year-1')).toEqual([]);
    });

    it('returns null when the year does not belong to this teacher', async () => {
      const service = new AcademicYearService(
        yearRepositoryDouble({ findById: async () => null }),
        selectionRepositoryDouble(),
        moduleRepositoryDouble(),
      );

      expect(await service.listSelectedTrainingCycles('teacher-1', 'unknown-year')).toBeNull();
    });
  });

  describe('listSelectedModulesForCycle', () => {
    it("returns the given cycle's modules that are selected for the year, cycle name omitted", async () => {
      const service = new AcademicYearService(
        yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
        selectionRepositoryDouble({ findModuleIdsForYear: async () => ['m1', 'm3'] }),
        moduleRepositoryDouble({ findAllForTeacher: async () => teacherModulesWithCycleName as never }),
      );

      const result = await service.listSelectedModulesForCycle('teacher-1', 'year-1', 'c1');

      expect(result).toEqual([{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }]);
    });

    it('excludes modules of the cycle that are not selected for the year', async () => {
      const service = new AcademicYearService(
        yearRepositoryDouble({ findById: async (teacherId, id) => ({ id, teacherId, name: '2026/2027', isCurrent: false }) }),
        selectionRepositoryDouble({ findModuleIdsForYear: async () => ['m1'] }),
        moduleRepositoryDouble({ findAllForTeacher: async () => teacherModulesWithCycleName as never }),
      );

      const result = await service.listSelectedModulesForCycle('teacher-1', 'year-1', 'c1');

      expect(result).toEqual([{ id: 'm1', trainingCycleId: 'c1', course: 1, name: 'Programación' }]);
      expect(result?.some((module: Module) => module.id === 'm2')).toBe(false);
    });

    it('returns null when the year does not belong to this teacher', async () => {
      const service = new AcademicYearService(
        yearRepositoryDouble({ findById: async () => null }),
        selectionRepositoryDouble(),
        moduleRepositoryDouble(),
      );

      expect(await service.listSelectedModulesForCycle('teacher-1', 'unknown-year', 'c1')).toBeNull();
    });
  });
});
