import { describe, it, expect, afterEach } from 'bun:test';
import { HttpEvaluationWorkingDaysApiService } from '../src/http-evaluation-working-days-api-service';
import type { EvaluationWorkingDaysEntry } from '../src/evaluation-working-days-api-service';

interface FetchCall {
  url: string;
}

const originalFetch = globalThis.fetch;

function stubFetch(response: Response): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push({ url });
    return response;
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('HttpEvaluationWorkingDaysApiService.findForModule', () => {
  it('GETs /api/calendario-evaluation-working-days with the encoded academicYearModuleId and returns its entries', async () => {
    const entries: EvaluationWorkingDaysEntry[] = [
      { evaluationNumber: 1, workingDays: 56 },
      { evaluationNumber: 2, workingDays: 121 },
    ];
    const calls = stubFetch(new Response(JSON.stringify({ entries }), { status: 200 }));
    const service = new HttpEvaluationWorkingDaysApiService();

    const result = await service.findForModule('am 1');

    expect(result).toEqual(entries);
    expect(calls[0]!.url).toBe('/api/calendario-evaluation-working-days?academicYearModuleId=am%201');
  });

  it('returns [] on a non-OK response instead of propagating a missing .entries field', async () => {
    stubFetch(new Response(null, { status: 404 }));
    const service = new HttpEvaluationWorkingDaysApiService();

    const result = await service.findForModule('am1');

    expect(result).toEqual([]);
  });
});
