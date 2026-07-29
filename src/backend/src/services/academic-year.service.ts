// elementId: academic-year-table, academic-year-table-add-button,
// academic-year-delete-blocked-message, module-selection-table, module-selection-save-button
// (business-logic side of UC-04/UC-07, see views/configuracion/use-cases.md).
import { DomainError } from '../errors/domain-error';
import type { AcademicYear, AcademicYearRepository } from '../repositories/academic-year.repository';
import type { AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import type { ModuleRepository } from '../repositories/module.repository';

export class AcademicYearService {
  constructor(
    private readonly academicYearRepository: AcademicYearRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly moduleRepository: ModuleRepository,
  ) {}

  async list(teacherId: string): Promise<AcademicYear[]> {
    return this.academicYearRepository.findAllForTeacher(teacherId);
  }

  /** Never marked current on creation — the teacher marks one current via `setCurrent`. */
  async create(teacherId: string, name: string): Promise<AcademicYear> {
    const existing = await this.academicYearRepository.findByName(teacherId, name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `An academic year named "${name}" already exists`);
    }
    return this.academicYearRepository.create(teacherId, name);
  }

  /** Returns `null` when `id` doesn't match a year owned by `teacherId`. */
  async rename(teacherId: string, id: string, name: string): Promise<AcademicYear | null> {
    const year = await this.academicYearRepository.findById(teacherId, id);
    if (!year) return null;

    const existing = await this.academicYearRepository.findByName(teacherId, name);
    if (existing && existing.id !== id) {
      throw new DomainError('DUPLICATE_NAME', `An academic year named "${name}" already exists`);
    }
    return this.academicYearRepository.rename(id, name);
  }

  /** Returns `null` when `id` doesn't match a year owned by `teacherId`. */
  async setCurrent(teacherId: string, id: string): Promise<AcademicYear | null> {
    const year = await this.academicYearRepository.findById(teacherId, id);
    if (!year) return null;
    return this.academicYearRepository.setCurrent(teacherId, id);
  }

  /** Returns `null` when `id` doesn't match a year owned by `teacherId`. Throws `IS_CURRENT`
   * when it's the year marked current, without deleting. */
  async delete(teacherId: string, id: string): Promise<void | null> {
    const year = await this.academicYearRepository.findById(teacherId, id);
    if (!year) return null;

    if (year.isCurrent) {
      throw new DomainError('IS_CURRENT', 'Cannot delete: this academic year is marked current');
    }
    await this.academicYearRepository.delete(id);
  }

  /** Returns `null` when `id` doesn't match a year owned by `teacherId`. */
  async getSelection(teacherId: string, id: string): Promise<string[] | null> {
    const year = await this.academicYearRepository.findById(teacherId, id);
    if (!year) return null;
    return this.academicYearModuleRepository.findModuleIdsForYear(id);
  }

  /** Returns `null` when `id` doesn't match a year owned by `teacherId`, or when any
   * submitted `moduleIds` entry isn't owned by `teacherId` (see use-cases.md UC-07). */
  async replaceSelection(teacherId: string, id: string, moduleIds: string[]): Promise<string[] | null> {
    const year = await this.academicYearRepository.findById(teacherId, id);
    if (!year) return null;

    const teacherModules = await this.moduleRepository.findAllForTeacher(teacherId);
    const ownedModuleIds = new Set(teacherModules.map((module) => module.id));
    const allOwnedByTeacher = moduleIds.every((moduleId) => ownedModuleIds.has(moduleId));
    if (!allOwnedByTeacher) return null;

    await this.academicYearModuleRepository.replaceSelection(id, moduleIds);
    return moduleIds;
  }
}
