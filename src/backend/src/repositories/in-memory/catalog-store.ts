// Shared in-process store backing InMemoryCatalogTrainingCycleRepository and
// InMemoryCatalogModuleRepository (repositories/in-memory/) — the two share it purely so
// deleting a cycle can cascade-delete its modules, mirroring `catalog_modules`' `ON DELETE
// CASCADE` FK to `catalog_training_cycles` (see views/configuracion/schema-changes.sql).
// Unlike the old (dropped) ConfiguracionStore, there are no cross-table dependency checks
// here — nothing references either table. One instance lives for the lifetime of the
// Express app (see app.ts's composition root).
import type { CatalogModule } from '../catalog-module.repository';
import type { CatalogTrainingCycle } from '../catalog-training-cycle.repository';

export class CatalogStore {
  readonly trainingCycles = new Map<string, CatalogTrainingCycle>();
  readonly modules = new Map<string, CatalogModule>();
}
