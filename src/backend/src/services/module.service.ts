// elementId: module-cycle-select, module-table, module-table-add-button,
// module-delete-blocked-message, module-edit-confirm-modal (business-logic side of UC-06,
// see views/configuracion/use-cases.md).
import { DomainError } from '../errors/domain-error';
import type { Module, ModuleRepository, ModuleWithCycleName } from '../repositories/module.repository';
import type { TrainingCycleRepository } from '../repositories/training-cycle.repository';

export class ModuleService {
  constructor(
    private readonly moduleRepository: ModuleRepository,
    private readonly trainingCycleRepository: TrainingCycleRepository,
  ) {}

  /** Returns `null` when `cycleId` doesn't match a cycle owned by `teacherId`. */
  async listForCycle(teacherId: string, cycleId: string): Promise<Module[] | null> {
    const cycle = await this.trainingCycleRepository.findById(teacherId, cycleId);
    if (!cycle) return null;
    return this.moduleRepository.findAllForCycle(cycleId);
  }

  /** Every module across every one of the teacher's cycles — the flat shape
   * `module-selection-table` needs (see api-contracts.md's GET /api/modules). */
  async listForTeacher(teacherId: string): Promise<ModuleWithCycleName[]> {
    return this.moduleRepository.findAllForTeacher(teacherId);
  }

  /** Returns `null` when `cycleId` doesn't match a cycle owned by `teacherId`. */
  async create(teacherId: string, cycleId: string, name: string, course: number): Promise<Module | null> {
    const cycle = await this.trainingCycleRepository.findById(teacherId, cycleId);
    if (!cycle) return null;

    const existing = await this.moduleRepository.findByNameAndCourse(cycleId, course, name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `A module named "${name}" already exists for this course in this cycle`);
    }
    return this.moduleRepository.create(cycleId, course, name);
  }

  /**
   * Returns `null` when `moduleId` doesn't match a module owned by `teacherId` (via its
   * cycle). If the module is referenced by one or more academic years and `confirm` isn't
   * `true`, throws `HAS_DEPENDENTS` naming them, without saving (see use-cases.md UC-06 A5).
   */
  async update(
    teacherId: string,
    moduleId: string,
    changes: Partial<Pick<Module, 'name' | 'course'>>,
    confirm: boolean,
  ): Promise<Module | null> {
    const module = await this.moduleRepository.findById(moduleId);
    if (!module) return null;

    const cycle = await this.trainingCycleRepository.findById(teacherId, module.trainingCycleId);
    if (!cycle) return null;

    if (changes.name !== undefined || changes.course !== undefined) {
      const name = changes.name ?? module.name;
      const course = changes.course ?? module.course;
      const existing = await this.moduleRepository.findByNameAndCourse(module.trainingCycleId, course, name);
      if (existing && existing.id !== moduleId) {
        throw new DomainError('DUPLICATE_NAME', `A module named "${name}" already exists for this course in this cycle`);
      }
    }

    const referencingAcademicYears = await this.moduleRepository.findReferencingAcademicYears(moduleId);
    if (referencingAcademicYears.length > 0 && !confirm) {
      throw new DomainError(
        'HAS_DEPENDENTS',
        'This module is referenced by one or more academic years — confirm to proceed',
        { academicYears: referencingAcademicYears },
      );
    }

    return this.moduleRepository.update(moduleId, changes);
  }

  /** Returns `null` when `moduleId` doesn't match a module owned by `teacherId` (via its
   * cycle). Throws `HAS_DEPENDENTS` when referenced by an academic year, without deleting. */
  async delete(teacherId: string, moduleId: string): Promise<void | null> {
    const module = await this.moduleRepository.findById(moduleId);
    if (!module) return null;

    const cycle = await this.trainingCycleRepository.findById(teacherId, module.trainingCycleId);
    if (!cycle) return null;

    const referencingAcademicYears = await this.moduleRepository.findReferencingAcademicYears(moduleId);
    if (referencingAcademicYears.length > 0) {
      throw new DomainError(
        'HAS_DEPENDENTS',
        'Cannot delete: this module is referenced by one or more academic years',
        { academicYears: referencingAcademicYears },
      );
    }
    await this.moduleRepository.delete(moduleId);
  }
}
