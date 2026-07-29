import type {
  ReferencingAcademicYear,
  TrainingCycle,
  TrainingCycleRepository,
} from '../training-cycle.repository';
import type { ConfiguracionStore } from './configuracion-store';

/** In-memory double for `TrainingCycleRepository` — used in unit tests and
 * `DATA_BACKEND=memory` mode (see tecnologias/tecnologia_bbdd.md "Data access pattern").
 * Shares a `ConfiguracionStore` with the other Configuración in-memory repositories so
 * cross-table dependency checks (this cycle's modules referenced by an academic year) work
 * the same way the Postgres implementation's joins do. */
export class InMemoryTrainingCycleRepository implements TrainingCycleRepository {
  constructor(private readonly store: ConfiguracionStore) {}

  async findAllForTeacher(teacherId: string): Promise<TrainingCycle[]> {
    return [...this.store.trainingCycles.values()].filter((cycle) => cycle.teacherId === teacherId);
  }

  async findById(teacherId: string, id: string): Promise<TrainingCycle | null> {
    const cycle = this.store.trainingCycles.get(id);
    return cycle && cycle.teacherId === teacherId ? cycle : null;
  }

  async findByName(teacherId: string, name: string): Promise<TrainingCycle | null> {
    return (
      [...this.store.trainingCycles.values()].find(
        (cycle) => cycle.teacherId === teacherId && cycle.name === name,
      ) ?? null
    );
  }

  async create(teacherId: string, name: string): Promise<TrainingCycle> {
    const cycle: TrainingCycle = { id: crypto.randomUUID(), teacherId, name };
    this.store.trainingCycles.set(cycle.id, cycle);
    return cycle;
  }

  async rename(id: string, name: string): Promise<TrainingCycle> {
    const existing = this.store.trainingCycles.get(id);
    if (!existing) throw new Error(`Training cycle ${id} not found`);

    const updated: TrainingCycle = { ...existing, name };
    this.store.trainingCycles.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    // Mirrors schema-changes.sql's `modules.training_cycle_id ... ON DELETE CASCADE` — the
    // service already verified no module of this cycle is referenced before calling delete.
    for (const [moduleId, module] of this.store.modules) {
      if (module.trainingCycleId === id) this.store.modules.delete(moduleId);
    }
    this.store.trainingCycles.delete(id);
  }

  async findReferencingAcademicYears(cycleId: string): Promise<ReferencingAcademicYear[]> {
    const moduleIds = new Set(
      [...this.store.modules.values()].filter((module) => module.trainingCycleId === cycleId).map((m) => m.id),
    );
    const referencing = new Map<string, ReferencingAcademicYear>();
    for (const [academicYearId, selectedModuleIds] of this.store.selections) {
      const isReferenced = [...selectedModuleIds].some((moduleId) => moduleIds.has(moduleId));
      if (!isReferenced) continue;
      const year = this.store.academicYears.get(academicYearId);
      if (year) referencing.set(year.id, { id: year.id, name: year.name });
    }
    return [...referencing.values()];
  }
}
