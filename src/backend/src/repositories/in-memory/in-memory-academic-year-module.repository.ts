import type {
  AcademicYearModuleDetail,
  AcademicYearModuleRef,
  AcademicYearModuleRepository,
} from '../academic-year-module.repository';
import type { AcademicYearStore } from './academic-year-store';
import type { CatalogStore } from './catalog-store';

/** In-memory double for `AcademicYearModuleRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern").
 * Reads the shared `CatalogStore` (read-only) to build the same joined
 * `AcademicYearModuleDetail` shape `PgAcademicYearModuleRepository` produces via SQL. */
export class InMemoryAcademicYearModuleRepository implements AcademicYearModuleRepository {
  constructor(
    private readonly store: AcademicYearStore,
    private readonly catalogStore: CatalogStore,
  ) {}

  async findAllForYear(academicYearId: string): Promise<AcademicYearModuleDetail[]> {
    return [...this.store.academicYearModules.values()]
      .filter((ref) => ref.academicYearId === academicYearId)
      .map((ref) => this.toDetail(ref));
  }

  async findById(id: string): Promise<AcademicYearModuleRef | null> {
    return this.store.academicYearModules.get(id) ?? null;
  }

  async countForYear(academicYearId: string): Promise<number> {
    return [...this.store.academicYearModules.values()].filter((ref) => ref.academicYearId === academicYearId).length;
  }

  async createMany(academicYearId: string, catalogModuleIds: string[]): Promise<number> {
    let insertedCount = 0;
    for (const catalogModuleId of catalogModuleIds) {
      const alreadyAssigned = [...this.store.academicYearModules.values()].some(
        (ref) => ref.academicYearId === academicYearId && ref.catalogModuleId === catalogModuleId,
      );
      if (alreadyAssigned) continue;

      const ref: AcademicYearModuleRef = { id: crypto.randomUUID(), academicYearId, catalogModuleId };
      this.store.academicYearModules.set(ref.id, ref);
      insertedCount += 1;
    }
    return insertedCount;
  }

  async delete(id: string): Promise<void> {
    this.store.academicYearModules.delete(id);
  }

  async existsForCatalogModule(catalogModuleId: string): Promise<boolean> {
    return [...this.store.academicYearModules.values()].some((ref) => ref.catalogModuleId === catalogModuleId);
  }

  async existsForCatalogCycle(catalogTrainingCycleId: string): Promise<boolean> {
    return [...this.store.academicYearModules.values()].some((ref) => {
      const catalogModule = this.catalogStore.modules.get(ref.catalogModuleId);
      return catalogModule?.catalogTrainingCycleId === catalogTrainingCycleId;
    });
  }

  private toDetail(ref: AcademicYearModuleRef): AcademicYearModuleDetail {
    const catalogModule = this.catalogStore.modules.get(ref.catalogModuleId);
    if (!catalogModule) throw new Error(`Catalog module ${ref.catalogModuleId} not found`);

    const catalogTrainingCycle = this.catalogStore.trainingCycles.get(catalogModule.catalogTrainingCycleId);
    if (!catalogTrainingCycle) throw new Error(`Catalog training cycle ${catalogModule.catalogTrainingCycleId} not found`);

    return {
      id: ref.id,
      catalogModuleId: catalogModule.id,
      catalogTrainingCycleId: catalogTrainingCycle.id,
      catalogTrainingCycleName: catalogTrainingCycle.name,
      course: catalogModule.course,
      name: catalogModule.name,
    };
  }
}
