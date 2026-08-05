// Domain shape + repository interface for the `catalog_cycles` table (see
// views/configuracion/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern". Standalone, shared catalog — no
// relation to anything year-related and no relation to `users` either (official BOC
// curricula are the same for every teacher, see schema-changes.sql's header comment) —
// unlike the old (dropped) TrainingCycleRepository, there is no findReferencingAcademicYears
// here.

export interface CatalogTrainingCycle {
  id: string;
  name: string;
}

export interface CatalogTrainingCycleRepository {
  findAll(): Promise<CatalogTrainingCycle[]>;
  findById(id: string): Promise<CatalogTrainingCycle | null>;
  findByName(name: string): Promise<CatalogTrainingCycle | null>;
  create(name: string): Promise<CatalogTrainingCycle>;
  rename(id: string, name: string): Promise<CatalogTrainingCycle>;
  delete(id: string): Promise<void>;
}
