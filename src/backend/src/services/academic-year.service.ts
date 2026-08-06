// elementId: academic-year-table, academic-year-table-add-button,
// training-cycle-table-add-cycle-button, module-table, module-selection-save-button
// (business-logic side of UC-06/UC-07/UC-08/UC-09, see views/configuracion/use-cases.md).
// academic_years/academic_year_modules are per-teacher, built on top of the shared, global
// catalog_cycles/catalog_modules catalog (see views/configuracion/schema-changes.sql) —
// catalogModuleRepository is only ever used to validate moduleIds exist before inserting.
import { DomainError } from '../errors/domain-error';
import type { AcademicYear, AcademicYearRepository } from '../repositories/academic-year.repository';
import type {
  AcademicYearModuleDetail,
  AcademicYearModuleRepository,
} from '../repositories/academic-year-module.repository';
import type { CatalogModuleRepository } from '../repositories/catalog-module.repository';

export interface AcademicYearUpdate {
  startYear?: number;
  isCurrent?: boolean;
}

export interface CreateWithSelectionResult {
  academicYear: AcademicYear;
  moduleCount: number;
}

export interface ExtendSelectionResult {
  addedCount: number;
}

export class AcademicYearService {
  constructor(
    private readonly academicYearRepository: AcademicYearRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
    private readonly catalogModuleRepository: CatalogModuleRepository,
  ) {}

  async list(teacherId: string): Promise<AcademicYear[]> {
    return this.academicYearRepository.findAllForTeacher(teacherId);
  }

  /** Returns `null` when `id` doesn't match an academic year owned by this teacher. Throws
   * `DUPLICATE_NAME` when `changes.startYear` collides with another row for this teacher. */
  async update(teacherId: string, id: string, changes: AcademicYearUpdate): Promise<AcademicYear | null> {
    const existing = await this.academicYearRepository.findById(teacherId, id);
    if (!existing) return null;

    if (changes.startYear !== undefined && changes.startYear !== existing.startYear) {
      const conflict = await this.academicYearRepository.findByStartYear(teacherId, changes.startYear);
      if (conflict && conflict.id !== id) {
        throw new DomainError('DUPLICATE_NAME', `An academic year starting in ${changes.startYear} already exists`);
      }
    }

    let result = existing;
    if (changes.startYear !== undefined) {
      result = await this.academicYearRepository.rename(id, changes.startYear);
    }
    if (changes.isCurrent === true) {
      result = await this.academicYearRepository.markCurrent(teacherId, id);
    }
    return result;
  }

  /** Returns `null` when `id` doesn't match an academic year owned by this teacher. Throws
   * `HAS_DEPENDENTS` when the year still has módulos assigned. */
  async delete(teacherId: string, id: string): Promise<void | null> {
    const existing = await this.academicYearRepository.findById(teacherId, id);
    if (!existing) return null;

    const dependentCount = await this.academicYearModuleRepository.countForYear(id);
    if (dependentCount > 0) {
      throw new DomainError('HAS_DEPENDENTS', 'This academic year still has módulos assigned');
    }

    await this.academicYearRepository.delete(id);
  }

  /** Returns `null` when `id` doesn't match an academic year owned by this teacher. */
  async listModules(teacherId: string, id: string): Promise<AcademicYearModuleDetail[] | null> {
    const existing = await this.academicYearRepository.findById(teacherId, id);
    if (!existing) return null;

    return this.academicYearModuleRepository.findAllForYear(id);
  }

  /** Returns `null` when the `academic_year_modules` row doesn't exist, or its academic
   * year isn't owned by this teacher. */
  async removeModule(teacherId: string, academicYearModuleId: string): Promise<void | null> {
    const ref = await this.academicYearModuleRepository.findById(academicYearModuleId);
    if (!ref) return null;

    const year = await this.academicYearRepository.findById(teacherId, ref.academicYearId);
    if (!year) return null;

    await this.academicYearModuleRepository.delete(academicYearModuleId);
  }

  /** Throws `DUPLICATE_NAME` when `startYear` already exists for this teacher. Returns
   * `null` when any `moduleIds` entry doesn't exist in the catalog. `moduleIds` may be
   * empty. */
  async createWithSelection(
    teacherId: string,
    startYear: number,
    moduleIds: string[],
  ): Promise<CreateWithSelectionResult | null> {
    const conflict = await this.academicYearRepository.findByStartYear(teacherId, startYear);
    if (conflict) {
      throw new DomainError('DUPLICATE_NAME', `An academic year starting in ${startYear} already exists`);
    }

    const allModulesExist = await this.allModulesExist(moduleIds);
    if (!allModulesExist) return null;

    const academicYear = await this.academicYearRepository.create(teacherId, startYear);
    const moduleCount = await this.academicYearModuleRepository.createMany(academicYear.id, moduleIds);
    return { academicYear, moduleCount };
  }

  /** Returns `null` when `academicYearId` isn't owned by this teacher, or any `moduleIds`
   * entry doesn't exist in the catalog. Never touches `startYear`/`isCurrent`. */
  async extendSelection(
    teacherId: string,
    academicYearId: string,
    moduleIds: string[],
  ): Promise<ExtendSelectionResult | null> {
    const year = await this.academicYearRepository.findById(teacherId, academicYearId);
    if (!year) return null;

    const allModulesExist = await this.allModulesExist(moduleIds);
    if (!allModulesExist) return null;

    const addedCount = await this.academicYearModuleRepository.createMany(academicYearId, moduleIds);
    return { addedCount };
  }

  private async allModulesExist(moduleIds: string[]): Promise<boolean> {
    for (const moduleId of moduleIds) {
      const module = await this.catalogModuleRepository.findById(moduleId);
      if (!module) return false;
    }
    return true;
  }
}
