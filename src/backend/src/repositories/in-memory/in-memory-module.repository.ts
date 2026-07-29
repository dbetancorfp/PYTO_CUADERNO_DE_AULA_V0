import type { ReferencingAcademicYear } from '../academic-year-reference';
import type { Module, ModuleRepository, ModuleWithCycleName } from '../module.repository';
import type { ConfiguracionStore } from './configuracion-store';

/** In-memory double for `ModuleRepository` — used in unit tests and `DATA_BACKEND=memory`
 * mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). Shares a
 * `ConfiguracionStore` with the other Configuración in-memory repositories. */
export class InMemoryModuleRepository implements ModuleRepository {
  constructor(private readonly store: ConfiguracionStore) {}

  async findAllForCycle(trainingCycleId: string): Promise<Module[]> {
    return [...this.store.modules.values()].filter((module) => module.trainingCycleId === trainingCycleId);
  }

  async findAllForTeacher(teacherId: string): Promise<ModuleWithCycleName[]> {
    const cyclesById = new Map(
      [...this.store.trainingCycles.values()].filter((cycle) => cycle.teacherId === teacherId).map((c) => [c.id, c]),
    );
    return [...this.store.modules.values()]
      .filter((module) => cyclesById.has(module.trainingCycleId))
      .map((module) => ({
        ...module,
        trainingCycleName: cyclesById.get(module.trainingCycleId)!.name,
      }));
  }

  async findById(id: string): Promise<Module | null> {
    return this.store.modules.get(id) ?? null;
  }

  async findByNameAndCourse(trainingCycleId: string, course: number, name: string): Promise<Module | null> {
    return (
      [...this.store.modules.values()].find(
        (module) => module.trainingCycleId === trainingCycleId && module.course === course && module.name === name,
      ) ?? null
    );
  }

  async create(trainingCycleId: string, course: number, name: string): Promise<Module> {
    const module: Module = { id: crypto.randomUUID(), trainingCycleId, course, name };
    this.store.modules.set(module.id, module);
    return module;
  }

  async update(id: string, changes: Partial<Pick<Module, 'name' | 'course'>>): Promise<Module> {
    const existing = this.store.modules.get(id);
    if (!existing) throw new Error(`Module ${id} not found`);

    const updated: Module = { ...existing, ...changes };
    this.store.modules.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.modules.delete(id);
  }

  async findReferencingAcademicYears(moduleId: string): Promise<ReferencingAcademicYear[]> {
    const referencing: ReferencingAcademicYear[] = [];
    for (const [academicYearId, selectedModuleIds] of this.store.selections) {
      if (!selectedModuleIds.has(moduleId)) continue;
      const year = this.store.academicYears.get(academicYearId);
      if (year) referencing.push({ id: year.id, name: year.name });
    }
    return referencing;
  }
}
