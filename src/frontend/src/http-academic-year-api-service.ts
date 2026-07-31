// Concrete `AcademicYearApiService` client, wired into `main.ts` at bootstrap — the real
// HTTP calls against `/api/academic-years` and `/api/academic-years/:id/modules` (see
// views/configuracion/api-contracts.md). `academic-year-api-service.ts` only declares the
// interface `AcademicYearSettingsView` depends on (DIP).
import type { AcademicYear, AcademicYearApiService, ReplaceSelectionResult } from './academic-year-api-service';
import type { DeleteCurrentBlockedResult, WriteResult } from './api-outcomes';
import { parseDeleteCurrentBlocked, parseWriteResult } from './api-outcomes';
import type { TrainingCycle } from './training-cycle-api-service';
import type { ModuleRecord } from './module-api-service';

export class HttpAcademicYearApiService implements AcademicYearApiService {
  async list(): Promise<AcademicYear[]> {
    const response = await fetch('/api/academic-years');
    const body = (await response.json()) as { academicYears: AcademicYear[] };
    return body.academicYears;
  }

  async create(name: string): Promise<WriteResult<AcademicYear>> {
    const response = await fetch('/api/academic-years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseWriteResult<AcademicYear>(response);
  }

  async rename(id: string, name: string): Promise<WriteResult<AcademicYear>> {
    const response = await fetch(`/api/academic-years/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseWriteResult<AcademicYear>(response);
  }

  async setCurrent(id: string): Promise<WriteResult<AcademicYear>> {
    const response = await fetch(`/api/academic-years/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCurrent: true }),
    });
    return parseWriteResult<AcademicYear>(response);
  }

  async remove(id: string): Promise<DeleteCurrentBlockedResult> {
    const response = await fetch(`/api/academic-years/${id}`, { method: 'DELETE' });
    return parseDeleteCurrentBlocked(response);
  }

  async getSelection(id: string): Promise<string[]> {
    const response = await fetch(`/api/academic-years/${id}/modules`);
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as { moduleIds: string[] };
    return body.moduleIds;
  }

  async replaceSelection(id: string, moduleIds: string[]): Promise<ReplaceSelectionResult> {
    const response = await fetch(`/api/academic-years/${id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleIds }),
    });
    return response.status === 200 ? { outcome: 'success' } : { outcome: 'not-found' };
  }

  async listTrainingCyclesForYear(id: string): Promise<TrainingCycle[]> {
    const response = await fetch(`/api/academic-years/${id}/training-cycles`);
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as { trainingCycles: TrainingCycle[] };
    return body.trainingCycles;
  }

  async listModulesForYearAndCycle(id: string, cycleId: string): Promise<ModuleRecord[]> {
    const response = await fetch(`/api/academic-years/${id}/training-cycles/${cycleId}/modules`);
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as { modules: ModuleRecord[] };
    return body.modules;
  }
}
