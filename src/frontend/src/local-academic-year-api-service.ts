// Local, in-memory-only `AcademicYearApiService` implementation, wired into `main.ts` at
// bootstrap for Año académico — replaces `http-academic-year-api-service.ts` (removed
// 2026-08-04, see `local-academic-year-store.ts`'s header comment). No `fetch` call
// anywhere in this file.
import type { AcademicYear, AcademicYearApiService, ReplaceSelectionResult } from './academic-year-api-service';
import type { DeleteCurrentBlockedResult, WriteResult } from './api-outcomes';
import type { TrainingCycle } from './training-cycle-api-service';
import type { ModuleRecord } from './module-api-service';
import type { LocalAcademicYearStore } from './local-academic-year-store';

export class LocalAcademicYearApiService implements AcademicYearApiService {
  constructor(private readonly _store: LocalAcademicYearStore) {}

  async list(): Promise<AcademicYear[]> {
    return [...this._store.academicYears];
  }

  async create(name: string): Promise<WriteResult<AcademicYear>> {
    if (this._store.academicYears.some((year) => year.name === name)) {
      return { outcome: 'duplicate-name' };
    }
    const year: AcademicYear = { id: this._store.newId('year'), name, isCurrent: false };
    this._store.academicYears.push(year);
    return { outcome: 'success', value: year };
  }

  async rename(id: string, name: string): Promise<WriteResult<AcademicYear>> {
    const year = this._store.academicYears.find((candidate) => candidate.id === id);
    if (!year) return { outcome: 'not-found' };
    if (this._store.academicYears.some((candidate) => candidate.id !== id && candidate.name === name)) {
      return { outcome: 'duplicate-name' };
    }
    year.name = name;
    return { outcome: 'success', value: year };
  }

  async setCurrent(id: string): Promise<WriteResult<AcademicYear>> {
    const year = this._store.academicYears.find((candidate) => candidate.id === id);
    if (!year) return { outcome: 'not-found' };
    this._store.academicYears.forEach((candidate) => {
      candidate.isCurrent = candidate.id === id;
    });
    return { outcome: 'success', value: year };
  }

  async remove(id: string): Promise<DeleteCurrentBlockedResult> {
    const year = this._store.academicYears.find((candidate) => candidate.id === id);
    if (!year) return { outcome: 'not-found' };
    if (year.isCurrent) return { outcome: 'is-current' };

    this._store.academicYears = this._store.academicYears.filter((candidate) => candidate.id !== id);
    this._store.dropSelection(id);
    return { outcome: 'success' };
  }

  async getSelection(id: string): Promise<string[]> {
    return Array.from(this._store.selectionFor(id));
  }

  async replaceSelection(id: string, moduleIds: string[]): Promise<ReplaceSelectionResult> {
    const exists = this._store.academicYears.some((year) => year.id === id);
    if (!exists) return { outcome: 'not-found' };
    this._store.setSelection(id, moduleIds);
    return { outcome: 'success' };
  }

  async listTrainingCyclesForYear(id: string): Promise<TrainingCycle[]> {
    const selection = this._store.selectionFor(id);
    const cycleIds = new Set(
      this._store.modules.filter((module) => selection.has(module.id)).map((module) => module.trainingCycleId),
    );
    return this._store.trainingCycles.filter((cycle) => cycleIds.has(cycle.id));
  }

  async listModulesForYearAndCycle(id: string, cycleId: string): Promise<ModuleRecord[]> {
    const selection = this._store.selectionFor(id);
    return this._store.modules.filter((module) => module.trainingCycleId === cycleId && selection.has(module.id));
  }
}
