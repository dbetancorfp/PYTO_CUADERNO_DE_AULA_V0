// elementId: calendario-months, calendario-empty-state (business-logic side of UC-04/
// UC-06/UC-07, see views/calendario/use-cases.md). CalendarioModuloService owns both
// sides of calendario_modulo: seeding it from key_dates when a módulo is assigned
// (seedForModules, called by AcademicYearService — see academic-year.service.test.ts's
// "calendario_modulo snapshot" describe block) and reading it back, ownership-checked, for
// the Calendario view's GET /api/calendario-modulo (findForTeacher).
import { describe, it, expect } from 'bun:test';
import { CalendarioModuloService } from '../src/services/calendario-modulo.service';
import type { CalendarioModuloEntry, CalendarioModuloInsert, CalendarioModuloRepository } from '../src/repositories/calendario-modulo.repository';
import type { KeyDate, KeyDateRepository } from '../src/repositories/key-date.repository';
import type { AcademicYear, AcademicYearRepository } from '../src/repositories/academic-year.repository';
import type { AcademicYearModuleDetail, AcademicYearModuleRef, AcademicYearModuleRepository } from '../src/repositories/academic-year-module.repository';

const TEACHER = 'teacher-1';

function makeKeyDate(overrides: Partial<KeyDate> = {}): KeyDate {
  return {
    id: 'kd1',
    category: 'holidays',
    name: 'Vacaciones de Navidad.',
    startDay: 22,
    startMonth: 12,
    endDay: 7,
    endMonth: 1,
    type: null,
    ...overrides,
  };
}

function makeModule(overrides: Partial<AcademicYearModuleDetail> = {}): AcademicYearModuleDetail {
  return {
    id: 'am1',
    catalogModuleId: 'm1',
    catalogTrainingCycleId: 'c1',
    catalogTrainingCycleName: 'DAW',
    course: 1,
    name: 'Programación',
    ...overrides,
  };
}

interface FakeDeps {
  calendarioModuloRepository: CalendarioModuloRepository;
  keyDateRepository: KeyDateRepository;
  academicYearModuleRepository: AcademicYearModuleRepository;
  academicYearRepository: AcademicYearRepository;
  createManyCalls: CalendarioModuloInsert[][];
}

function fakeDeps(overrides: Partial<{
  keyDates: KeyDate[];
  entries: CalendarioModuloEntry[];
  moduleRefs: Record<string, AcademicYearModuleRef>;
  years: AcademicYear[];
}> = {}): FakeDeps {
  const createManyCalls: CalendarioModuloInsert[][] = [];
  const moduleRefs = overrides.moduleRefs ?? {};
  const years = overrides.years ?? [];

  const calendarioModuloRepository: CalendarioModuloRepository = {
    findAllForAcademicYearModule: async () => overrides.entries ?? [],
    createMany: async (entries: CalendarioModuloInsert[]) => {
      createManyCalls.push(entries);
    },
  };

  const keyDateRepository: KeyDateRepository = {
    findAll: async () => overrides.keyDates ?? [],
    findById: async () => null,
    findByNaturalKey: async () => null,
    create: async () => makeKeyDate(),
    update: async () => makeKeyDate(),
    delete: async () => {},
  };

  const academicYearModuleRepository: AcademicYearModuleRepository = {
    findAllForYear: async () => [],
    findById: async (id: string) => moduleRefs[id] ?? null,
    countForYear: async () => 0,
    createMany: async (_id: string, ids: string[]) => ids.length,
    delete: async () => {},
    existsForCatalogModule: async () => false,
    existsForCatalogCycle: async () => false,
  };

  const academicYearRepository: AcademicYearRepository = {
    findAllForTeacher: async (teacherId: string) => years.filter((y) => y.teacherId === teacherId),
    findById: async (teacherId: string, id: string) => years.find((y) => y.id === id && y.teacherId === teacherId) ?? null,
    findByStartYear: async () => null,
    create: async (teacherId: string, startYear: number) => ({ id: 'new-year', teacherId, startYear, isCurrent: false }),
    rename: async (id: string, startYear: number) => ({ id, teacherId: TEACHER, startYear, isCurrent: false }),
    markCurrent: async (id: string) => ({ id, teacherId: TEACHER, startYear: 2026, isCurrent: true }),
    delete: async () => {},
  };

  return { calendarioModuloRepository, keyDateRepository, academicYearModuleRepository, academicYearRepository, createManyCalls };
}

function makeService(deps: FakeDeps): CalendarioModuloService {
  return new CalendarioModuloService(
    deps.calendarioModuloRepository,
    deps.keyDateRepository,
    deps.academicYearModuleRepository,
    deps.academicYearRepository,
  );
}

describe('elementId: calendario-months (seeding — UC-06)', () => {
  it('seedForModules resolves a Sept-Dec entry to the academic year´s startYear', async () => {
    const deps = fakeDeps({ keyDates: [makeKeyDate({ category: 'public_holidays', name: 'Día de Canarias.', startDay: 30, startMonth: 5, endDay: 30, endMonth: 5 })] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    expect(deps.createManyCalls[0]![0]).toMatchObject({
      academicYearModuleId: 'am1',
      category: 'public_holidays',
      name: 'Día de Canarias.',
      startDate: '2027-05-30',
      endDate: '2027-05-30',
    });
  });

  it('seedForModules resolves a Sept-Dec entry to startYear, not startYear+1', async () => {
    const deps = fakeDeps({ keyDates: [makeKeyDate({ startDay: 12, startMonth: 10, endDay: 12, endMonth: 10, category: 'public_holidays' })] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    expect(deps.createManyCalls[0]![0]).toMatchObject({ startDate: '2026-10-12', endDate: '2026-10-12' });
  });

  it('seedForModules resolves a range spanning the Dec/Jan boundary across two calendar years', async () => {
    const deps = fakeDeps({ keyDates: [makeKeyDate({ startDay: 22, startMonth: 12, endDay: 7, endMonth: 1 })] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    expect(deps.createManyCalls[0]![0]).toMatchObject({ startDate: '2026-12-22', endDate: '2027-01-07' });
  });

  it('seedForModules seeds every key_dates entry for every módulo passed in', async () => {
    const deps = fakeDeps({
      keyDates: [makeKeyDate({ id: 'kd1' }), makeKeyDate({ id: 'kd2', category: 'evaluations', name: 'Evaluación', startDay: 1, startMonth: 3, endDay: 1, endMonth: 3 })],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' }), makeModule({ id: 'am2' })], 2026);

    const allInserted = deps.createManyCalls.flat();
    expect(allInserted).toHaveLength(4);
    expect(allInserted.filter((e) => e.academicYearModuleId === 'am1')).toHaveLength(2);
    expect(allInserted.filter((e) => e.academicYearModuleId === 'am2')).toHaveLength(2);
  });

  it('seedForModules does nothing when modules is empty', async () => {
    const deps = fakeDeps({ keyDates: [makeKeyDate()] });
    const service = makeService(deps);

    await service.seedForModules([], 2026);

    expect(deps.createManyCalls.flat()).toHaveLength(0);
  });
});

describe('elementId: calendario-months, calendario-empty-state (reading — UC-04)', () => {
  it('findForTeacher returns the entries when the academic_year_module is owned by the teacher', async () => {
    const entry: CalendarioModuloEntry = {
      id: 'cm1',
      academicYearModuleId: 'am1',
      category: 'holidays',
      name: 'Vacaciones de Navidad.',
      startDate: '2026-12-22',
      endDate: '2027-01-07',
    };
    const deps = fakeDeps({
      entries: [entry],
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
      years: [{ id: 'y1', teacherId: TEACHER, startYear: 2026, isCurrent: false }],
    });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'am1');

    expect(result).toEqual([entry]);
  });

  it('findForTeacher returns an empty array (not null) when owned but has no rows yet', async () => {
    const deps = fakeDeps({
      entries: [],
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
      years: [{ id: 'y1', teacherId: TEACHER, startYear: 2026, isCurrent: false }],
    });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'am1');

    expect(result).toEqual([]);
  });

  it('findForTeacher returns null when the academic_year_module does not exist', async () => {
    const deps = fakeDeps({ moduleRefs: {} });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'unknown');

    expect(result).toBeNull();
  });

  it("findForTeacher returns null when the module's academic year belongs to a different teacher", async () => {
    const deps = fakeDeps({
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
      years: [{ id: 'y1', teacherId: 'other-teacher', startYear: 2026, isCurrent: false }],
    });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'am1');

    expect(result).toBeNull();
  });
});
