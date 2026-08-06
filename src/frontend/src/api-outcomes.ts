// Shared discriminated-union outcome shapes + `fetch` `Response` → outcome translation,
// reused by the Configuración HTTP services (`http-catalog-training-cycle-api-service.ts`,
// `http-catalog-module-api-service.ts`, `http-academic-year-api-service.ts`) so each doesn't
// duplicate the same status/body → outcome mapping described in
// views/configuracion/api-contracts.md's "Domain error codes" table. Pure functions only —
// no component, no fetch call of its own (DIP: the concrete HTTP services call `fetch`,
// this module only interprets the `Response` they get back).

export type WriteResult<T> =
  | { outcome: 'success'; value: T }
  | { outcome: 'not-found' }
  | { outcome: 'duplicate-name' };

/** For delete endpoints with no dependency check at all — e.g. the Ciclos/Módulos catalog. */
export type DeleteResult = { outcome: 'success' } | { outcome: 'not-found' };

/** For DELETE /api/academic-years/:id, blocked while academic_year_modules rows remain. */
export type DeleteHasDependentsResult = { outcome: 'success' } | { outcome: 'not-found' } | { outcome: 'has-dependents' };

export interface CreatedAcademicYearSelection {
  academicYear: { id: string; startYear: number; isCurrent: boolean };
  moduleCount: number;
}

/** For POST /api/academic-years/selection. */
export type CreateSelectionResult =
  | { outcome: 'success'; value: CreatedAcademicYearSelection }
  | { outcome: 'not-found' }
  | { outcome: 'duplicate-name' };

/** For POST /api/academic-years/:id/modules. */
export type ExtendSelectionResult = { outcome: 'success'; value: { addedCount: number } } | { outcome: 'not-found' };

interface ErrorBody {
  message: string;
  code?: string;
}

/** For create/rename-style endpoints: 200/201 → success, 404 → not-found, 409 DUPLICATE_NAME → duplicate-name. */
export async function parseWriteResult<T>(response: Response): Promise<WriteResult<T>> {
  if (response.status === 404) {
    return { outcome: 'not-found' };
  }
  if (!response.ok) {
    const body = (await response.json()) as ErrorBody;
    if (body.code === 'DUPLICATE_NAME') {
      return { outcome: 'duplicate-name' };
    }
    return { outcome: 'not-found' };
  }
  const value = (await response.json()) as T;
  return { outcome: 'success', value };
}

/** For delete endpoints with no dependency check (e.g. the Ciclos/Módulos catalog). */
export async function parseDeleteResult(response: Response): Promise<DeleteResult> {
  if (response.status === 204) {
    return { outcome: 'success' };
  }
  return { outcome: 'not-found' };
}

/** For DELETE /api/academic-years/:id: 204 → success, 404 → not-found, else (409 HAS_DEPENDENTS) → has-dependents. */
export async function parseDeleteHasDependents(response: Response): Promise<DeleteHasDependentsResult> {
  if (response.status === 204) {
    return { outcome: 'success' };
  }
  if (response.status === 404) {
    return { outcome: 'not-found' };
  }
  return { outcome: 'has-dependents' };
}

/** For POST /api/academic-years/selection: 201 → success, 404 → not-found, 409 DUPLICATE_NAME → duplicate-name. */
export async function parseCreateSelectionResult(response: Response): Promise<CreateSelectionResult> {
  if (response.status === 201) {
    const value = (await response.json()) as CreatedAcademicYearSelection;
    return { outcome: 'success', value };
  }
  if (response.status === 404) {
    return { outcome: 'not-found' };
  }
  const body = (await response.json()) as ErrorBody;
  if (body.code === 'DUPLICATE_NAME') {
    return { outcome: 'duplicate-name' };
  }
  return { outcome: 'not-found' };
}

/** For POST /api/academic-years/:id/modules: 200 → success, else → not-found. */
export async function parseExtendSelectionResult(response: Response): Promise<ExtendSelectionResult> {
  if (response.status === 200) {
    const value = (await response.json()) as { addedCount: number };
    return { outcome: 'success', value };
  }
  return { outcome: 'not-found' };
}
