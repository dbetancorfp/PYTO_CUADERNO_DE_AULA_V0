// Domain shape + repository interface for the `training_cycles` table (see
// views/configuracion/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".
import type { ReferencingAcademicYear } from './academic-year-reference';

export type { ReferencingAcademicYear };

export interface TrainingCycle {
  id: string;
  teacherId: string;
  name: string;
}

export interface TrainingCycleRepository {
  findAllForTeacher(teacherId: string): Promise<TrainingCycle[]>;
  findById(teacherId: string, id: string): Promise<TrainingCycle | null>;
  findByName(teacherId: string, name: string): Promise<TrainingCycle | null>;
  create(teacherId: string, name: string): Promise<TrainingCycle>;
  rename(id: string, name: string): Promise<TrainingCycle>;
  delete(id: string): Promise<void>;
  /** Academic years referencing this cycle via any of its modules' selections (see
   * schema-changes.sql's academic_years ⋈ academic_year_modules ⋈ modules join). */
  findReferencingAcademicYears(cycleId: string): Promise<ReferencingAcademicYear[]>;
}
