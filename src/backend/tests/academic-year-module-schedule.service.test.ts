// elementId: schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select,
// schedule-thursday-select, schedule-friday-select, schedule-save-button (business-logic
// side of UC-11, see views/configuracion/use-cases.md). New module, doesn't exist yet.
// Ownership is checked the same two-step way AcademicYearService.removeModule already does
// (see src/backend/src/services/academic-year.service.ts): academic_year_modules.id -> its
// academic_year_id -> an academic_years row owned by teacherId. weekday/hours range
// validation (1-5 / 1-3) and duplicate-weekday rejection happen at the route layer (see
// academic-year-module-schedule.routes.test.ts), not here — this service trusts its input.
import { describe, it, expect } from 'bun:test';
import { AcademicYearModuleScheduleService } from '../src/services/academic-year-module-schedule.service';
import type {
  AcademicYearModuleScheduleEntry,
  AcademicYearModuleScheduleRepository,
} from '../src/repositories/academic-year-module-schedule.repository';
import type { AcademicYearModuleRef, AcademicYearModuleRepository } from '../src/repositories/academic-year-module.repository';
import type { AcademicYear, AcademicYearRepository } from '../src/repositories/academic-year.repository';

const TEACHER = 'teacher-1';

function makeYear(overrides: Partial<AcademicYear> = {}): AcademicYear {
  return { id: 'y1', teacherId: TEACHER, startYear: 2026, isCurrent: false, ...overrides };
}

interface FakeRepos {
  scheduleRepository: AcademicYearModuleScheduleRepository;
  academicYearModuleRepository: AcademicYearModuleRepository;
  academicYearRepository: AcademicYearRepository;
  replaceAllCalls: { academicYearModuleId: string; entries: AcademicYearModuleScheduleEntry[] }[];
}

function fakeRepos(
  overrides: Partial<{
    years: AcademicYear[];
    moduleRefs: Record<string, AcademicYearModuleRef>;
    scheduleEntries: AcademicYearModuleScheduleEntry[];
  }> = {},
): FakeRepos {
  const years = overrides.years ?? [makeYear()];
  const moduleRefs = overrides.moduleRefs ?? { am1: { id: 'am1', academicYearId: 'y1', catalogModuleId: 'm1' } };
  const replaceAllCalls: { academicYearModuleId: string; entries: AcademicYearModuleScheduleEntry[] }[] = [];

  const scheduleRepository: AcademicYearModuleScheduleRepository = {
    findByModuleId: async () => overrides.scheduleEntries ?? [],
    replaceAll: async (academicYearModuleId: string, entries: AcademicYearModuleScheduleEntry[]) => {
      replaceAllCalls.push({ academicYearModuleId, entries });
      return entries;
    },
  };

  const academicYearModuleRepository: AcademicYearModuleRepository = {
    findAllForYear: async () => [],
    findById: async (id: string) => moduleRefs[id] ?? null,
    countForYear: async () => 0,
    createMany: async (_academicYearId: string, catalogModuleIds: string[]) => catalogModuleIds.length,
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

  return { scheduleRepository, academicYearModuleRepository, academicYearRepository, replaceAllCalls };
}

function makeService(repos: FakeRepos): AcademicYearModuleScheduleService {
  return new AcademicYearModuleScheduleService(
    repos.scheduleRepository,
    repos.academicYearModuleRepository,
    repos.academicYearRepository,
  );
}

describe('elementId: schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select, schedule-thursday-select, schedule-friday-select', () => {
  it('getSchedule returns the saved entries for a módulo owned by this teacher', async () => {
    const entries: AcademicYearModuleScheduleEntry[] = [
      { weekday: 1, hours: 2 },
      { weekday: 3, hours: 1 },
    ];
    const repos = fakeRepos({ scheduleEntries: entries });
    const service = makeService(repos);

    const result = await service.getSchedule(TEACHER, 'am1');

    expect(result).toEqual(entries);
  });

  it('getSchedule returns an empty array for a módulo with no saved schedule (every weekday "Sin clase")', async () => {
    const repos = fakeRepos({ scheduleEntries: [] });
    const service = makeService(repos);

    const result = await service.getSchedule(TEACHER, 'am1');

    expect(result).toEqual([]);
  });

  it('getSchedule returns null when the academic_year_modules row does not exist', async () => {
    const repos = fakeRepos({ moduleRefs: {} });
    const service = makeService(repos);

    const result = await service.getSchedule(TEACHER, 'unknown');

    expect(result).toBeNull();
  });

  it("getSchedule returns null when the row's year belongs to a different teacher", async () => {
    const repos = fakeRepos({ years: [makeYear({ teacherId: 'other' })] });
    const service = makeService(repos);

    const result = await service.getSchedule(TEACHER, 'am1');

    expect(result).toBeNull();
  });
});

describe('elementId: schedule-save-button', () => {
  it('saveSchedule replaces the full weekly schedule for a módulo owned by this teacher', async () => {
    const repos = fakeRepos();
    const service = makeService(repos);
    const entries: AcademicYearModuleScheduleEntry[] = [
      { weekday: 1, hours: 2 },
      { weekday: 5, hours: 3 },
    ];

    const result = await service.saveSchedule(TEACHER, 'am1', entries);

    expect(result).toEqual(entries);
    expect(repos.replaceAllCalls).toEqual([{ academicYearModuleId: 'am1', entries }]);
  });

  it('saveSchedule with an empty array clears every weekday (all left "Sin clase")', async () => {
    const repos = fakeRepos();
    const service = makeService(repos);

    const result = await service.saveSchedule(TEACHER, 'am1', []);

    expect(result).toEqual([]);
    expect(repos.replaceAllCalls).toEqual([{ academicYearModuleId: 'am1', entries: [] }]);
  });

  it('saveSchedule returns null when the academic_year_modules row does not exist, persisting nothing', async () => {
    const repos = fakeRepos({ moduleRefs: {} });
    const service = makeService(repos);

    const result = await service.saveSchedule(TEACHER, 'unknown', [{ weekday: 1, hours: 2 }]);

    expect(result).toBeNull();
    expect(repos.replaceAllCalls).toHaveLength(0);
  });

  it("saveSchedule returns null when the row's year belongs to a different teacher, persisting nothing", async () => {
    const repos = fakeRepos({ years: [makeYear({ teacherId: 'other' })] });
    const service = makeService(repos);

    const result = await service.saveSchedule(TEACHER, 'am1', [{ weekday: 1, hours: 2 }]);

    expect(result).toBeNull();
    expect(repos.replaceAllCalls).toHaveLength(0);
  });
});
