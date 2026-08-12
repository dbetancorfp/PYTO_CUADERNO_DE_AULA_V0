// elementId: schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select,
// schedule-thursday-select, schedule-friday-select, schedule-save-button (business-logic
// side of UC-11, see views/configuracion/use-cases.md). Ownership is checked the same
// two-step way AcademicYearService.removeModule already does: academic_year_modules.id ->
// its academic_year_id -> an academic_years row owned by teacherId. weekday/hours range
// validation (1-5 / 1-3) and duplicate-weekday rejection happen at the route layer (see
// routes/academic-year-module.routes.ts), not here — this service trusts its input.
//
// 2026-08-11: also takes a CalendarioHorarioSeeder (mirrors AcademicYearService's own
// CalendarioModuloSeeder dependency) — see "calendario_horario side effect" in
// academic-year-module-schedule.service.test.ts for views/calendario/use-cases.md's UC-12
// (the saveSchedule side effect that regenerates calendario_horario). 2026-08-12: the
// seeder no longer needs this academic year's startYear (see calendario-horario.service.ts's
// bugfix — the walk range now comes from the módulo's own calendario_modulo Inicio/Fin
// curso rows instead), so the ownership check reverts to a plain boolean.
import type {
  AcademicYearModuleScheduleEntry,
  AcademicYearModuleScheduleRepository,
} from '../repositories/academic-year-module-schedule.repository';
import type { AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import type { AcademicYearRepository } from '../repositories/academic-year.repository';
import type { CalendarioHorarioSeeder } from './calendario-horario.service';

export class AcademicYearModuleScheduleService {
  constructor(
    private readonly scheduleRepository: AcademicYearModuleScheduleRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly academicYearRepository: AcademicYearRepository,
    private readonly calendarioHorarioSeeder: CalendarioHorarioSeeder,
  ) {}

  /** Returns `null` when the `academic_year_modules` row doesn't exist, or its academic year
   * isn't owned by this teacher. */
  async getSchedule(teacherId: string, academicYearModuleId: string): Promise<AcademicYearModuleScheduleEntry[] | null> {
    const owned = await this.isOwnedByTeacher(teacherId, academicYearModuleId);
    if (!owned) return null;

    return this.scheduleRepository.findByModuleId(academicYearModuleId);
  }

  /** Returns `null` when the `academic_year_modules` row doesn't exist, or its academic year
   * isn't owned by this teacher — persists nothing and never triggers the seeder in that
   * case. Otherwise replaces the full weekly schedule (see
   * AcademicYearModuleScheduleRepository.replaceAll) and, on success, regenerates
   * `calendario_horario` for this módulo (UC-12) via `calendarioHorarioSeeder`. */
  async saveSchedule(
    teacherId: string,
    academicYearModuleId: string,
    entries: AcademicYearModuleScheduleEntry[],
  ): Promise<AcademicYearModuleScheduleEntry[] | null> {
    const owned = await this.isOwnedByTeacher(teacherId, academicYearModuleId);
    if (!owned) return null;

    const result = await this.scheduleRepository.replaceAll(academicYearModuleId, entries);
    await this.calendarioHorarioSeeder.seedForModule(academicYearModuleId, entries);
    return result;
  }

  private async isOwnedByTeacher(teacherId: string, academicYearModuleId: string): Promise<boolean> {
    const ref = await this.academicYearModuleRepository.findById(academicYearModuleId);
    if (!ref) return false;

    const year = await this.academicYearRepository.findById(teacherId, ref.academicYearId);
    return year !== null;
  }
}
