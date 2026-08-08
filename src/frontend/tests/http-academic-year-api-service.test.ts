import { describe, it, expect, afterEach } from 'bun:test';
import { HttpAcademicYearApiService } from '../src/http-academic-year-api-service';

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

describe('HttpAcademicYearApiService.list', () => {
  it('GETs /api/academic-years and returns the parsed list', async () => {
    const academicYears = [{ id: 'y1', startYear: 2026, isCurrent: true }];
    const calls = stubFetch(new Response(JSON.stringify({ academicYears }), { status: 200 }));
    const service = new HttpAcademicYearApiService();

    expect(await service.list()).toEqual(academicYears);
    expect(calls[0]!.url).toBe('/api/academic-years');
  });
});

describe('HttpAcademicYearApiService.update', () => {
  it('PATCHes /api/academic-years/:id with the changes', async () => {
    const updated = { id: 'y1', startYear: 2027, isCurrent: false };
    const calls = stubFetch(new Response(JSON.stringify(updated), { status: 200 }));
    const service = new HttpAcademicYearApiService();

    const result = await service.update('y1', { startYear: 2027 });

    expect(result).toEqual({ outcome: 'success', value: updated });
    expect(calls[0]!.url).toBe('/api/academic-years/y1');
    expect(calls[0]!.init).toMatchObject({ method: 'PATCH' });
  });

  it('returns duplicate-name on a 409 DUPLICATE_NAME response', async () => {
    stubFetch(new Response(JSON.stringify({ message: 'dup', code: 'DUPLICATE_NAME' }), { status: 409 }));
    const service = new HttpAcademicYearApiService();

    expect(await service.update('y1', { startYear: 2027 })).toEqual({ outcome: 'duplicate-name' });
  });
});

describe('HttpAcademicYearApiService.remove', () => {
  it('DELETEs /api/academic-years/:id and returns success on a 204', async () => {
    const calls = stubFetch(new Response(null, { status: 204 }));
    const service = new HttpAcademicYearApiService();

    const result = await service.remove('y1');

    expect(result).toEqual({ outcome: 'success' });
    expect(calls[0]!.url).toBe('/api/academic-years/y1');
    expect(calls[0]!.init).toMatchObject({ method: 'DELETE' });
  });

  it('returns has-dependents on a 409 (still has assigned módulos)', async () => {
    stubFetch(new Response(null, { status: 409 }));
    const service = new HttpAcademicYearApiService();

    expect(await service.remove('y1')).toEqual({ outcome: 'has-dependents' });
  });
});

describe('HttpAcademicYearApiService.listModules', () => {
  it('GETs /api/academic-years/:id/modules and returns the parsed list', async () => {
    const modules = [{ id: 'am1', catalogModuleId: 'm1', catalogTrainingCycleId: 'c1', catalogTrainingCycleName: 'DAM', course: 1, name: 'Programación' }];
    const calls = stubFetch(new Response(JSON.stringify({ modules }), { status: 200 }));
    const service = new HttpAcademicYearApiService();

    expect(await service.listModules('y1')).toEqual(modules);
    expect(calls[0]!.url).toBe('/api/academic-years/y1/modules');
  });

  it('returns [] on a non-OK response (e.g. a deleted year) instead of propagating a missing field', async () => {
    stubFetch(new Response(null, { status: 404 }));
    const service = new HttpAcademicYearApiService();

    expect(await service.listModules('gone')).toEqual([]);
  });
});

describe('HttpAcademicYearApiService.createWithSelection', () => {
  it('POSTs /api/academic-years/selection and returns success with the created year + count', async () => {
    const value = { academicYear: { id: 'y1', startYear: 2026, isCurrent: false }, moduleCount: 2 };
    const calls = stubFetch(new Response(JSON.stringify(value), { status: 201 }));
    const service = new HttpAcademicYearApiService();

    const result = await service.createWithSelection(2026, ['m1', 'm2']);

    expect(result).toEqual({ outcome: 'success', value });
    expect(calls[0]!.url).toBe('/api/academic-years/selection');
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ startYear: 2026, moduleIds: ['m1', 'm2'] });
  });
});

describe('HttpAcademicYearApiService.extendSelection', () => {
  it('POSTs /api/academic-years/:id/modules and returns success with the added count', async () => {
    const calls = stubFetch(new Response(JSON.stringify({ addedCount: 2 }), { status: 200 }));
    const service = new HttpAcademicYearApiService();

    const result = await service.extendSelection('y1', ['m1', 'm2']);

    expect(result).toEqual({ outcome: 'success', value: { addedCount: 2 } });
    expect(calls[0]!.url).toBe('/api/academic-years/y1/modules');
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ moduleIds: ['m1', 'm2'] });
  });
});

describe('HttpAcademicYearApiService.removeModule', () => {
  it('DELETEs /api/academic-year-modules/:id and returns success on a 204', async () => {
    const calls = stubFetch(new Response(null, { status: 204 }));
    const service = new HttpAcademicYearApiService();

    const result = await service.removeModule('am1');

    expect(result).toEqual({ outcome: 'success' });
    expect(calls[0]!.url).toBe('/api/academic-year-modules/am1');
    expect(calls[0]!.init).toMatchObject({ method: 'DELETE' });
  });
});
