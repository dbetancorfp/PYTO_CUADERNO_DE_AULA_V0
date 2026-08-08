// Pure Response -> outcome translation shared by every Http*ApiService — see
// src/frontend/src/api-outcomes.ts for the domain-error-code table each parser implements.
import { describe, it, expect } from 'bun:test';
import {
  parseCreateSelectionResult,
  parseDeleteHasDependents,
  parseDeleteResult,
  parseExtendSelectionResult,
  parseWriteResult,
} from '../src/api-outcomes';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

describe('parseWriteResult', () => {
  it('returns not-found for a 404', async () => {
    const result = await parseWriteResult(emptyResponse(404));
    expect(result).toEqual({ outcome: 'not-found' });
  });

  it('returns duplicate-name for a 409 with DUPLICATE_NAME code', async () => {
    const result = await parseWriteResult(jsonResponse(409, { message: 'dup', code: 'DUPLICATE_NAME' }));
    expect(result).toEqual({ outcome: 'duplicate-name' });
  });

  it('returns not-found for any other non-OK status', async () => {
    const result = await parseWriteResult(jsonResponse(500, { message: 'boom' }));
    expect(result).toEqual({ outcome: 'not-found' });
  });

  it('returns success with the parsed body on an OK response', async () => {
    const result = await parseWriteResult<{ id: string }>(jsonResponse(200, { id: 'a1' }));
    expect(result).toEqual({ outcome: 'success', value: { id: 'a1' } });
  });
});

describe('parseDeleteResult', () => {
  it('returns success for a 204', async () => {
    expect(await parseDeleteResult(emptyResponse(204))).toEqual({ outcome: 'success' });
  });

  it('returns not-found for any other status', async () => {
    expect(await parseDeleteResult(emptyResponse(404))).toEqual({ outcome: 'not-found' });
  });
});

describe('parseDeleteHasDependents', () => {
  it('returns success for a 204', async () => {
    expect(await parseDeleteHasDependents(emptyResponse(204))).toEqual({ outcome: 'success' });
  });

  it('returns not-found for a 404', async () => {
    expect(await parseDeleteHasDependents(emptyResponse(404))).toEqual({ outcome: 'not-found' });
  });

  it('returns has-dependents for any other status (409)', async () => {
    expect(await parseDeleteHasDependents(emptyResponse(409))).toEqual({ outcome: 'has-dependents' });
  });
});

describe('parseCreateSelectionResult', () => {
  it('returns success with the parsed body for a 201', async () => {
    const body = { academicYear: { id: 'y1', startYear: 2026, isCurrent: false }, moduleCount: 2 };
    expect(await parseCreateSelectionResult(jsonResponse(201, body))).toEqual({ outcome: 'success', value: body });
  });

  it('returns not-found for a 404', async () => {
    expect(await parseCreateSelectionResult(emptyResponse(404))).toEqual({ outcome: 'not-found' });
  });

  it('returns duplicate-name for a 409 with DUPLICATE_NAME code', async () => {
    const result = await parseCreateSelectionResult(jsonResponse(409, { message: 'dup', code: 'DUPLICATE_NAME' }));
    expect(result).toEqual({ outcome: 'duplicate-name' });
  });

  it('returns not-found for any other non-OK, non-404 status without that code', async () => {
    const result = await parseCreateSelectionResult(jsonResponse(500, { message: 'boom' }));
    expect(result).toEqual({ outcome: 'not-found' });
  });
});

describe('parseExtendSelectionResult', () => {
  it('returns success with the parsed body for a 200', async () => {
    expect(await parseExtendSelectionResult(jsonResponse(200, { addedCount: 3 }))).toEqual({
      outcome: 'success',
      value: { addedCount: 3 },
    });
  });

  it('returns not-found for any other status', async () => {
    expect(await parseExtendSelectionResult(emptyResponse(404))).toEqual({ outcome: 'not-found' });
  });
});
