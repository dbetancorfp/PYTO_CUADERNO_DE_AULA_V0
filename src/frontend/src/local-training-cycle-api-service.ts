// Local, in-memory-only `TrainingCycleApiService` implementation, wired into `main.ts` at
// bootstrap for Año académico — replaces `http-training-cycle-api-service.ts` (removed
// 2026-08-04, see `local-academic-year-store.ts`'s header comment). No `fetch` call
// anywhere in this file.
import type { TrainingCycle, TrainingCycleApiService } from './training-cycle-api-service';
import type { DeleteWithDependentsResult, WriteResult } from './api-outcomes';
import type { LocalAcademicYearStore } from './local-academic-year-store';

export class LocalTrainingCycleApiService implements TrainingCycleApiService {
  constructor(private readonly _store: LocalAcademicYearStore) {}

  async list(): Promise<TrainingCycle[]> {
    return [...this._store.trainingCycles];
  }

  async create(name: string): Promise<WriteResult<TrainingCycle>> {
    if (this._store.trainingCycles.some((cycle) => cycle.name === name)) {
      return { outcome: 'duplicate-name' };
    }
    const cycle: TrainingCycle = { id: this._store.newId('cycle'), name };
    this._store.trainingCycles.push(cycle);
    return { outcome: 'success', value: cycle };
  }

  async rename(id: string, name: string): Promise<WriteResult<TrainingCycle>> {
    const cycle = this._store.trainingCycles.find((candidate) => candidate.id === id);
    if (!cycle) return { outcome: 'not-found' };
    if (this._store.trainingCycles.some((candidate) => candidate.id !== id && candidate.name === name)) {
      return { outcome: 'duplicate-name' };
    }
    cycle.name = name;
    return { outcome: 'success', value: cycle };
  }

  async remove(id: string): Promise<DeleteWithDependentsResult> {
    const exists = this._store.trainingCycles.some((cycle) => cycle.id === id);
    if (!exists) return { outcome: 'not-found' };

    const referencing = this._store.academicYearsSelectingCycle(id);
    if (referencing.length > 0) {
      return {
        outcome: 'has-dependents',
        academicYears: referencing.map((year) => ({ id: year.id, name: year.name })),
      };
    }

    this._store.trainingCycles = this._store.trainingCycles.filter((cycle) => cycle.id !== id);
    this._store.modules = this._store.modules.filter((module) => module.trainingCycleId !== id);
    return { outcome: 'success' };
  }
}
