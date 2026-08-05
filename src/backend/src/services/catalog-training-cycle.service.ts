// elementId: catalog-training-cycle-table, catalog-training-cycle-table-add-button
// (business-logic side of UC-04, see views/configuracion/use-cases.md). Shared, global
// catalog — no per-teacher scoping (official BOC curricula are the same for every teacher,
// see schema-changes.sql's header comment). No dependency-blocked deletion — catalog_modules'
// FK to catalog_cycles is ON DELETE CASCADE, and nothing else references this catalog at all
// (unlike the old, now-dropped TrainingCycleService).
import { DomainError } from '../errors/domain-error';
import type {
  CatalogTrainingCycle,
  CatalogTrainingCycleRepository,
} from '../repositories/catalog-training-cycle.repository';

export class CatalogTrainingCycleService {
  constructor(private readonly catalogTrainingCycleRepository: CatalogTrainingCycleRepository) {}

  async list(): Promise<CatalogTrainingCycle[]> {
    return this.catalogTrainingCycleRepository.findAll();
  }

  async create(name: string): Promise<CatalogTrainingCycle> {
    const existing = await this.catalogTrainingCycleRepository.findByName(name);
    if (existing) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.catalogTrainingCycleRepository.create(name);
  }

  /** Returns `null` when `id` doesn't match a cycle. */
  async rename(id: string, name: string): Promise<CatalogTrainingCycle | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(id);
    if (!cycle) return null;

    const existing = await this.catalogTrainingCycleRepository.findByName(name);
    if (existing && existing.id !== id) {
      throw new DomainError('DUPLICATE_NAME', `A training cycle named "${name}" already exists`);
    }
    return this.catalogTrainingCycleRepository.rename(id, name);
  }

  /** Returns `null` when `id` doesn't match a cycle. Deletion is always unconditional — see
   * this file's header comment. */
  async delete(id: string): Promise<void | null> {
    const cycle = await this.catalogTrainingCycleRepository.findById(id);
    if (!cycle) return null;

    await this.catalogTrainingCycleRepository.delete(id);
  }
}
