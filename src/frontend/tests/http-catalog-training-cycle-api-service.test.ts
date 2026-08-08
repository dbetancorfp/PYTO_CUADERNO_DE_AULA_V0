import { describe, it, expect, afterEach } from 'bun:test';
import { HttpCatalogTrainingCycleApiService } from '../src/http-catalog-training-cycle-api-service';

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

describe('HttpCatalogTrainingCycleApiService.list', () => {
  it('GETs /api/catalog/training-cycles and returns the parsed list', async () => {
    const trainingCycles = [{ id: 'c1', name: 'DAM' }];
    const calls = stubFetch(new Response(JSON.stringify({ trainingCycles }), { status: 200 }));
    const service = new HttpCatalogTrainingCycleApiService();

    const result = await service.list();

    expect(result).toEqual(trainingCycles);
    expect(calls[0]!.url).toBe('/api/catalog/training-cycles');
  });
});

describe('HttpCatalogTrainingCycleApiService.create', () => {
  it('POSTs the name and returns success with the created cycle', async () => {
    const calls = stubFetch(new Response(JSON.stringify({ id: 'c1', name: 'DAM' }), { status: 201 }));
    const service = new HttpCatalogTrainingCycleApiService();

    const result = await service.create('DAM');

    expect(result).toEqual({ outcome: 'success', value: { id: 'c1', name: 'DAM' } });
    expect(calls[0]!.url).toBe('/api/catalog/training-cycles');
    expect(calls[0]!.init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ name: 'DAM' });
  });

  it('returns duplicate-name on a 409 DUPLICATE_NAME response', async () => {
    stubFetch(new Response(JSON.stringify({ message: 'dup', code: 'DUPLICATE_NAME' }), { status: 409 }));
    const service = new HttpCatalogTrainingCycleApiService();

    expect(await service.create('DAM')).toEqual({ outcome: 'duplicate-name' });
  });
});

describe('HttpCatalogTrainingCycleApiService.rename', () => {
  it('PATCHes /api/catalog/training-cycles/:id with the new name', async () => {
    const calls = stubFetch(new Response(JSON.stringify({ id: 'c1', name: 'DAW' }), { status: 200 }));
    const service = new HttpCatalogTrainingCycleApiService();

    const result = await service.rename('c1', 'DAW');

    expect(result).toEqual({ outcome: 'success', value: { id: 'c1', name: 'DAW' } });
    expect(calls[0]!.url).toBe('/api/catalog/training-cycles/c1');
    expect(calls[0]!.init).toMatchObject({ method: 'PATCH' });
  });
});

describe('HttpCatalogTrainingCycleApiService.remove', () => {
  it('DELETEs /api/catalog/training-cycles/:id and returns success on a 204', async () => {
    const calls = stubFetch(new Response(null, { status: 204 }));
    const service = new HttpCatalogTrainingCycleApiService();

    const result = await service.remove('c1');

    expect(result).toEqual({ outcome: 'success' });
    expect(calls[0]!.url).toBe('/api/catalog/training-cycles/c1');
    expect(calls[0]!.init).toMatchObject({ method: 'DELETE' });
  });
});
