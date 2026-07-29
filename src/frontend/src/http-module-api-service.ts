// Concrete `ModuleApiService` client, wired into `main.ts` at bootstrap — the real HTTP
// calls against `/api/training-cycles/:cycleId/modules`, `/api/modules` and
// `/api/modules/:id` (see views/configuracion/api-contracts.md). `module-api-service.ts`
// only declares the interface `AcademicYearSettingsView` depends on (DIP).
import type { ModuleApiService, ModuleChanges, ModuleRecord, ModuleWithCycleName } from './module-api-service';
import type { DeleteWithDependentsResult, UpdateWithDependentsResult, WriteResult } from './api-outcomes';
import { parseDeleteWithDependents, parseUpdateWithDependents, parseWriteResult } from './api-outcomes';

export class HttpModuleApiService implements ModuleApiService {
  async listForCycle(cycleId: string): Promise<ModuleRecord[]> {
    const response = await fetch(`/api/training-cycles/${cycleId}/modules`);
    const body = (await response.json()) as { modules: ModuleRecord[] };
    return body.modules;
  }

  async listAll(): Promise<ModuleWithCycleName[]> {
    const response = await fetch('/api/modules');
    const body = (await response.json()) as { modules: ModuleWithCycleName[] };
    return body.modules;
  }

  async create(cycleId: string, name: string, course: number): Promise<WriteResult<ModuleRecord>> {
    const response = await fetch(`/api/training-cycles/${cycleId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, course }),
    });
    return parseWriteResult<ModuleRecord>(response);
  }

  async update(
    id: string,
    changes: ModuleChanges,
    confirm?: boolean,
  ): Promise<UpdateWithDependentsResult<ModuleRecord>> {
    const response = await fetch(`/api/modules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...changes, ...(confirm === true ? { confirm: true } : {}) }),
    });
    return parseUpdateWithDependents<ModuleRecord>(response);
  }

  async remove(id: string): Promise<DeleteWithDependentsResult> {
    const response = await fetch(`/api/modules/${id}`, { method: 'DELETE' });
    return parseDeleteWithDependents(response);
  }
}
