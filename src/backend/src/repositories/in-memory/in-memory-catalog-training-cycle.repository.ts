import type {
  CatalogTrainingCycle,
  CatalogTrainingCycleRepository,
} from '../catalog-training-cycle.repository';
import type { CatalogStore } from './catalog-store';

/** In-memory double for `CatalogTrainingCycleRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern").
 * Shares a `CatalogStore` with `InMemoryCatalogModuleRepository` so deleting a cycle can
 * cascade to its modules the same way `ON DELETE CASCADE` does in Postgres. */
export class InMemoryCatalogTrainingCycleRepository implements CatalogTrainingCycleRepository {
  constructor(private readonly store: CatalogStore) {}

  async findAll(): Promise<CatalogTrainingCycle[]> {
    return [...this.store.trainingCycles.values()];
  }

  async findById(id: string): Promise<CatalogTrainingCycle | null> {
    return this.store.trainingCycles.get(id) ?? null;
  }

  async findByName(name: string): Promise<CatalogTrainingCycle | null> {
    return [...this.store.trainingCycles.values()].find((cycle) => cycle.name === name) ?? null;
  }

  async create(name: string): Promise<CatalogTrainingCycle> {
    const cycle: CatalogTrainingCycle = { id: crypto.randomUUID(), name };
    this.store.trainingCycles.set(cycle.id, cycle);
    return cycle;
  }

  async rename(id: string, name: string): Promise<CatalogTrainingCycle> {
    const existing = this.store.trainingCycles.get(id);
    if (!existing) throw new Error(`Catalog training cycle ${id} not found`);

    const updated: CatalogTrainingCycle = { ...existing, name };
    this.store.trainingCycles.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    // Mirrors schema-changes.sql's `catalog_modules.catalog_training_cycle_id ... ON DELETE
    // CASCADE`.
    for (const [moduleId, module] of this.store.modules) {
      if (module.catalogTrainingCycleId === id) this.store.modules.delete(moduleId);
    }
    this.store.trainingCycles.delete(id);
  }
}
