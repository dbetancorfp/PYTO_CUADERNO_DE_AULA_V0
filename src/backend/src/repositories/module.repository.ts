// Domain shape + repository interface for the `modules` table (see
// views/configuracion/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".
import type { ReferencingAcademicYear } from './academic-year-reference';

export interface Module {
  id: string;
  trainingCycleId: string;
  course: number;
  name: string;
}

/** `Module` plus its owning cycle's name — the flat, cross-cycle shape `GET /api/modules`
 * needs for `module-selection-table` (see api-contracts.md). */
export interface ModuleWithCycleName extends Module {
  trainingCycleName: string;
}

export interface ModuleRepository {
  findAllForCycle(trainingCycleId: string): Promise<Module[]>;
  /** Every module across every one of the teacher's cycles, joined with the cycle's name. */
  findAllForTeacher(teacherId: string): Promise<ModuleWithCycleName[]>;
  findById(id: string): Promise<Module | null>;
  findByNameAndCourse(trainingCycleId: string, course: number, name: string): Promise<Module | null>;
  create(trainingCycleId: string, course: number, name: string): Promise<Module>;
  update(id: string, changes: Partial<Pick<Module, 'name' | 'course'>>): Promise<Module>;
  delete(id: string): Promise<void>;
  /** Academic years whose selection includes this module (see
   * api-contracts.md's HAS_DEPENDENTS error body). */
  findReferencingAcademicYears(moduleId: string): Promise<ReferencingAcademicYear[]>;
}
