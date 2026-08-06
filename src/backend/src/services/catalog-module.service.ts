// elementId: catalog-module-table, catalog-module-table-add-button (business-logic side of
// UC-05, see views/configuracion/use-cases.md). No confirm flow — editing always saves
// immediately. Deletion IS dependency-blocked as of the 2026-08-06 fix for #4: a catalog
// módulo still assigned to some academic year (academic_year_modules) can't be deleted —
// academic_year_modules_catalog_module_id_fkey has no ON DELETE CASCADE, so an unblocked
// delete would 500 instead of the graceful 409 this now returns.
import { DomainError } from '../errors/domain-error';
import type { AcademicYearModuleRepository } from '../repositories/academic-year-module.repository';
import type { CatalogModule, CatalogModuleRepository } from '../repositories/catalog-module.repository';
import type { CatalogTrainingCycleRepository } from '../repositories/catalog-training-cycle.repository';

export class CatalogModuleService {
  constructor(
    private readonly catalogModuleRepository: CatalogModuleRepository,
    private readonly catalogTrainingCycleRepository: CatalogTrainingCycleRepository,
    private readonly academicYearModuleRepository: AcademicYearModuleRepository,
  ) {}

  /** Returns `null` when `cycleId` doesn't match a cycle. */
  async listForCycle(cycleId: string): Promise<CatalogModule[] | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(cycleId);
    if (!cycle) return null;
    return this.catalogModuleRepository.findAllForCycle(cycleId);
  }

  /** Returns `null` when `cycleId` doesn't match a cycle. */
  async create(cycleId: string, name: string, course: number): Promise<CatalogModule | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(cycleId);
    if (!cycle) return null;

    const existing = await this.catalogModuleRepository.findByNameAndCourse(cycleId, course, name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `A module named "${name}" already exists for this course in this cycle`);
    }
    return this.catalogModuleRepository.create(cycleId, course, name);
  }

  /** Returns `null` when `moduleId` doesn't match a module. Always saves immediately — no
   * confirmation step, no dependency check. */
  async update(
    moduleId: string,
    changes: Partial<Pick<CatalogModule, 'name' | 'course'>>,
  ): Promise<CatalogModule | null> {
    const module = await this.catalogModuleRepository.findById(moduleId);
    if (!module) return null;

    if (changes.name !== undefined || changes.course !== undefined) {
      const name = changes.name ?? module.name;
      const course = changes.course ?? module.course;
      const existing = await this.catalogModuleRepository.findByNameAndCourse(module.catalogTrainingCycleId, course, name);
      if (existing && existing.id !== moduleId) {
        throw new DomainError('DUPLICATE_NAME', `A module named "${name}" already exists for this course in this cycle`);
      }
    }

    return this.catalogModuleRepository.update(moduleId, changes);
  }

  /** Returns `null` when `moduleId` doesn't match a module. Throws `HAS_DEPENDENTS` when
   * some academic year still has this módulo assigned. */
  async delete(moduleId: string): Promise<void | null> {
    const module = await this.catalogModuleRepository.findById(moduleId);
    if (!module) return null;

    const stillAssigned = await this.academicYearModuleRepository.existsForCatalogModule(moduleId);
    if (stillAssigned) {
      throw new DomainError('HAS_DEPENDENTS', 'This módulo is still assigned to an academic year');
    }

    await this.catalogModuleRepository.delete(moduleId);
  }
}
