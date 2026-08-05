// elementId: catalog-training-cycle-table, catalog-training-cycle-table-add-button
// (business-logic side of UC-04, see views/configuracion/use-cases.md). No
// dependency-blocked deletion — catalog_modules' FK to catalog_training_cycles is ON DELETE
// CASCADE, and nothing references this catalog at all (unlike the old, now-dropped
// TrainingCycleService).
import { DomainError } from '../errors/domain-error';
import type {
  CatalogTrainingCycle,
  CatalogTrainingCycleRepository,
} from '../repositories/catalog-training-cycle.repository';

export class CatalogTrainingCycleService {
  constructor(private readonly catalogTrainingCycleRepository: CatalogTrainingCycleRepository) {}

  async list(teacherId: string): Promise<CatalogTrainingCycle[]> {
    return this.catalogTrainingCycleRepository.findAllForTeacher(teacherId);
  }

  async create(teacherId: string, name: string): Promise<CatalogTrainingCycle> {
    const existing = await this.catalogTrainingCycleRepository.findByName(teacherId, name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.catalogTrainingCycleRepository.create(teacherId, name);
  }

  /** Returns `null` when `id` doesn't match a cycle owned by `teacherId`. */
  async rename(teacherId: string, id: string, name: string): Promise<CatalogTrainingCycle | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(teacherId, id);
    if (!cycle) return null;

    const existing = await this.catalogTrainingCycleRepository.findByName(teacherId, name);
    if (existing && existing.id !== id) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.catalogTrainingCycleRepository.rename(id, name);
  }

  /** Returns `null` when `id` doesn't match a cycle owned by `teacherId`. Deletion is always
   * unconditional — see this file's header comment. */
  async delete(teacherId: string, id: string): Promise<void | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(teacherId, id);
    if (!cycle) return null;

    await this.catalogTrainingCycleRepository.delete(id);
  }
}
