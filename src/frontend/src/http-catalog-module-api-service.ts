// Concrete `CatalogModuleApiService` client, wired into `main.ts` at bootstrap — the real
// HTTP calls against `/api/catalog/training-cycles/:cycleId/modules` and
// `/api/catalog/modules/:id` (see views/configuracion/api-contracts.md).
// `catalog-module-api-service.ts` only declares the interface
// `TrainingCatalogSettingsView` depends on (DIP).
import type { CatalogModuleApiService, CatalogModuleChanges, CatalogModuleRecord } from './catalog-module-api-service';
import type { DeleteResult, WriteResult } from './api-outcomes';
import { parseDeleteResult, parseWriteResult } from './api-outcomes';

export class HttpCatalogModuleApiService implements CatalogModuleApiService {
  /** Returns `[]` when `cycleId` no longer exists (404) — e.g. deleted out from under an
   * active selection — instead of letting an error body with no `.modules` field propagate
   * as a non-array (see #5: `TrainingCatalogSettingsView` iterating that non-array threw
   * `TypeError: this._modules is not iterable`). */
  async listForCycle(cycleId: string): Promise<CatalogModuleRecord[]> {
    const response = await fetch(`/api/catalog/training-cycles/${cycleId}/modules`);
    if (!response.ok) return [];
    const body = (await response.json()) as { modules: CatalogModuleRecord[] };
    return body.modules;
  }

  async create(cycleId: string, name: string, course: number): Promise<WriteResult<CatalogModuleRecord>> {
    const response = await fetch(`/api/catalog/training-cycles/${cycleId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, course }),
    });
    return parseWriteResult<CatalogModuleRecord>(response);
  }

  async update(id: string, changes: CatalogModuleChanges): Promise<WriteResult<CatalogModuleRecord>> {
    const response = await fetch(`/api/catalog/modules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    return parseWriteResult<CatalogModuleRecord>(response);
  }

  async remove(id: string): Promise<DeleteResult> {
    const response = await fetch(`/api/catalog/modules/${id}`, { method: 'DELETE' });
    return parseDeleteResult(response);
  }
}
