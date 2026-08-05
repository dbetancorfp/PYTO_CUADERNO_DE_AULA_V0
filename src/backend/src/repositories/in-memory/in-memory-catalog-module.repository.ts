import type { CatalogModule, CatalogModuleRepository } from '../catalog-module.repository';
import type { CatalogStore } from './catalog-store';

/** In-memory double for `CatalogModuleRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern").
 * Shares a `CatalogStore` with `InMemoryCatalogTrainingCycleRepository`. */
export class InMemoryCatalogModuleRepository implements CatalogModuleRepository {
  constructor(private readonly store: CatalogStore) {}

  async findAllForCycle(catalogTrainingCycleId: string): Promise<CatalogModule[]> {
    return [...this.store.modules.values()].filter(
      (module) => module.catalogTrainingCycleId === catalogTrainingCycleId,
    );
  }

  async findById(id: string): Promise<CatalogModule | null> {
    return this.store.modules.get(id) ?? null;
  }

  async findByNameAndCourse(
    catalogTrainingCycleId: string,
    course: number,
    name: string,
  ): Promise<CatalogModule | null> {
    return (
      [...this.store.modules.values()].find(
        (module) =>
          module.catalogTrainingCycleId === catalogTrainingCycleId &&
          module.course === course &&
          module.name === name,
      ) ?? null
    );
  }

  async create(catalogTrainingCycleId: string, course: number, name: string): Promise<CatalogModule> {
    const module: CatalogModule = { id: crypto.randomUUID(), catalogTrainingCycleId, course, name };
    this.store.modules.set(module.id, module);
    return module;
  }

  async update(id: string, changes: Partial<Pick<CatalogModule, 'name' | 'course'>>): Promise<CatalogModule> {
    const existing = this.store.modules.get(id);
    if (!existing) throw new Error(`Catalog module ${id} not found`);

    const updated: CatalogModule = { ...existing, ...changes };
    this.store.modules.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.modules.delete(id);
  }
}
