import { describe, it, expect, afterEach } from 'bun:test';
import { HttpCalendarioModuloApiService } from '../src/http-calendario-modulo-api-service';
import type { CalendarioModuloEntry } from '../src/calendario-modulo-api-service';

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

describe('HttpCalendarioModuloApiService.findForModule', () => {
  it('GETs /api/calendario-modulo with the encoded academicYearModuleId and returns its entries', async () => {
    const entries: CalendarioModuloEntry[] = [
      { id: 'e1', category: 'holidays', name: 'Navidad', startDate: '2026-12-22', endDate: '2027-01-07' },
    ];
    const calls = stubFetch(new Response(JSON.stringify({ entries }), { status: 200 }));
    const service = new HttpCalendarioModuloApiService();

    const result = await service.findForModule('am 1');

    expect(result).toEqual(entries);
    expect(calls[0]!.url).toBe('/api/calendario-modulo?academicYearModuleId=am%201');
  });

  it('returns [] on a non-OK response instead of propagating a missing .entries field', async () => {
    stubFetch(new Response(null, { status: 404 }));
    const service = new HttpCalendarioModuloApiService();

    const result = await service.findForModule('am1');

    expect(result).toEqual([]);
  });
});
