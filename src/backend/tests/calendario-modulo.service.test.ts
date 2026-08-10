// elementId: calendario-months, calendario-empty-state (business-logic side of UC-04/
// UC-06/UC-07, see views/calendario/use-cases.md). CalendarioModuloService owns both
// sides of calendario_modulo: seeding it from key_dates when a módulo is assigned
// (seedForModules, called by AcademicYearService — see academic-year.service.test.ts's
// "calendario_modulo snapshot" describe block) and reading it back, ownership-checked, for
// the Calendario view's GET /api/calendario-modulo (findForTeacher).
import { describe, it, expect } from 'bun:test';
import { CalendarioModuloService } from '../src/services/calendario-modulo.service';
import type { CalendarioModuloEntry, CalendarioModuloInsert, CalendarioModuloRepository } from '../src/repositories/calendario-modulo.repository';
import type {
  CalendarioEvaluationWorkingDaysEntry,
  CalendarioEvaluationWorkingDaysInsert,
  CalendarioEvaluationWorkingDaysRepository,
} from '../src/repositories/calendario-evaluation-working-days.repository';
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
  calendarioEvaluationWorkingDaysRepository: CalendarioEvaluationWorkingDaysRepository;
  keyDateRepository: KeyDateRepository;
  academicYearModuleRepository: AcademicYearModuleRepository;
  academicYearRepository: AcademicYearRepository;
  createManyCalls: CalendarioModuloInsert[][];
  workingDaysCreateManyCalls: CalendarioEvaluationWorkingDaysInsert[][];
}

function fakeDeps(overrides: Partial<{
  keyDates: KeyDate[];
  entries: CalendarioModuloEntry[];
  workingDaysEntries: CalendarioEvaluationWorkingDaysEntry[];
  moduleRefs: Record<string, AcademicYearModuleRef>;
  years: AcademicYear[];
}> = {}): FakeDeps {
  const createManyCalls: CalendarioModuloInsert[][] = [];
  const workingDaysCreateManyCalls: CalendarioEvaluationWorkingDaysInsert[][] = [];
  const moduleRefs = overrides.moduleRefs ?? {};
  const years = overrides.years ?? [];

  const calendarioModuloRepository: CalendarioModuloRepository = {
    findAllForAcademicYearModule: async () => overrides.entries ?? [],
    createMany: async (entries: CalendarioModuloInsert[]) => {
      createManyCalls.push(entries);
    },
  };

  const calendarioEvaluationWorkingDaysRepository: CalendarioEvaluationWorkingDaysRepository = {
    findAllForAcademicYearModule: async () => overrides.workingDaysEntries ?? [],
    createMany: async (entries: CalendarioEvaluationWorkingDaysInsert[]) => {
      workingDaysCreateManyCalls.push(entries);
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

  return {
    calendarioModuloRepository,
    calendarioEvaluationWorkingDaysRepository,
    keyDateRepository,
    academicYearModuleRepository,
    academicYearRepository,
    createManyCalls,
    workingDaysCreateManyCalls,
  };
}

function makeService(deps: FakeDeps): CalendarioModuloService {
  return new CalendarioModuloService(
    deps.calendarioModuloRepository,
    deps.calendarioEvaluationWorkingDaysRepository,
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

describe('elementId: calendario-months (final_exams generation — UC-08)', () => {
  const EVALUACION_1 = makeKeyDate({
    id: 'kd-eval-1',
    category: 'evaluations',
    name: '1ª Evaluación - Último día para poner notas.',
    startDay: 11,
    startMonth: 12,
    endDay: 11,
    endMonth: 12,
  });
  const CURSO_ESCOLAR = makeKeyDate({
    id: 'kd-academic',
    category: 'academic_key_dates',
    name: 'Curso escolar',
    startDay: 1,
    startMonth: 9,
    endDay: 31,
    endMonth: 7,
  });

  it('generates "Examen de recuperación final" (-2 business days) and "Examen final" (a further -4 business days), both before the grade deadline', async () => {
    const deps = fakeDeps({ keyDates: [EVALUACION_1] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    const inserted = deps.createManyCalls.flat();
    expect(inserted).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen de recuperación final.',
      startDate: '2026-12-09',
      endDate: '2026-12-09',
    });
    expect(inserted).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen final.',
      startDate: '2026-12-03',
      endDate: '2026-12-03',
    });
  });

  it('does not skip days inside an academic_key_dates range when walking business days (informational only, not a day off)', async () => {
    const deps = fakeDeps({ keyDates: [EVALUACION_1, CURSO_ESCOLAR] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    // Curso escolar (01/09-31/07) covers the whole walk window — if it were wrongly
    // treated as non-working, these dates would land somewhere before 2026-09-01 instead.
    const finalExams = deps.createManyCalls.flat().filter((e) => e.category === 'final_exams');
    expect(finalExams).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen de recuperación final.',
      startDate: '2026-12-09',
      endDate: '2026-12-09',
    });
    expect(finalExams).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen final.',
      startDate: '2026-12-03',
      endDate: '2026-12-03',
    });
  });

  it('generates one pair per distinct "Último día para poner notas" prefix, preserving course-suffixed names', async () => {
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({ id: 'kd-2a', category: 'evaluations', name: '2ª Evaluación (2º) - Último día para poner notas.', startDay: 17, startMonth: 2, endDay: 17, endMonth: 2 }),
        makeKeyDate({ id: 'kd-3a', category: 'evaluations', name: '3ª Evaluación (1º) - Último día para poner notas.', startDay: 11, startMonth: 6, endDay: 11, endMonth: 6 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    const finalExams = deps.createManyCalls.flat().filter((e) => e.category === 'final_exams');
    expect(finalExams).toHaveLength(4);
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '2ª Evaluación (2º) - Examen de recuperación final.', startDate: '2027-02-15', endDate: '2027-02-15' });
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '2ª Evaluación (2º) - Examen final.', startDate: '2027-02-09', endDate: '2027-02-09' });
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '3ª Evaluación (1º) - Examen de recuperación final.', startDate: '2027-06-09', endDate: '2027-06-09' });
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '3ª Evaluación (1º) - Examen final.', startDate: '2027-06-03', endDate: '2027-06-03' });
  });

  it('generates final_exams only for the matching entry, ignoring an evaluations entry that does not fit the pattern (UC-08/A1)', async () => {
    const deps = fakeDeps({
      keyDates: [
        EVALUACION_1,
        makeKeyDate({ category: 'evaluations', name: 'Sesión de evaluación sin nota.', startDay: 19, startMonth: 10, endDay: 21, endMonth: 10 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    const finalExams = deps.createManyCalls.flat().filter((e) => e.category === 'final_exams');
    expect(finalExams).toHaveLength(2);
    expect(finalExams.every((e) => e.name.startsWith('1ª Evaluación -'))).toBe(true);
  });

  it('every generated final_exams row is a single day (startDate === endDate)', async () => {
    const deps = fakeDeps({ keyDates: [EVALUACION_1] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    const finalExams = deps.createManyCalls.flat().filter((e) => e.category === 'final_exams');
    expect(finalExams.length).toBeGreaterThan(0);
    for (const entry of finalExams) {
      expect(entry.startDate).toBe(entry.endDate);
    }
  });
});

describe('elementId: evaluation-working-days-summary (working-days generation — UC-09)', () => {
  const EVALUACION_1 = makeKeyDate({
    id: 'kd-eval-1',
    category: 'evaluations',
    name: '1ª Evaluación - Último día para poner notas.',
    startDay: 11,
    startMonth: 12,
    endDay: 11,
    endMonth: 12,
  });
  const COURSE_START_1 = makeKeyDate({
    id: 'kd-course-1',
    category: 'academic_key_dates',
    name: 'Inicio curso: 1º de Grado Superior de FP.',
    startDay: 16,
    startMonth: 9,
    endDay: 22,
    endMonth: 6,
  });
  const COURSE_START_2 = makeKeyDate({
    id: 'kd-course-2',
    category: 'academic_key_dates',
    name: 'Inicio curso: 2º de Grado Superior de FP.',
    startDay: 16,
    startMonth: 9,
    endDay: 27,
    endMonth: 5,
  });

  it('generates a working_days row for evaluationNumber 1 using the module´s own course-start entry', async () => {
    const deps = fakeDeps({ keyDates: [EVALUACION_1, COURSE_START_1] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    // [2026-09-16, 2026-12-03) — course start to "1ª Evaluación"'s Examen final (see
    // business-day.test.ts's matching countLaborableDays example).
    expect(deps.workingDaysCreateManyCalls.flat()).toContainEqual({
      academicYearModuleId: 'am1',
      evaluationNumber: 1,
      workingDays: 56,
    });
  });

  it('uses the (2º) course-start entry and évaluation variant for a curso-2 módulo, and generates no evaluationNumber 3 row', async () => {
    const deps = fakeDeps({
      keyDates: [
        COURSE_START_2,
        makeKeyDate({ id: 'kd-2b', category: 'evaluations', name: '2ª Evaluación (2º) - Último día para poner notas.', startDay: 17, startMonth: 2, endDay: 17, endMonth: 2 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 2 })], 2026);

    const inserted = deps.workingDaysCreateManyCalls.flat();
    expect(inserted).toEqual([{ academicYearModuleId: 'am1', evaluationNumber: 2, workingDays: 104 }]);
  });

  it('generates one row per evaluación the módulo has data for, correctly numbered 1/2/3', async () => {
    const deps = fakeDeps({
      keyDates: [
        COURSE_START_1,
        EVALUACION_1,
        makeKeyDate({ id: 'kd-2a', category: 'evaluations', name: '2ª Evaluación (1º) - Último día para poner notas.', startDay: 12, startMonth: 3, endDay: 12, endMonth: 3 }),
        makeKeyDate({ id: 'kd-3a', category: 'evaluations', name: '3ª Evaluación (1º) - Último día para poner notas.', startDay: 11, startMonth: 6, endDay: 11, endMonth: 6 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    const inserted = deps.workingDaysCreateManyCalls.flat();
    expect(inserted).toHaveLength(3);
    expect(inserted).toContainEqual({ academicYearModuleId: 'am1', evaluationNumber: 1, workingDays: 56 });
    expect(inserted).toContainEqual({ academicYearModuleId: 'am1', evaluationNumber: 2, workingDays: 121 });
    expect(inserted).toContainEqual({ academicYearModuleId: 'am1', evaluationNumber: 3, workingDays: 186 });
  });

  it('generates no working_days rows when the módulo has no course-start entry to anchor the range', async () => {
    const deps = fakeDeps({ keyDates: [EVALUACION_1] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    expect(deps.workingDaysCreateManyCalls.flat()).toHaveLength(0);
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

describe('elementId: evaluation-working-days-summary (reading — UC-10)', () => {
  it('findEvaluationWorkingDaysForTeacher returns the entries when the academic_year_module is owned by the teacher', async () => {
    const entry: CalendarioEvaluationWorkingDaysEntry = { id: 'wd1', academicYearModuleId: 'am1', evaluationNumber: 1, workingDays: 56 };
    const deps = fakeDeps({
      workingDaysEntries: [entry],
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
      years: [{ id: 'y1', teacherId: TEACHER, startYear: 2026, isCurrent: false }],
    });
    const service = makeService(deps);

    const result = await service.findEvaluationWorkingDaysForTeacher(TEACHER, 'am1');

    expect(result).toEqual([entry]);
  });

  it('findEvaluationWorkingDaysForTeacher returns an empty array (not null) when owned but has no rows yet', async () => {
    const deps = fakeDeps({
      workingDaysEntries: [],
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
      years: [{ id: 'y1', teacherId: TEACHER, startYear: 2026, isCurrent: false }],
    });
    const service = makeService(deps);

    const result = await service.findEvaluationWorkingDaysForTeacher(TEACHER, 'am1');

    expect(result).toEqual([]);
  });

  it('findEvaluationWorkingDaysForTeacher returns null when the academic_year_module does not exist', async () => {
    const deps = fakeDeps({ moduleRefs: {} });
    const service = makeService(deps);

    const result = await service.findEvaluationWorkingDaysForTeacher(TEACHER, 'unknown');

    expect(result).toBeNull();
  });

  it("findEvaluationWorkingDaysForTeacher returns null when the module's academic year belongs to a different teacher", async () => {
    const deps = fakeDeps({
      moduleRefs: { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } },
      years: [{ id: 'y1', teacherId: 'other-teacher', startYear: 2026, isCurrent: false }],
    });
    const service = makeService(deps);

    const result = await service.findEvaluationWorkingDaysForTeacher(TEACHER, 'am1');

    expect(result).toBeNull();
  });
});
