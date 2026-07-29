// elementId: training-cycle-table, training-cycle-table-add-button,
// training-cycle-delete-blocked-message (business-logic side of UC-05, see
// views/configuracion/use-cases.md).
import { DomainError } from '../errors/domain-error';
import type { TrainingCycle, TrainingCycleRepository } from '../repositories/training-cycle.repository';

export class TrainingCycleService {
  constructor(private readonly trainingCycleRepository: TrainingCycleRepository) {}

  async list(teacherId: string): Promise<TrainingCycle[]> {
    return this.trainingCycleRepository.findAllForTeacher(teacherId);
  }

  async create(teacherId: string, name: string): Promise<TrainingCycle> {
    const existing = await this.trainingCycleRepository.findByName(teacherId, name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.trainingCycleRepository.create(teacherId, name);
  }

  /** Returns `null` when `id` doesn't match a cycle owned by `teacherId`. */
  async rename(teacherId: string, id: string, name: string): Promise<TrainingCycle | null> {
    const cycle = await this.trainingCycleRepository.findById(teacherId, id);
    if (!cycle) return null;

    const existing = await this.trainingCycleRepository.findByName(teacherId, name);
    if (existing && existing.id !== id) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.trainingCycleRepository.rename(id, name);
  }

  /** Returns `null` when `id` doesn't match a cycle owned by `teacherId`. */
  async delete(teacherId: string, id: string): Promise<void | null> {
    const cycle = await this.trainingCycleRepository.findById(teacherId, id);
    if (!cycle) return null;

    const referencingAcademicYears = await this.trainingCycleRepository.findReferencingAcademicYears(id);
    if (referencingAcademicYears.length > 0) {
      throw new DomainError(
        'HAS_DEPENDENTS',
        'Cannot delete: one or more of this cycle\'s modules are referenced by an academic year',
        { academicYears: referencingAcademicYears },
      );
    }
    await this.trainingCycleRepository.delete(id);
  }
}
