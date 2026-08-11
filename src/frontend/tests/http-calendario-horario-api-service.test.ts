import { describe, it, expect, afterEach } from 'bun:test';
import { HttpCalendarioHorarioApiService } from '../src/http-calendario-horario-api-service';
import type { CalendarioHorarioEntry } from '../src/calendario-horario-api-service';

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

describe('HttpCalendarioHorarioApiService.findForModule', () => {
  it('GETs /api/calendario-horario with the encoded academicYearModuleId and returns its entries', async () => {
    const entries: CalendarioHorarioEntry[] = [
      { date: '2026-09-07', hours: 2 },
      { date: '2026-09-11', hours: 3 },
    ];
    const calls = stubFetch(new Response(JSON.stringify({ entries }), { status: 200 }));
    const service = new HttpCalendarioHorarioApiService();

    const result = await service.findForModule('am 1');

    expect(result).toEqual(entries);
    expect(calls[0]!.url).toBe('/api/calendario-horario?academicYearModuleId=am%201');
  });

  it('returns [] on a non-OK response instead of propagating a missing .entries field', async () => {
    stubFetch(new Response(null, { status: 404 }));
    const service = new HttpCalendarioHorarioApiService();

    const result = await service.findForModule('am1');

    expect(result).toEqual([]);
  });
});
