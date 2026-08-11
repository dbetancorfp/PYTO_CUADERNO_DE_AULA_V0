import { describe, it, expect, afterEach } from 'bun:test';
import { HttpAcademicYearModuleScheduleApiService } from '../src/http-academic-year-module-schedule-api-service';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

const originalFetch = globalThis.fetch;

function stubFetch(response: Response): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('HttpAcademicYearModuleScheduleApiService.find', () => {
  it('GETs /api/academic-year-modules/:id/schedule and returns the parsed entries', async () => {
    const schedule = [{ weekday: 1, hours: 2 }];
    const calls = stubFetch(new Response(JSON.stringify({ schedule }), { status: 200 }));
    const service = new HttpAcademicYearModuleScheduleApiService();

    expect(await service.find('am1')).toEqual(schedule);
    expect(calls[0]!.url).toBe('/api/academic-year-modules/am1/schedule');
  });

  it('returns [] on a non-OK response instead of propagating a missing field', async () => {
    stubFetch(new Response(null, { status: 404 }));
    const service = new HttpAcademicYearModuleScheduleApiService();

    expect(await service.find('gone')).toEqual([]);
  });
});

describe('HttpAcademicYearModuleScheduleApiService.save', () => {
  it('PUTs /api/academic-year-modules/:id/schedule and returns success with the persisted entries', async () => {
    const schedule = [{ weekday: 1, hours: 2 }, { weekday: 5, hours: 3 }];
    const calls = stubFetch(new Response(JSON.stringify({ schedule }), { status: 200 }));
    const service = new HttpAcademicYearModuleScheduleApiService();

    const result = await service.save('am1', schedule);

    expect(result).toEqual({ outcome: 'success', value: schedule });
    expect(calls[0]!.url).toBe('/api/academic-year-modules/am1/schedule');
    expect(calls[0]!.init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ schedule });
  });

  it('returns not-found on a 404 response', async () => {
    stubFetch(new Response(null, { status: 404 }));
    const service = new HttpAcademicYearModuleScheduleApiService();

    expect(await service.save('gone', [])).toEqual({ outcome: 'not-found' });
  });

  it('returns validation-error on a 400 response', async () => {
    stubFetch(new Response(null, { status: 400 }));
    const service = new HttpAcademicYearModuleScheduleApiService();

    expect(await service.save('am1', [{ weekday: 6, hours: 1 }])).toEqual({ outcome: 'validation-error' });
  });
});
