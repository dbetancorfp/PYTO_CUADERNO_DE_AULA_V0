import { describe, it, expect, afterEach } from 'bun:test';
import { HttpCatalogModuleApiService } from '../src/http-catalog-module-api-service';

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

describe('HttpCatalogModuleApiService.listForCycle', () => {
  it('GETs /api/catalog/training-cycles/:cycleId/modules and returns the parsed list', async () => {
    const modules = [{ id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' }];
    const calls = stubFetch(new Response(JSON.stringify({ modules }), { status: 200 }));
    const service = new HttpCatalogModuleApiService();

    const result = await service.listForCycle('c1');

    expect(result).toEqual(modules);
    expect(calls[0]!.url).toBe('/api/catalog/training-cycles/c1/modules');
  });

  it('returns [] on a non-OK response (e.g. a deleted cycle) instead of propagating a missing field', async () => {
    stubFetch(new Response(null, { status: 404 }));
    const service = new HttpCatalogModuleApiService();

    expect(await service.listForCycle('gone')).toEqual([]);
  });
});

describe('HttpCatalogModuleApiService.create', () => {
  it('POSTs the name and course, returns success with the created module', async () => {
    const created = { id: 'm1', catalogTrainingCycleId: 'c1', course: 1, name: 'Programación' };
    const calls = stubFetch(new Response(JSON.stringify(created), { status: 201 }));
    const service = new HttpCatalogModuleApiService();

    const result = await service.create('c1', 'Programación', 1);

    expect(result).toEqual({ outcome: 'success', value: created });
    expect(calls[0]!.url).toBe('/api/catalog/training-cycles/c1/modules');
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ name: 'Programación', course: 1 });
  });

  it('returns duplicate-name on a 409 DUPLICATE_NAME response', async () => {
    stubFetch(new Response(JSON.stringify({ message: 'dup', code: 'DUPLICATE_NAME' }), { status: 409 }));
    const service = new HttpCatalogModuleApiService();

    expect(await service.create('c1', 'Programación', 1)).toEqual({ outcome: 'duplicate-name' });
  });
});

describe('HttpCatalogModuleApiService.update', () => {
  it('PATCHes /api/catalog/modules/:id with the changes', async () => {
    const updated = { id: 'm1', catalogTrainingCycleId: 'c1', course: 2, name: 'Acceso a datos' };
    const calls = stubFetch(new Response(JSON.stringify(updated), { status: 200 }));
    const service = new HttpCatalogModuleApiService();

    const result = await service.update('m1', { name: 'Acceso a datos', course: 2 });

    expect(result).toEqual({ outcome: 'success', value: updated });
    expect(calls[0]!.url).toBe('/api/catalog/modules/m1');
    expect(calls[0]!.init).toMatchObject({ method: 'PATCH' });
  });
});

describe('HttpCatalogModuleApiService.remove', () => {
  it('DELETEs /api/catalog/modules/:id and returns success on a 204', async () => {
    const calls = stubFetch(new Response(null, { status: 204 }));
    const service = new HttpCatalogModuleApiService();

    const result = await service.remove('m1');

    expect(result).toEqual({ outcome: 'success' });
    expect(calls[0]!.url).toBe('/api/catalog/modules/m1');
    expect(calls[0]!.init).toMatchObject({ method: 'DELETE' });
  });
});
