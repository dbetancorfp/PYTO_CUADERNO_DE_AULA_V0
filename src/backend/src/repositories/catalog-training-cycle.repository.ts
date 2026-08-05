// Domain shape + repository interface for the `catalog_training_cycles` table (see
// views/configuracion/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern". Standalone catalog, no relation to
// anything year-related — unlike the old (dropped) TrainingCycleRepository, there is no
// findReferencingAcademicYears here.

export interface CatalogTrainingCycle {
  id: string;
  teacherId: string;
  name: string;
}

export interface CatalogTrainingCycleRepository {
  findAllForTeacher(teacherId: string): Promise<CatalogTrainingCycle[]>;
  findById(teacherId: string, id: string): Promise<CatalogTrainingCycle | null>;
  findByName(teacherId: string, name: string): Promise<CatalogTrainingCycle | null>;
  create(teacherId: string, name: string): Promise<CatalogTrainingCycle>;
  rename(id: string, name: string): Promise<CatalogTrainingCycle>;
  delete(id: string): Promise<void>;
}
