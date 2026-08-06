// elementId: academic-year-table, academic-year-table-add-button,
// training-cycle-table-add-cycle-button, module-table, module-selection-save-button
// (business-logic side of UC-06/UC-07/UC-08/UC-09, see views/configuracion/use-cases.md).
// Real backend as of the 2026-08-05 redesign — academic_years/academic_year_modules are
// per-teacher, built on top of the shared, global catalog_cycles/catalog_modules (see
// views/configuracion/schema-changes.sql).
import { describe, it, expect } from 'bun:test';
import { AcademicYearService } from '../src/services/academic-year.service';
import { DomainError } from '../src/errors/domain-error';
import type { AcademicYear, AcademicYearRepository } from '../src/repositories/academic-year.repository';
import type {
  AcademicYearModuleDetail,
  AcademicYearModuleRef,
  AcademicYearModuleRepository,
} from '../src/repositories/academic-year-module.repository';
import type { CatalogModule, CatalogModuleRepository } from '../src/repositories/catalog-module.repository';

const TEACHER = 'teacher-1';

function makeYear(overrides: Partial<AcademicYear> = {}): AcademicYear {
  return { id: 'y1', teacherId: TEACHER, startYear: 2026, isCurrent: false, ...overrides };
}

function makeCatalogModule(overrides: Partial<CatalogModule> = {}): CatalogModule {
  return { id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación', ...overrides };
}

interface FakeRepos {
  academicYearRepository: AcademicYearRepository;
  academicYearModuleRepository: AcademicYearModuleRepository;
  catalogModuleRepository: CatalogModuleRepository;
}

function fakeRepos(overrides: Partial<{
  years: AcademicYear[];
  moduleDetails: AcademicYearModuleDetail[];
  moduleRefs: Record<string, AcademicYearModuleRef>;
  catalogModules: Record<string, CatalogModule>;
}> = {}): FakeRepos {
  const years = overrides.years ?? [];
  const moduleRefs = overrides.moduleRefs ?? {};
  const catalogModules = overrides.catalogModules ?? { m1: makeCatalogModule() };

  const academicYearRepository: AcademicYearRepository = {
    findAllForTeacher: async (teacherId: string) => years.filter((y) => y.teacherId === teacherId),
    findById: async (teacherId: string, id: string) => years.find((y) => y.id === id && y.teacherId === teacherId) ?? null,
    findByStartYear: async (teacherId: string, startYear: number) =>
      years.find((y) => y.teacherId === teacherId && y.startYear === startYear) ?? null,
    create: async (teacherId: string, startYear: number) => ({ id: 'new-year', teacherId, startYear, isCurrent: false }),
    rename: async (id: string, startYear: number) => ({ ...(years.find((y) => y.id === id) ?? makeYear()), startYear }),
    markCurrent: async (teacherId: string, id: string) => ({ ...(years.find((y) => y.id === id) ?? makeYear()), teacherId, isCurrent: true }),
    delete: async () => {},
  };

  const academicYearModuleRepository: AcademicYearModuleRepository = {
    findAllForYear: async () => overrides.moduleDetails ?? [],
    findById: async (id: string) => moduleRefs[id] ?? null,
    countForYear: async () => overrides.moduleDetails?.length ?? 0,
    createMany: async (_academicYearId: string, catalogModuleIds: string[]) => catalogModuleIds.length,
    delete: async () => {},
  };

  const catalogModuleRepository: CatalogModuleRepository = {
    findAllForCycle: async () => Object.values(catalogModules),
    findById: async (id: string) => catalogModules[id] ?? null,
    findByNameAndCourse: async () => null,
    create: async () => makeCatalogModule(),
    update: async () => makeCatalogModule(),
    delete: async () => {},
  };

  return { academicYearRepository, academicYearModuleRepository, catalogModuleRepository };
}

function makeService(repos: FakeRepos): AcademicYearService {
  return new AcademicYearService(repos.academicYearRepository, repos.academicYearModuleRepository, repos.catalogModuleRepository);
}

describe('elementId: academic-year-table', () => {
  it('list returns only the academic years owned by the given teacher', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1', teacherId: TEACHER }), makeYear({ id: 'y2', teacherId: 'other' })] });
    const service = makeService(repos);

    const years = await service.list(TEACHER);

    expect(years).toEqual([makeYear({ id: 'y1', teacherId: TEACHER })]);
  });

  it('update renames startYear when no conflict exists', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })] });
    const service = makeService(repos);

    const updated = await service.update(TEACHER, 'y1', { startYear: 2027 });

    expect(updated?.startYear).toBe(2027);
  });

  it('update throws DUPLICATE_NAME when the new startYear already exists for this teacher', async () => {
    const repos = fakeRepos({
      years: [makeYear({ id: 'y1', startYear: 2026 }), makeYear({ id: 'y2', startYear: 2027 })],
    });
    const service = makeService(repos);

    await expect(service.update(TEACHER, 'y1', { startYear: 2027 })).rejects.toThrow(DomainError);
  });

  it('update returns null when the id does not belong to this teacher', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1', teacherId: 'other' })] });
    const service = makeService(repos);

    const result = await service.update(TEACHER, 'y1', { startYear: 2030 });

    expect(result).toBeNull();
  });

  it('update marks the row current', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })] });
    const service = makeService(repos);

    const updated = await service.update(TEACHER, 'y1', { isCurrent: true });

    expect(updated?.isCurrent).toBe(true);
  });

  it('delete removes a year with no módulos assigned', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })], moduleDetails: [] });
    const service = makeService(repos);

    const result = await service.delete(TEACHER, 'y1');

    expect(result).toBeUndefined();
  });

  it('delete throws HAS_DEPENDENTS when the year still has módulos assigned', async () => {
    const repos = fakeRepos({
      years: [makeYear({ id: 'y1' })],
      moduleDetails: [
        { id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAW', course: 1, name: 'Programación' },
      ],
    });
    const service = makeService(repos);

    await expect(service.delete(TEACHER, 'y1')).rejects.toThrow(DomainError);
  });

  it('delete returns null when the id does not belong to this teacher', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1', teacherId: 'other' })] });
    const service = makeService(repos);

    const result = await service.delete(TEACHER, 'y1');

    expect(result).toBeNull();
  });
});

describe('elementId: module-table', () => {
  it('listModules returns the joined módulo details for a year owned by this teacher', async () => {
    const detail: AcademicYearModuleDetail = {
      id: 'am1',
      catalogModuleId: 'm1',
      catalogTrainingCycleId: 'c1',
      catalogTrainingCycleName: 'Desarrollo de Aplicaciones Web',
      course: 1,
      name: 'Programación',
    };
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })], moduleDetails: [detail] });
    const service = makeService(repos);

    const modules = await service.listModules(TEACHER, 'y1');

    expect(modules).toEqual([detail]);
  });

  it('listModules returns null when the year does not belong to this teacher', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1', teacherId: 'other' })] });
    const service = makeService(repos);

    const result = await service.listModules(TEACHER, 'y1');

    expect(result).toBeNull();
  });

  it('removeModule deletes the academic_year_modules row when owned by this teacher (via its year)', async () => {
    const repos = fakeRepos({
      years: [makeYear({ id: 'y1' })],
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
    });
    const service = makeService(repos);

    const result = await service.removeModule(TEACHER, 'am1');

    expect(result).toBeUndefined();
  });

  it('removeModule returns null when the academic_year_modules row does not exist', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })], moduleRefs: {} });
    const service = makeService(repos);

    const result = await service.removeModule(TEACHER, 'unknown');

    expect(result).toBeNull();
  });

  it("removeModule returns null when the row's year belongs to a different teacher", async () => {
    const repos = fakeRepos({
      years: [makeYear({ id: 'y1', teacherId: 'other' })],
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
    });
    const service = makeService(repos);

    const result = await service.removeModule(TEACHER, 'am1');

    expect(result).toBeNull();
  });
});

describe('elementId: academic-year-table-add-button, module-selection-save-button (new-year flow)', () => {
  it('createWithSelection creates the year and its módulos when startYear is unique and every moduleId exists', async () => {
    const repos = fakeRepos({ years: [], catalogModules: { m1: makeCatalogModule({ id: 'm1' }) } });
    const service = makeService(repos);

    const result = await service.createWithSelection(TEACHER, 2026, ['m1']);

    expect(result?.academicYear.startYear).toBe(2026);
    expect(result?.moduleCount).toBe(1);
  });

  it('createWithSelection allows an empty moduleIds array', async () => {
    const repos = fakeRepos({ years: [] });
    const service = makeService(repos);

    const result = await service.createWithSelection(TEACHER, 2026, []);

    expect(result?.moduleCount).toBe(0);
  });

  it('createWithSelection throws DUPLICATE_NAME when startYear already exists for this teacher', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1', startYear: 2026 })] });
    const service = makeService(repos);

    await expect(service.createWithSelection(TEACHER, 2026, [])).rejects.toThrow(DomainError);
  });

  it('createWithSelection returns null when some moduleId does not exist in the catalog', async () => {
    const repos = fakeRepos({ years: [], catalogModules: {} });
    const service = makeService(repos);

    const result = await service.createWithSelection(TEACHER, 2026, ['unknown-module']);

    expect(result).toBeNull();
  });
});

describe('elementId: training-cycle-table-add-cycle-button, module-selection-save-button (extend-existing flow)', () => {
  it('extendSelection adds the newly-checked módulos to an existing, owned academic year', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })], catalogModules: { m2: makeCatalogModule({ id: 'm2' }) } });
    const service = makeService(repos);

    const result = await service.extendSelection(TEACHER, 'y1', ['m2']);

    expect(result?.addedCount).toBe(1);
  });

  it('extendSelection returns null when the academic year does not belong to this teacher', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1', teacherId: 'other' })] });
    const service = makeService(repos);

    const result = await service.extendSelection(TEACHER, 'y1', ['m1']);

    expect(result).toBeNull();
  });

  it('extendSelection returns null when some moduleId does not exist in the catalog', async () => {
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })], catalogModules: {} });
    const service = makeService(repos);

    const result = await service.extendSelection(TEACHER, 'y1', ['unknown-module']);

    expect(result).toBeNull();
  });

  it('extendSelection never touches startYear or isCurrent', async () => {
    let renameCalled = false;
    const repos = fakeRepos({ years: [makeYear({ id: 'y1' })] });
    repos.academicYearRepository.rename = async (id: string, startYear: number) => {
      renameCalled = true;
      return makeYear({ id, startYear });
    };
    const service = makeService(repos);

    await service.extendSelection(TEACHER, 'y1', ['m1']);

    expect(renameCalled).toBe(false);
  });
});
