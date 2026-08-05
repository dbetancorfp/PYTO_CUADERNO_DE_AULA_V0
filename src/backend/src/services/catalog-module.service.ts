// elementId: catalog-module-table, catalog-module-table-add-button (business-logic side of
// UC-05, see views/configuracion/use-cases.md). No dependency-blocked deletion, no confirm
// flow — nothing references a catalog module (unlike the old, now-dropped ModuleService).
import { DomainError } from '../errors/domain-error';
import type { CatalogModule, CatalogModuleRepository } from '../repositories/catalog-module.repository';
import type { CatalogTrainingCycleRepository } from '../repositories/catalog-training-cycle.repository';

export class CatalogModuleService {
  constructor(
    private readonly catalogModuleRepository: CatalogModuleRepository,
    private readonly catalogTrainingCycleRepository: CatalogTrainingCycleRepository,
  ) {}

  /** Returns `null` when `cycleId` doesn't match a cycle owned by `teacherId`. */
  async listForCycle(teacherId: string, cycleId: string): Promise<CatalogModule[] | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(teacherId, cycleId);
    if (!cycle) return null;
    return this.catalogModuleRepository.findAllForCycle(cycleId);
  }

  /** Returns `null` when `cycleId` doesn't match a cycle owned by `teacherId`. */
  async create(teacherId: string, cycleId: string, name: string, course: number): Promise<CatalogModule | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(teacherId, cycleId);
    if (!cycle) return null;

    const existing = await this.catalogModuleRepository.findByNameAndCourse(cycleId, course, name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `A module named "${name}" already exists for this course in this cycle`);
    }
    return this.catalogModuleRepository.create(cycleId, course, name);
  }

  /** Returns `null` when `moduleId` doesn't match a module owned by `teacherId` (via its
   * cycle). Always saves immediately — no confirmation step, no dependency check. */
  async update(
    teacherId: string,
    moduleId: string,
    changes: Partial<Pick<CatalogModule, 'name' | 'course'>>,
  ): Promise<CatalogModule | null> {
    const module = await this.catalogModuleRepository.findById(moduleId);
    if (!module) return null;

    const cycle = await this.catalogTrainingCycleRepository.findById(teacherId, module.catalogTrainingCycleId);
    if (!cycle) return null;

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

  /** Returns `null` when `moduleId` doesn't match a module owned by `teacherId` (via its
   * cycle). Deletion is always unconditional. */
  async delete(teacherId: string, moduleId: string): Promise<void | null> {
    const module = await this.catalogModuleRepository.findById(moduleId);
    if (!module) return null;

    const cycle = await this.catalogTrainingCycleRepository.findById(teacherId, module.catalogTrainingCycleId);
    if (!cycle) return null;

    await this.catalogModuleRepository.delete(moduleId);
  }
}
