// Concrete `CatalogTrainingCycleApiService` client, wired into `main.ts` at bootstrap — the
// real HTTP calls against `/api/catalog/training-cycles` (see
// views/configuracion/api-contracts.md). `catalog-training-cycle-api-service.ts` only
// declares the interface `TrainingCatalogSettingsView` depends on (DIP).
import type { CatalogTrainingCycle, CatalogTrainingCycleApiService } from './catalog-training-cycle-api-service';
import type { DeleteResult, WriteResult } from './api-outcomes';
import { parseDeleteResult, parseWriteResult } from './api-outcomes';

export class HttpCatalogTrainingCycleApiService implements CatalogTrainingCycleApiService {
  async list(): Promise<CatalogTrainingCycle[]> {
    const response = await fetch('/api/catalog/training-cycles');
    const body = (await response.json()) as { trainingCycles: CatalogTrainingCycle[] };
    return body.trainingCycles;
  }

  async create(name: string): Promise<WriteResult<CatalogTrainingCycle>> {
    const response = await fetch('/api/catalog/training-cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseWriteResult<CatalogTrainingCycle>(response);
  }

  async rename(id: string, name: string): Promise<WriteResult<CatalogTrainingCycle>> {
    const response = await fetch(`/api/catalog/training-cycles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseWriteResult<CatalogTrainingCycle>(response);
  }

  async remove(id: string): Promise<DeleteResult> {
    const response = await fetch(`/api/catalog/training-cycles/${id}`, { method: 'DELETE' });
    return parseDeleteResult(response);
  }
}
