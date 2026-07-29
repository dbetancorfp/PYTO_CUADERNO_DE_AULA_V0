// Shared discriminated-union outcome shapes + `fetch` `Response` → outcome translation,
// reused by the four Configuración HTTP services (`http-training-cycle-api-service.ts`,
// `http-module-api-service.ts`, `http-academic-year-api-service.ts`) so each doesn't
// duplicate the same status/body → outcome mapping described in
// views/configuracion/api-contracts.md's "Domain error codes" table. Pure functions only —
// no component, no fetch call of its own (DIP: the concrete HTTP services call `fetch`,
// this module only interprets the `Response` they get back).

export interface AcademicYearRef {
  id: string;
  name: string;
}

export type WriteResult<T> =
  | { outcome: 'success'; value: T }
  | { outcome: 'not-found' }
  | { outcome: 'duplicate-name' };

export type DeleteWithDependentsResult =
  | { outcome: 'success' }
  | { outcome: 'not-found' }
  | { outcome: 'has-dependents'; academicYears: AcademicYearRef[] };

export type DeleteCurrentBlockedResult =
  | { outcome: 'success' }
  | { outcome: 'not-found' }
  | { outcome: 'is-current' };

export type UpdateWithDependentsResult<T> =
  | { outcome: 'success'; value: T }
  | { outcome: 'not-found' }
  | { outcome: 'duplicate-name' }
  | { outcome: 'has-dependents'; academicYears: AcademicYearRef[] };

interface ErrorBody {
  message: string;
  code?: string;
  academicYears?: AcademicYearRef[];
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

/** For delete endpoints rejected when referenced by academic years (training cycles, modules). */
export async function parseDeleteWithDependents(response: Response): Promise<DeleteWithDependentsResult> {
  if (response.status === 204) {
    return { outcome: 'success' };
  }
  if (response.status === 404) {
    return { outcome: 'not-found' };
  }
  const body = (await response.json()) as ErrorBody;
  return { outcome: 'has-dependents', academicYears: body.academicYears ?? [] };
}

/** For deleting an academic year, rejected when it's the one marked current. */
export async function parseDeleteCurrentBlocked(response: Response): Promise<DeleteCurrentBlockedResult> {
  if (response.status === 204) {
    return { outcome: 'success' };
  }
  if (response.status === 404) {
    return { outcome: 'not-found' };
  }
  return { outcome: 'is-current' };
}

/** For PATCH /api/modules/:id, which can also reject with HAS_DEPENDENTS when `confirm` isn't `true`. */
export async function parseUpdateWithDependents<T>(response: Response): Promise<UpdateWithDependentsResult<T>> {
  if (response.status === 404) {
    return { outcome: 'not-found' };
  }
  if (response.ok) {
    const value = (await response.json()) as T;
    return { outcome: 'success', value };
  }
  const body = (await response.json()) as ErrorBody;
  if (body.code === 'DUPLICATE_NAME') {
    return { outcome: 'duplicate-name' };
  }
  if (body.code === 'HAS_DEPENDENTS') {
    return { outcome: 'has-dependents', academicYears: body.academicYears ?? [] };
  }
  return { outcome: 'not-found' };
}
