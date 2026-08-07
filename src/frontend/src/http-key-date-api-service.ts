// Concrete `KeyDateApiService` client, wired into `main.ts` at bootstrap — the real HTTP
// calls against `/api/key-dates` (see views/fechas-senaladas/api-contracts.md).
// `key-date-api-service.ts` only declares the interface `KeyDateSettingsView` depends on
// (DIP). Reuses `parseWriteResult`/`parseDeleteResult` from `api-outcomes.ts`, same as every
// other Http*ApiService in this app.
import type { KeyDate, KeyDateApiService, KeyDateCreateData } from './key-date-api-service';
import type { DeleteResult, WriteResult } from './api-outcomes';
import { parseDeleteResult, parseWriteResult } from './api-outcomes';

export class HttpKeyDateApiService implements KeyDateApiService {
  /** Returns `[]` on a non-OK response instead of letting an error body with no
   * `.keyDates` field propagate as a non-array. */
  async list(category: string): Promise<KeyDate[]> {
    const response = await fetch(`/api/key-dates?category=${encodeURIComponent(category)}`);
    if (!response.ok) return [];
    const body = (await response.json()) as { keyDates: KeyDate[] };
    return body.keyDates;
  }

  async create(data: KeyDateCreateData): Promise<WriteResult<KeyDate>> {
    const response = await fetch('/api/key-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseWriteResult<KeyDate>(response);
  }

  async update(id: string, changes: Partial<KeyDateCreateData>): Promise<WriteResult<KeyDate>> {
    const response = await fetch(`/api/key-dates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    return parseWriteResult<KeyDate>(response);
  }

  async remove(id: string): Promise<DeleteResult> {
    const response = await fetch(`/api/key-dates/${id}`, { method: 'DELETE' });
    return parseDeleteResult(response);
  }
}
