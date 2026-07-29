// Concrete `TrainingCycleApiService` client, wired into `main.ts` at bootstrap — the real
// HTTP calls against `/api/training-cycles` (see views/configuracion/api-contracts.md).
// `training-cycle-api-service.ts` only declares the interface
// `AcademicYearSettingsView` depends on (DIP).
import type { TrainingCycle, TrainingCycleApiService } from './training-cycle-api-service';
import type { DeleteWithDependentsResult, WriteResult } from './api-outcomes';
import { parseDeleteWithDependents, parseWriteResult } from './api-outcomes';

export class HttpTrainingCycleApiService implements TrainingCycleApiService {
  async list(): Promise<TrainingCycle[]> {
    const response = await fetch('/api/training-cycles');
    const body = (await response.json()) as { trainingCycles: TrainingCycle[] };
    return body.trainingCycles;
  }

  async create(name: string): Promise<WriteResult<TrainingCycle>> {
    const response = await fetch('/api/training-cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseWriteResult<TrainingCycle>(response);
  }

  async rename(id: string, name: string): Promise<WriteResult<TrainingCycle>> {
    const response = await fetch(`/api/training-cycles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseWriteResult<TrainingCycle>(response);
  }

  async remove(id: string): Promise<DeleteWithDependentsResult> {
    const response = await fetch(`/api/training-cycles/${id}`, { method: 'DELETE' });
    return parseDeleteWithDependents(response);
  }
}
