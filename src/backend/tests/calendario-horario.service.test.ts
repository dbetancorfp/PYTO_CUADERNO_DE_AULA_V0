// elementId: calendario-months, calendario-legend, calendario-day-tooltip
// (business-logic side of UC-12/UC-13, see views/calendario/use-cases.md). New module,
// doesn't exist yet. CalendarioHorarioService owns both sides of calendario_horario:
// regenerating it from a just-saved weekly schedule (seedForModule, called by
// AcademicYearModuleScheduleService.saveSchedule — see
// academic-year-module-schedule.service.test.ts's "calendario_horario side effect"
// describe block) and reading it back, ownership-checked, for the Calendario view's
// GET /api/calendario-horario (findForTeacher).
//
// 2026-08-12 bugfix: the walk range is the módulo's own real teaching period —
// [Inicio curso, Fin de curso], the single-day academic_key_dates entries UC-06/A2
// already splits into calendario_modulo (16/09-22/06 for course 1, 16/09-27/05 for
// course 2, per the real key_dates seed) — NOT a fixed 1 September-30 June window (the
// original, incorrect implementation this test file used to pin). Non-working ranges are
// still derived from this same módulo's own already-seeded calendario_modulo rows
// (holidays/public_holidays/free_disposal_days only — academic_key_dates is
// informational, same exclusion calendario-modulo.service.ts's nonWorkingRangesFor
// already applies for UC-08/UC-09), not from key_dates directly.
import { describe, it, expect } from 'bun:test';
import { CalendarioHorarioService } from '../src/services/calendario-horario.service';
import type { CalendarioHorarioEntry, CalendarioHorarioRepository } from '../src/repositories/calendario-horario.repository';
import type { CalendarioModuloEntry, CalendarioModuloRepository } from '../src/repositories/calendario-modulo.repository';
import type { AcademicYear, AcademicYearRepository } from '../src/repositories/academic-year.repository';
import type { AcademicYearModuleRef, AcademicYearModuleRepository } from '../src/repositories/academic-year-module.repository';
import type { AcademicYearModuleScheduleEntry } from '../src/repositories/academic-year-module-schedule.repository';

const TEACHER = 'teacher-1';

// Real seed dates (see key_dates): both courses' "Inicio curso" is 16/09; "Fin de curso" is
// 22/06 for course 1, 27/05 for course 2 — UC-06/A2's split always gives single-day rows
// (start_date === end_date).
function inicioCursoEntry(course: 1 | 2): CalendarioModuloEntry {
  return {
    id: `inicio-${course}`,
    academicYearModuleId: 'am1',
    category: 'academic_key_dates',
    name: `Inicio curso: ${course}º de Grado Superior de FP.`,
    startDate: '2026-09-16',
    endDate: '2026-09-16',
    type: 'Curso escolar',
  };
}

function finCursoEntry(course: 1 | 2): CalendarioModuloEntry {
  const date = course === 1 ? '2027-06-22' : '2027-05-27';
  return {
    id: `fin-${course}`,
    academicYearModuleId: 'am1',
    category: 'academic_key_dates',
    name: `Fin de curso: ${course}º de Grado Superior de FP.`,
    startDate: date,
    endDate: date,
    type: 'Curso escolar',
  };
}

function makeModuloEntry(overrides: Partial<CalendarioModuloEntry> = {}): CalendarioModuloEntry {
  return {
    id: 'cm1',
    academicYearModuleId: 'am1',
    category: 'holidays',
    name: 'Vacaciones de Navidad.',
    startDate: '2026-12-22',
    endDate: '2027-01-07',
    type: 'Vacaciones',
    ...overrides,
  };
}

function makeYear(overrides: Partial<AcademicYear> = {}): AcademicYear {
  return { id: 'y1', teacherId: TEACHER, startYear: 2026, isCurrent: false, ...overrides };
}

interface FakeDeps {
  calendarioHorarioRepository: CalendarioHorarioRepository;
  calendarioModuloRepository: CalendarioModuloRepository;
  academicYearModuleRepository: AcademicYearModuleRepository;
  academicYearRepository: AcademicYearRepository;
  replaceAllCalls: { academicYearModuleId: string; entries: CalendarioHorarioEntry[] }[];
}

function fakeDeps(
  overrides: Partial<{
    moduloEntries: CalendarioModuloEntry[];
    horarioEntries: CalendarioHorarioEntry[];
    moduleRefs: Record<string, AcademicYearModuleRef>;
    years: AcademicYear[];
  }> = {},
): FakeDeps {
  const replaceAllCalls: { academicYearModuleId: string; entries: CalendarioHorarioEntry[] }[] = [];
  const moduleRefs = overrides.moduleRefs ?? { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } };
  const years = overrides.years ?? [makeYear()];

  const calendarioHorarioRepository: CalendarioHorarioRepository = {
    findAllForAcademicYearModule: async () => overrides.horarioEntries ?? [],
    replaceAll: async (academicYearModuleId: string, entries: CalendarioHorarioEntry[]) => {
      replaceAllCalls.push({ academicYearModuleId, entries });
    },
  };

  const calendarioModuloRepository: CalendarioModuloRepository = {
    findAllForAcademicYearModule: async () => overrides.moduloEntries ?? [],
    createMany: async () => {},
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
    rename: async (id: string, startYear: number) => ({ ...(years.find((y) => y.id === id) ?? makeYear()), startYear }),
    markCurrent: async (teacherId: string, id: string) => ({ ...(years.find((y) => y.id === id) ?? makeYear()), teacherId, isCurrent: true }),
    delete: async () => {},
  };

  return { calendarioHorarioRepository, calendarioModuloRepository, academicYearModuleRepository, academicYearRepository, replaceAllCalls };
}

function makeService(deps: FakeDeps): CalendarioHorarioService {
  return new CalendarioHorarioService(
    deps.calendarioHorarioRepository,
    deps.calendarioModuloRepository,
    deps.academicYearModuleRepository,
    deps.academicYearRepository,
  );
}

describe('elementId: calendario-months, calendario-legend, calendario-day-tooltip (seedForModule, UC-12)', () => {
  it('inserts one row per laborable date within [Inicio curso, Fin de curso] matching a scheduled weekday', async () => {
    const deps = fakeDeps({ moduloEntries: [inicioCursoEntry(1), finCursoEntry(1)] });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [{ weekday: 1, hours: 2 }]; // Monday

    await service.seedForModule('am1', schedule);

    expect(deps.replaceAllCalls).toHaveLength(1);
    expect(deps.replaceAllCalls[0]!.academicYearModuleId).toBe('am1');
    // 2026-09-21 is the first Monday on/after Inicio curso (16/09/2026, a Wednesday).
    expect(deps.replaceAllCalls[0]!.entries).toContainEqual({ date: '2026-09-21', hours: 2 });
  });

  it('excludes a date before Inicio curso, even though it matches a scheduled weekday and the fixed-window bug used to include it', async () => {
    const deps = fakeDeps({ moduloEntries: [inicioCursoEntry(1), finCursoEntry(1)] });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [{ weekday: 1, hours: 2 }]; // Monday

    await service.seedForModule('am1', schedule);

    // 2026-09-07 is a Monday, but before Inicio curso (16/09) — never included (2026-08-12 bugfix).
    expect(deps.replaceAllCalls[0]!.entries).not.toContainEqual(expect.objectContaining({ date: '2026-09-07' }));
  });

  it('excludes a date after Fin de curso — A4, e.g. a curso-2 módulo generates nothing past 27/05', async () => {
    const deps = fakeDeps({ moduloEntries: [inicioCursoEntry(2), finCursoEntry(2)] });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [{ weekday: 1, hours: 2 }]; // Monday

    await service.seedForModule('am1', schedule);

    // 2027-05-31 is a Monday, but after this course-2 módulo's Fin de curso (27/05/2027).
    expect(deps.replaceAllCalls[0]!.entries).not.toContainEqual(expect.objectContaining({ date: '2027-05-31' }));
    // The last Monday on/before Fin de curso (24/05/2027) is still included.
    expect(deps.replaceAllCalls[0]!.entries).toContainEqual({ date: '2027-05-24', hours: 2 });
  });

  it('excludes a scheduled weekday date that falls inside a holidays/public_holidays/free_disposal_days range', async () => {
    const deps = fakeDeps({
      moduloEntries: [
        inicioCursoEntry(1),
        finCursoEntry(1),
        makeModuloEntry({ category: 'holidays', startDate: '2026-12-22', endDate: '2027-01-07' }),
      ],
    });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [{ weekday: 1, hours: 2 }]; // Monday

    await service.seedForModule('am1', schedule);

    // 2026-12-28 is a Monday that falls inside the seeded Navidad holiday range.
    expect(deps.replaceAllCalls[0]!.entries).not.toContainEqual(expect.objectContaining({ date: '2026-12-28' }));
    // The next non-holiday Monday (2027-01-11) is still within [Inicio, Fin] and included.
    expect(deps.replaceAllCalls[0]!.entries).toContainEqual({ date: '2027-01-11', hours: 2 });
  });

  it('does not exclude dates covered only by an academic_key_dates entry (informational, not a real day off)', async () => {
    const deps = fakeDeps({
      moduloEntries: [
        inicioCursoEntry(1),
        finCursoEntry(1),
        makeModuloEntry({ category: 'academic_key_dates', name: 'Curso escolar', startDate: '2026-09-01', endDate: '2027-07-31' }),
      ],
    });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [{ weekday: 1, hours: 2 }];

    await service.seedForModule('am1', schedule);

    expect(deps.replaceAllCalls[0]!.entries).toContainEqual({ date: '2026-09-21', hours: 2 });
  });

  it('every inserted date falls within [Inicio curso, Fin de curso], never outside it', async () => {
    const deps = fakeDeps({ moduloEntries: [inicioCursoEntry(1), finCursoEntry(1)] });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [{ weekday: 1, hours: 1 }, { weekday: 5, hours: 3 }];

    await service.seedForModule('am1', schedule);

    const dates = deps.replaceAllCalls[0]!.entries.map((entry) => entry.date);
    expect(dates.every((date) => date >= '2026-09-16' && date <= '2027-06-22')).toBe(true);
  });

  it('produces no rows when Inicio curso/Fin de curso entries are missing from calendario_modulo (defensive default)', async () => {
    const deps = fakeDeps({ moduloEntries: [] });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [{ weekday: 1, hours: 2 }];

    await service.seedForModule('am1', schedule);

    expect(deps.replaceAllCalls).toEqual([{ academicYearModuleId: 'am1', entries: [] }]);
  });

  it('an empty schedule replaces with an empty array (clears any previously generated rows)', async () => {
    const deps = fakeDeps({ moduloEntries: [inicioCursoEntry(1), finCursoEntry(1)] });
    const service = makeService(deps);

    await service.seedForModule('am1', []);

    expect(deps.replaceAllCalls).toEqual([{ academicYearModuleId: 'am1', entries: [] }]);
  });

  it('each entry gets the hours value of its own matching weekday, not a single shared value', async () => {
    const deps = fakeDeps({ moduloEntries: [inicioCursoEntry(1), finCursoEntry(1)] });
    const service = makeService(deps);
    const schedule: AcademicYearModuleScheduleEntry[] = [
      { weekday: 1, hours: 1 }, // Monday
      { weekday: 5, hours: 3 }, // Friday
    ];

    await service.seedForModule('am1', schedule);

    const entries = deps.replaceAllCalls[0]!.entries;
    expect(entries).toContainEqual({ date: '2026-09-21', hours: 1 }); // first Monday on/after Inicio curso
    expect(entries).toContainEqual({ date: '2026-09-25', hours: 3 }); // first Friday on/after Inicio curso
  });
});

describe('elementId: calendario-months, calendario-legend, calendario-day-tooltip (findForTeacher, UC-13)', () => {
  it('returns the calendario_horario entries for a módulo owned by this teacher', async () => {
    const entries: CalendarioHorarioEntry[] = [{ date: '2026-09-21', hours: 2 }];
    const deps = fakeDeps({ horarioEntries: entries });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'am1');

    expect(result).toEqual(entries);
  });

  it('returns an empty array for a módulo owned by this teacher with no calendario_horario rows', async () => {
    const deps = fakeDeps({ horarioEntries: [] });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'am1');

    expect(result).toEqual([]);
  });

  it('returns null when the academic_year_modules row does not exist', async () => {
    const deps = fakeDeps({ moduleRefs: {} });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'unknown');

    expect(result).toBeNull();
  });

  it("returns null when the row's year belongs to a different teacher", async () => {
    const deps = fakeDeps({ years: [makeYear({ teacherId: 'other' })] });
    const service = makeService(deps);

    const result = await service.findForTeacher(TEACHER, 'am1');

    expect(result).toBeNull();
  });
});
