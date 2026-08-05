// Domain shape + repository interface for the `catalog_modules` table (see
// views/configuracion/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern". Standalone catalog, no relation to
// anything year-related — unlike the old (dropped) ModuleRepository, there is no
// findReferencingAcademicYears here, and no findAllForTeacher flat cross-cycle listing
// either (api-contracts.md defines no such endpoint for this catalog).

export interface CatalogModule {
  id: string;
  catalogTrainingCycleId: string;
  course: number;
  name: string;
}

export interface CatalogModuleRepository {
  findAllForCycle(catalogTrainingCycleId: string): Promise<CatalogModule[]>;
  findById(id: string): Promise<CatalogModule | null>;
  findByNameAndCourse(catalogTrainingCycleId: string, course: number, name: string): Promise<CatalogModule | null>;
  create(catalogTrainingCycleId: string, course: number, name: string): Promise<CatalogModule>;
  update(id: string, changes: Partial<Pick<CatalogModule, 'name' | 'course'>>): Promise<CatalogModule>;
  delete(id: string): Promise<void>;
}
