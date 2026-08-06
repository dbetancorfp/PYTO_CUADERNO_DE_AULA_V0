// Concrete `AcademicYearApiService` client, wired into `main.ts` at bootstrap — the real
// HTTP calls against `/api/academic-years*` (see views/configuracion/api-contracts.md's
// "Academic years"/"Academic year módulo selection" sections). `academic-year-api-
// service.ts` only declares the interface `AcademicYearSettingsView` depends on (DIP).
import type { AcademicYear, AcademicYearApiService, AcademicYearModuleDetail } from './academic-year-api-service';
import type { CreateSelectionResult, DeleteHasDependentsResult, DeleteResult, ExtendSelectionResult, WriteResult } from './api-outcomes';
import {
  parseCreateSelectionResult,
  parseDeleteHasDependents,
  parseDeleteResult,
  parseExtendSelectionResult,
  parseWriteResult,
} from './api-outcomes';

export class HttpAcademicYearApiService implements AcademicYearApiService {
  async list(): Promise<AcademicYear[]> {
    const response = await fetch('/api/academic-years');
    const body = (await response.json()) as { academicYears: AcademicYear[] };
    return body.academicYears;
  }

  async update(id: string, changes: { startYear?: number; isCurrent?: boolean }): Promise<WriteResult<AcademicYear>> {
    const response = await fetch(`/api/academic-years/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    return parseWriteResult<AcademicYear>(response);
  }

  async remove(id: string): Promise<DeleteHasDependentsResult> {
    const response = await fetch(`/api/academic-years/${id}`, { method: 'DELETE' });
    return parseDeleteHasDependents(response);
  }

  async listModules(id: string): Promise<AcademicYearModuleDetail[]> {
    const response = await fetch(`/api/academic-years/${id}/modules`);
    const body = (await response.json()) as { modules: AcademicYearModuleDetail[] };
    return body.modules;
  }

  async createWithSelection(startYear: number, moduleIds: string[]): Promise<CreateSelectionResult> {
    const response = await fetch('/api/academic-years/selection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startYear, moduleIds }),
    });
    return parseCreateSelectionResult(response);
  }

  async extendSelection(id: string, moduleIds: string[]): Promise<ExtendSelectionResult> {
    const response = await fetch(`/api/academic-years/${id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleIds }),
    });
    return parseExtendSelectionResult(response);
  }

  async removeModule(academicYearModuleId: string): Promise<DeleteResult> {
    const response = await fetch(`/api/academic-year-modules/${academicYearModuleId}`, { method: 'DELETE' });
    return parseDeleteResult(response);
  }
}
