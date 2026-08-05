// Local, in-memory-only `ModuleApiService` implementation, wired into `main.ts` at
// bootstrap for Año académico — replaces `http-module-api-service.ts` (removed 2026-08-04,
// see `local-academic-year-store.ts`'s header comment). No `fetch` call anywhere in this
// file.
import type { ModuleApiService, ModuleChanges, ModuleRecord, ModuleWithCycleName } from './module-api-service';
import type { DeleteWithDependentsResult, UpdateWithDependentsResult, WriteResult } from './api-outcomes';
import type { LocalAcademicYearStore } from './local-academic-year-store';

export class LocalModuleApiService implements ModuleApiService {
  constructor(private readonly _store: LocalAcademicYearStore) {}

  async listForCycle(cycleId: string): Promise<ModuleRecord[]> {
    return this._store.modules.filter((module) => module.trainingCycleId === cycleId);
  }

  async listAll(): Promise<ModuleWithCycleName[]> {
    return this._store.modules.map((module) => ({
      ...module,
      trainingCycleName: this._store.trainingCycles.find((cycle) => cycle.id === module.trainingCycleId)?.name ?? '',
    }));
  }

  async create(cycleId: string, name: string, course: number): Promise<WriteResult<ModuleRecord>> {
    const cycleExists = this._store.trainingCycles.some((cycle) => cycle.id === cycleId);
    if (!cycleExists) return { outcome: 'not-found' };

    const duplicate = this._store.modules.some(
      (module) => module.trainingCycleId === cycleId && module.course === course && module.name === name,
    );
    if (duplicate) return { outcome: 'duplicate-name' };

    const module: ModuleRecord = { id: this._store.newId('module'), trainingCycleId: cycleId, course, name };
    this._store.modules.push(module);
    return { outcome: 'success', value: module };
  }

  async update(id: string, changes: ModuleChanges, confirm?: boolean): Promise<UpdateWithDependentsResult<ModuleRecord>> {
    const module = this._store.modules.find((candidate) => candidate.id === id);
    if (!module) return { outcome: 'not-found' };

    if (confirm !== true) {
      const referencing = this._store.academicYearsSelecting(id);
      if (referencing.length > 0) {
        return {
          outcome: 'has-dependents',
          academicYears: referencing.map((year) => ({ id: year.id, name: year.name })),
        };
      }
    }

    const name = changes.name ?? module.name;
    const course = changes.course ?? module.course;
    const duplicate = this._store.modules.some(
      (candidate) =>
        candidate.id !== id &&
        candidate.trainingCycleId === module.trainingCycleId &&
        candidate.course === course &&
        candidate.name === name,
    );
    if (duplicate) return { outcome: 'duplicate-name' };

    module.name = name;
    module.course = course;
    return { outcome: 'success', value: module };
  }

  async remove(id: string): Promise<DeleteWithDependentsResult> {
    const exists = this._store.modules.some((module) => module.id === id);
    if (!exists) return { outcome: 'not-found' };

    const referencing = this._store.academicYearsSelecting(id);
    if (referencing.length > 0) {
      return {
        outcome: 'has-dependents',
        academicYears: referencing.map((year) => ({ id: year.id, name: year.name })),
      };
    }

    this._store.modules = this._store.modules.filter((module) => module.id !== id);
    return { outcome: 'success' };
  }
}
