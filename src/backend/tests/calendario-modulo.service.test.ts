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
import type { CalendarioHorarioEntry } from '../src/repositories/calendario-horario.repository';

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
  replaceFinalExamsCalls: { academicYearModuleId: string; entries: CalendarioModuloInsert[] }[];
  replaceWorkingDaysCalls: { academicYearModuleId: string; entries: CalendarioEvaluationWorkingDaysInsert[] }[];
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
  const replaceFinalExamsCalls: { academicYearModuleId: string; entries: CalendarioModuloInsert[] }[] = [];
  const replaceWorkingDaysCalls: { academicYearModuleId: string; entries: CalendarioEvaluationWorkingDaysInsert[] }[] = [];
  const moduleRefs = overrides.moduleRefs ?? {};
  const years = overrides.years ?? [];

  const calendarioModuloRepository: CalendarioModuloRepository = {
    findAllForAcademicYearModule: async () => overrides.entries ?? [],
    createMany: async (entries: CalendarioModuloInsert[]) => {
      createManyCalls.push(entries);
    },
    replaceFinalExamsForModule: async (academicYearModuleId: string, entries: CalendarioModuloInsert[]) => {
      replaceFinalExamsCalls.push({ academicYearModuleId, entries });
    },
  };

  const calendarioEvaluationWorkingDaysRepository: CalendarioEvaluationWorkingDaysRepository = {
    findAllForAcademicYearModule: async () => overrides.workingDaysEntries ?? [],
    createMany: async (entries: CalendarioEvaluationWorkingDaysInsert[]) => {
      workingDaysCreateManyCalls.push(entries);
    },
    replaceForModule: async (academicYearModuleId: string, entries: CalendarioEvaluationWorkingDaysInsert[]) => {
      replaceWorkingDaysCalls.push({ academicYearModuleId, entries });
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
    replaceFinalExamsCalls,
    replaceWorkingDaysCalls,
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

  it('seedForModules copies key_dates.type onto the resolved calendario_modulo entry (UC-11, 2026-08-10)', async () => {
    const deps = fakeDeps({ keyDates: [makeKeyDate({ category: 'public_holidays', name: 'Festivo.', type: 'Festivo nacional' })] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    expect(deps.createManyCalls.flat()[0]).toMatchObject({ type: 'Festivo nacional' });
  });

  it('seedForModules resolves type to null when the key_dates row has no tipo set', async () => {
    const deps = fakeDeps({ keyDates: [makeKeyDate({ type: null })] });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1' })], 2026);

    expect(deps.createManyCalls.flat()[0]).toMatchObject({ type: null });
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
      type: null,
    });
    expect(inserted).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen final.',
      startDate: '2026-12-03',
      endDate: '2026-12-03',
      type: null,
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
      type: null,
    });
    expect(finalExams).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen final.',
      startDate: '2026-12-03',
      endDate: '2026-12-03',
      type: null,
    });
  });

  it('generates one pair per distinct "Último día para poner notas" prefix, preserving course-suffixed names', async () => {
    // Both entries tagged (1º) here — a course-1 módulo (makeModule()'s default) is
    // applicable to both, so this test stays about "multiple distinct prefixes", not the
    // cross-course exclusion (see the dedicated "course filtering" describe block below).
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({ id: 'kd-2a', category: 'evaluations', name: '2ª Evaluación (1º) - Último día para poner notas.', startDay: 17, startMonth: 2, endDay: 17, endMonth: 2 }),
        makeKeyDate({ id: 'kd-3a', category: 'evaluations', name: '3ª Evaluación (1º) - Último día para poner notas.', startDay: 11, startMonth: 6, endDay: 11, endMonth: 6 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    const finalExams = deps.createManyCalls.flat().filter((e) => e.category === 'final_exams');
    expect(finalExams).toHaveLength(4);
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '2ª Evaluación (1º) - Examen de recuperación final.', startDate: '2027-02-15', endDate: '2027-02-15', type: null });
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '2ª Evaluación (1º) - Examen final.', startDate: '2027-02-09', endDate: '2027-02-09', type: null });
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '3ª Evaluación (1º) - Examen de recuperación final.', startDate: '2027-06-09', endDate: '2027-06-09', type: null });
    expect(finalExams).toContainEqual({ academicYearModuleId: 'am1', category: 'final_exams', name: '3ª Evaluación (1º) - Examen final.', startDate: '2027-06-03', endDate: '2027-06-03', type: null });
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

  it('final_exams is only generated for evaluaciones applicable to that módulo´s own course, never a cross-course one (2026-08-10 bugfix, UC-08 A-none/UC-06 A1)', async () => {
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({ id: 'kd-2a-1', category: 'evaluations', name: '2ª Evaluación (1º) - Último día para poner notas.', startDay: 12, startMonth: 3, endDay: 12, endMonth: 3 }),
        makeKeyDate({ id: 'kd-2a-2', category: 'evaluations', name: '2ª Evaluación (2º) - Último día para poner notas.', startDay: 17, startMonth: 2, endDay: 17, endMonth: 2 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    const finalExams = deps.createManyCalls.flat().filter((e) => e.category === 'final_exams');
    expect(finalExams.length).toBeGreaterThan(0);
    expect(finalExams.every((e) => e.name.startsWith('2ª Evaluación (1º) -'))).toBe(true);
    expect(finalExams.some((e) => e.name.startsWith('2ª Evaluación (2º) -'))).toBe(false);
  });
});

describe('elementId: calendario-months (course filtering — UC-06/A1, 2026-08-10 bugfix)', () => {
  it('excludes a course-2-only key_dates entry from a course-1 módulo´s snapshot', async () => {
    const deps = fakeDeps({
      keyDates: [makeKeyDate({ category: 'academic_key_dates', name: 'Inicio curso: 2º de Grado Superior de FP.', startDay: 16, startMonth: 9, endDay: 16, endMonth: 9 })],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    expect(deps.createManyCalls.flat()).toHaveLength(0);
  });

  it('excludes a course-1-only key_dates entry from a course-2 módulo´s snapshot', async () => {
    const deps = fakeDeps({
      keyDates: [makeKeyDate({ category: 'academic_key_dates', name: 'Inicio curso: 1º de Grado Superior de FP.', startDay: 16, startMonth: 9, endDay: 16, endMonth: 9 })],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 2 })], 2026);

    expect(deps.createManyCalls.flat()).toHaveLength(0);
  });

  it('includes a course-agnostic key_dates entry in both a course-1 and a course-2 módulo´s snapshot', async () => {
    const deps = fakeDeps({
      keyDates: [makeKeyDate({ category: 'academic_key_dates', name: 'Curso escolar', startDay: 1, startMonth: 9, endDay: 31, endMonth: 7 })],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 }), makeModule({ id: 'am2', course: 2 })], 2026);

    const inserted = deps.createManyCalls.flat();
    expect(inserted.filter((e) => e.academicYearModuleId === 'am1' && e.name === 'Curso escolar')).toHaveLength(1);
    expect(inserted.filter((e) => e.academicYearModuleId === 'am2' && e.name === 'Curso escolar')).toHaveLength(1);
  });

  it('applies the exact UC-06/A1 course-token table across every marked category (academic_key_dates, evaluations, feoe_project_days)', async () => {
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({ category: 'academic_key_dates', name: 'Curso escolar', startDay: 1, startMonth: 9, endDay: 31, endMonth: 7 }),
        makeKeyDate({ category: 'academic_key_dates', name: 'Inicio curso: 1º de Grado Superior de FP.', startDay: 16, startMonth: 9, endDay: 16, endMonth: 9 }),
        makeKeyDate({ category: 'academic_key_dates', name: 'Inicio curso: 2º de Grado Superior de FP.', startDay: 16, startMonth: 9, endDay: 16, endMonth: 9 }),
        makeKeyDate({ category: 'academic_key_dates', name: '2º Presentación de proyectos.', startDay: 1, startMonth: 5, endDay: 5, endMonth: 5 }),
        makeKeyDate({ category: 'feoe_project_days', name: '1º - Dia de alternancia 1.', startDay: 1, startMonth: 10, endDay: 1, endMonth: 10 }),
        makeKeyDate({ category: 'feoe_project_days', name: '2º - Dia de alternancia 1.', startDay: 2, startMonth: 10, endDay: 2, endMonth: 10 }),
        makeKeyDate({ category: 'evaluations', name: '2ª Evaluación (1º) - Sesión de evaluación con nota.', startDay: 1, startMonth: 3, endDay: 1, endMonth: 3 }),
        makeKeyDate({ category: 'evaluations', name: '2ª Evaluación (2º) - Sesión de evaluación con nota.', startDay: 2, startMonth: 3, endDay: 2, endMonth: 3 }),
        makeKeyDate({ category: 'evaluations', name: '1ª Evaluación - Sesión de evaluación con nota.', startDay: 3, startMonth: 12, endDay: 3, endMonth: 12 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am-course1', course: 1 }), makeModule({ id: 'am-course2', course: 2 })], 2026);

    const inserted = deps.createManyCalls.flat();
    const namesFor = (academicYearModuleId: string): string[] =>
      inserted.filter((e) => e.academicYearModuleId === academicYearModuleId).map((e) => e.name);
    const course1Names = namesFor('am-course1');
    const course2Names = namesFor('am-course2');

    // Course-agnostic: present in both.
    expect(course1Names).toContain('Curso escolar');
    expect(course2Names).toContain('Curso escolar');
    expect(course1Names).toContain('1ª Evaluación - Sesión de evaluación con nota.');
    expect(course2Names).toContain('1ª Evaluación - Sesión de evaluación con nota.');

    // Course-1-only.
    expect(course1Names).toContain('Inicio curso: 1º de Grado Superior de FP.');
    expect(course2Names).not.toContain('Inicio curso: 1º de Grado Superior de FP.');
    expect(course1Names).toContain('1º - Dia de alternancia 1.');
    expect(course2Names).not.toContain('1º - Dia de alternancia 1.');
    expect(course1Names).toContain('2ª Evaluación (1º) - Sesión de evaluación con nota.');
    expect(course2Names).not.toContain('2ª Evaluación (1º) - Sesión de evaluación con nota.');

    // Course-2-only.
    expect(course2Names).toContain('Inicio curso: 2º de Grado Superior de FP.');
    expect(course1Names).not.toContain('Inicio curso: 2º de Grado Superior de FP.');
    expect(course2Names).toContain('2º Presentación de proyectos.');
    expect(course1Names).not.toContain('2º Presentación de proyectos.');
    expect(course2Names).toContain('2º - Dia de alternancia 1.');
    expect(course1Names).not.toContain('2º - Dia de alternancia 1.');
    expect(course2Names).toContain('2ª Evaluación (2º) - Sesión de evaluación con nota.');
    expect(course1Names).not.toContain('2ª Evaluación (2º) - Sesión de evaluación con nota.');
  });

  it('produces the documented per-course row-count formula: agnostic + own-course-only entries', async () => {
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({ id: 'a1', category: 'holidays', name: 'Agnostic A.', startDay: 1, startMonth: 10, endDay: 1, endMonth: 10 }),
        makeKeyDate({ id: 'a2', category: 'holidays', name: 'Agnostic B.', startDay: 2, startMonth: 10, endDay: 2, endMonth: 10 }),
        makeKeyDate({ id: 'a3', category: 'holidays', name: 'Agnostic C.', startDay: 3, startMonth: 10, endDay: 3, endMonth: 10 }),
        makeKeyDate({ id: 'c1a', category: 'feoe_project_days', name: '1º - Dia de alternancia 1.', startDay: 4, startMonth: 10, endDay: 4, endMonth: 10 }),
        makeKeyDate({ id: 'c1b', category: 'feoe_project_days', name: '1º - Dia de alternancia 2.', startDay: 5, startMonth: 10, endDay: 5, endMonth: 10 }),
        makeKeyDate({ id: 'c2a', category: 'feoe_project_days', name: '2º - Dia de alternancia 1.', startDay: 6, startMonth: 10, endDay: 6, endMonth: 10 }),
        makeKeyDate({ id: 'c2b', category: 'feoe_project_days', name: '2º - Dia de alternancia 2.', startDay: 7, startMonth: 10, endDay: 7, endMonth: 10 }),
        makeKeyDate({ id: 'c2c', category: 'feoe_project_days', name: '2º - Dia de alternancia 3.', startDay: 8, startMonth: 10, endDay: 8, endMonth: 10 }),
        makeKeyDate({ id: 'c2d', category: 'feoe_project_days', name: '2º - Dia de alternancia 4.', startDay: 9, startMonth: 10, endDay: 9, endMonth: 10 }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am-course1', course: 1 }), makeModule({ id: 'am-course2', course: 2 })], 2026);

    const inserted = deps.createManyCalls.flat();
    // 3 agnostic + 2 course-1-only = 5; 3 agnostic + 4 course-2-only = 7 (no final_exams
    // here — none of the fixture's entries are 'evaluations', so E = 0 for both courses).
    expect(inserted.filter((e) => e.academicYearModuleId === 'am-course1')).toHaveLength(5);
    expect(inserted.filter((e) => e.academicYearModuleId === 'am-course2')).toHaveLength(7);
  });
});

describe('elementId: calendario-months ("Inicio curso"/"Fin de curso" split — UC-06/A2, 2026-08-10)', () => {
  it('splits "Inicio curso: 1º de Grado Superior de FP." into two single-day rows for a course-1 módulo', async () => {
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({
          category: 'academic_key_dates',
          name: 'Inicio curso: 1º de Grado Superior de FP.',
          startDay: 16,
          startMonth: 9,
          endDay: 22,
          endMonth: 6,
          type: 'Curso escolar',
        }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    const inserted = deps.createManyCalls.flat();
    expect(inserted).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'academic_key_dates',
      name: 'Inicio curso: 1º de Grado Superior de FP.',
      startDate: '2026-09-16',
      endDate: '2026-09-16',
      type: 'Curso escolar',
    });
    expect(inserted).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'academic_key_dates',
      name: 'Fin de curso: 1º de Grado Superior de FP.',
      startDate: '2027-06-22',
      endDate: '2027-06-22',
      type: 'Curso escolar',
    });
    // No leftover long-range row under the original name/date-shape.
    expect(inserted.filter((e) => e.name === 'Inicio curso: 1º de Grado Superior de FP.')).toHaveLength(1);
  });

  it('splits "Inicio curso: 2º de Grado Superior de FP." into two single-day rows for a course-2 módulo', async () => {
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({
          category: 'academic_key_dates',
          name: 'Inicio curso: 2º de Grado Superior de FP.',
          startDay: 16,
          startMonth: 9,
          endDay: 27,
          endMonth: 5,
          type: 'Curso escolar',
        }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 2 })], 2026);

    const inserted = deps.createManyCalls.flat();
    expect(inserted).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'academic_key_dates',
      name: 'Inicio curso: 2º de Grado Superior de FP.',
      startDate: '2026-09-16',
      endDate: '2026-09-16',
      type: 'Curso escolar',
    });
    expect(inserted).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'academic_key_dates',
      name: 'Fin de curso: 2º de Grado Superior de FP.',
      startDate: '2027-05-27',
      endDate: '2027-05-27',
      type: 'Curso escolar',
    });
  });

  it('does not split "Curso escolar" — it stays a single long-range row', async () => {
    const deps = fakeDeps({
      keyDates: [
        makeKeyDate({ category: 'academic_key_dates', name: 'Curso escolar', startDay: 1, startMonth: 9, endDay: 31, endMonth: 7, type: 'Curso escolar' }),
      ],
    });
    const service = makeService(deps);

    await service.seedForModules([makeModule({ id: 'am1', course: 1 })], 2026);

    const inserted = deps.createManyCalls.flat();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ name: 'Curso escolar', startDate: '2026-09-01', endDate: '2027-07-31' });
    expect(inserted.some((e) => e.name.startsWith('Fin de curso'))).toBe(false);
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

describe('elementId: calendario-months, calendario-legend, calendario-day-tooltip (recomputeForModule — UC-08/UC-09 2026-08-12 revision)', () => {
  function moduloEntry(overrides: Partial<CalendarioModuloEntry> = {}): CalendarioModuloEntry {
    return {
      id: 'cm-entry',
      academicYearModuleId: 'am1',
      category: 'evaluations',
      name: '1ª Evaluación - Último día para poner notas.',
      startDate: '2026-12-11',
      endDate: '2026-12-11',
      type: null,
      ...overrides,
    };
  }

  const INICIO_CURSO_1 = moduloEntry({
    id: 'cm-inicio',
    category: 'academic_key_dates',
    name: 'Inicio curso: 1º de Grado Superior de FP.',
    startDate: '2026-09-16',
    endDate: '2026-09-16',
  });

  function horario(dates: [string, number][]): CalendarioHorarioEntry[] {
    return dates.map(([date, hours]) => ({ date, hours }));
  }

  it('snaps "Examen de recuperación final"/"Examen final" backward, one day at a time, to the nearest date the módulo actually has horario for', async () => {
    const EVALUACION_1 = moduloEntry({ id: 'cm-eval-1', startDate: '2026-12-11', endDate: '2026-12-11' });
    const deps = fakeDeps({ entries: [INICIO_CURSO_1, EVALUACION_1] });
    const service = makeService(deps);

    // Horario = Mondays only. Plain walk lands retake on Wed 2026-12-09 (not a horario
    // day) and final (from the plain retake) on Thu 2026-12-03 — both snap back to the
    // nearest earlier Monday, chained through the already-snapped retake per the user's
    // exact rule: "Retrocedemos lo acordado ... si no cae en día con horario seguimos
    // retrocediendo hasta que caiga en día con horario."
    const horarioEntries = horario([
      ['2026-11-30', 2],
      ['2026-12-07', 2],
      ['2026-12-14', 2],
      ['2026-12-21', 2],
      ['2026-12-28', 2],
    ]);

    await service.recomputeForModule('am1', horarioEntries);

    const finalExams = deps.replaceFinalExamsCalls[0]!.entries;
    expect(finalExams).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen de recuperación final.',
      startDate: '2026-12-07',
      endDate: '2026-12-07',
      type: null,
    });
    expect(finalExams).toContainEqual({
      academicYearModuleId: 'am1',
      category: 'final_exams',
      name: '1ª Evaluación - Examen final.',
      startDate: '2026-11-30',
      endDate: '2026-11-30',
      type: null,
    });
  });

  it('falls back to the plain (unsnapped) business-day dates when horarioEntries is empty', async () => {
    const EVALUACION_1 = moduloEntry({ id: 'cm-eval-1', startDate: '2026-12-11', endDate: '2026-12-11' });
    const deps = fakeDeps({ entries: [INICIO_CURSO_1, EVALUACION_1] });
    const service = makeService(deps);

    await service.recomputeForModule('am1', []);

    const finalExams = deps.replaceFinalExamsCalls[0]!.entries;
    expect(finalExams).toContainEqual(
      expect.objectContaining({ name: '1ª Evaluación - Examen de recuperación final.', startDate: '2026-12-09' }),
    );
    expect(finalExams).toContainEqual(
      expect.objectContaining({ name: '1ª Evaluación - Examen final.', startDate: '2026-12-03' }),
    );
    // Working-days falls back to the original day-count formula too.
    expect(deps.replaceWorkingDaysCalls[0]!.entries).toContainEqual({
      academicYearModuleId: 'am1',
      evaluationNumber: 1,
      workingDays: 56,
    });
  });

  it('sums horario hours between "Inicio curso" and the day before "Examen final", minus the 2-hour recovery-day discount, floored at 0', async () => {
    const EVALUACION_1 = moduloEntry({ id: 'cm-eval-1', startDate: '2026-10-15', endDate: '2026-10-15' });
    const inicioCloseToFinal = moduloEntry({
      id: 'cm-inicio-2',
      category: 'academic_key_dates',
      name: 'Inicio curso: 1º de Grado Superior de FP.',
      startDate: '2026-10-05',
      endDate: '2026-10-05',
    });
    const deps = fakeDeps({ entries: [inicioCloseToFinal, EVALUACION_1] });
    const service = makeService(deps);

    // Plain final = 2026-10-07 (Wed), retake = 2026-10-13 (Tue) — both already horario
    // days here (anchored below), so no snapping drift. Only one horario hour falls
    // inside [2026-10-05, 2026-10-07) — 1 - 2 = -1, floored to 0.
    const horarioEntries = horario([
      ['2026-10-06', 1],
      ['2026-10-07', 2],
      ['2026-10-13', 2],
    ]);

    await service.recomputeForModule('am1', horarioEntries);

    expect(deps.replaceWorkingDaysCalls[0]!.entries).toContainEqual({
      academicYearModuleId: 'am1',
      evaluationNumber: 1,
      workingDays: 0,
    });
  });

  it('counts evaluación 2´s hours incrementally from the day after evaluación 1´s "Examen final", not cumulatively from "Inicio curso" again', async () => {
    const EVALUACION_1 = moduloEntry({ id: 'cm-eval-1', startDate: '2026-10-15', endDate: '2026-10-15' });
    const EVALUACION_2 = moduloEntry({
      id: 'cm-eval-2',
      name: '2ª Evaluación (1º) - Último día para poner notas.',
      startDate: '2027-02-17',
      endDate: '2027-02-17',
    });
    const deps = fakeDeps({ entries: [INICIO_CURSO_1, EVALUACION_1, EVALUACION_2] });
    const service = makeService(deps);

    // Anchors pin both evaluaciones' final/recuperación dates exactly on a horario day
    // (no snap drift), isolating this test to the incremental-range behavior alone:
    //   eval 1 final = 2026-10-07, retake = 2026-10-13
    //   eval 2 final = 2027-02-09, retake = 2027-02-15
    // A large chunk of hours sits entirely before eval 1's own final (2026-09-16 to
    // 2026-09-30, 11 weekdays × 2h = 22h) — if eval 2's range were still (incorrectly)
    // counted from "Inicio curso", those 22h would leak into its total too. A small,
    // distinct chunk (2027-02-01 to 2027-02-05, 5 weekdays × 3h = 15h) plus eval 1's own
    // retake anchor (2026-10-13, 1h — it falls after eval 1's final and before eval 2's
    // final, so it's legitimately inside eval 2's own incremental range) sit inside eval
    // 2's actual [2026-10-08, 2027-02-09) range.
    const horarioEntries = horario([
      ['2026-09-16', 2], ['2026-09-17', 2], ['2026-09-18', 2], ['2026-09-21', 2], ['2026-09-22', 2],
      ['2026-09-23', 2], ['2026-09-24', 2], ['2026-09-25', 2], ['2026-09-28', 2], ['2026-09-29', 2], ['2026-09-30', 2],
      ['2026-10-07', 2], ['2026-10-13', 1],
      ['2027-02-01', 3], ['2027-02-02', 3], ['2027-02-03', 3], ['2027-02-04', 3], ['2027-02-05', 3],
      ['2027-02-09', 2], ['2027-02-15', 2],
    ]);

    await service.recomputeForModule('am1', horarioEntries);

    const workingDays = deps.replaceWorkingDaysCalls[0]!.entries;
    expect(workingDays).toContainEqual({ academicYearModuleId: 'am1', evaluationNumber: 1, workingDays: 20 });
    expect(workingDays).toContainEqual({ academicYearModuleId: 'am1', evaluationNumber: 2, workingDays: 14 });
  });

  it('replaces, rather than appends to, the existing final_exams and working_days rows for this módulo', async () => {
    const EVALUACION_1 = moduloEntry({ id: 'cm-eval-1', startDate: '2026-12-11', endDate: '2026-12-11' });
    const deps = fakeDeps({ entries: [INICIO_CURSO_1, EVALUACION_1] });
    const service = makeService(deps);

    await service.recomputeForModule('am1', []);

    expect(deps.replaceFinalExamsCalls).toHaveLength(1);
    expect(deps.replaceFinalExamsCalls[0]!.academicYearModuleId).toBe('am1');
    expect(deps.replaceFinalExamsCalls[0]!.entries).toHaveLength(2);
    expect(deps.replaceWorkingDaysCalls).toHaveLength(1);
    expect(deps.replaceWorkingDaysCalls[0]!.academicYearModuleId).toBe('am1');
    expect(deps.replaceWorkingDaysCalls[0]!.entries).toHaveLength(1);
    // createMany (the append-only, seed-time path) is never used by this recompute path.
    expect(deps.createManyCalls).toHaveLength(0);
    expect(deps.workingDaysCreateManyCalls).toHaveLength(0);
  });

  it('does nothing when the módulo has no "Inicio curso" entry to anchor the recomputation', async () => {
    const EVALUACION_1 = moduloEntry({ id: 'cm-eval-1', startDate: '2026-12-11', endDate: '2026-12-11' });
    const deps = fakeDeps({ entries: [EVALUACION_1] });
    const service = makeService(deps);

    await service.recomputeForModule('am1', horario([['2026-12-07', 2]]));

    expect(deps.replaceFinalExamsCalls).toHaveLength(0);
    expect(deps.replaceWorkingDaysCalls).toHaveLength(0);
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
      type: 'Vacaciones',
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
