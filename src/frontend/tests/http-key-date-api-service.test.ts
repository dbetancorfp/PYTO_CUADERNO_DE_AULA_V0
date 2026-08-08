import { describe, it, expect, afterEach } from 'bun:test';
import { HttpKeyDateApiService } from '../src/http-key-date-api-service';

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

describe('HttpKeyDateApiService.list', () => {
  it('GETs /api/key-dates with the encoded category and returns the parsed list', async () => {
    const keyDates = [{ id: 'k1', category: 'holidays', name: 'Navidad', startDay: 22, startMonth: 12, endDay: 7, endMonth: 1, type: null }];
    const calls = stubFetch(new Response(JSON.stringify({ keyDates }), { status: 200 }));
    const service = new HttpKeyDateApiService();

    const result = await service.list('holidays');

    expect(result).toEqual(keyDates);
    expect(calls[0]!.url).toBe('/api/key-dates?category=holidays');
  });

  it('returns [] on a non-OK response instead of propagating a missing field', async () => {
    stubFetch(new Response(null, { status: 500 }));
    const service = new HttpKeyDateApiService();

    expect(await service.list('holidays')).toEqual([]);
  });
});

describe('HttpKeyDateApiService.create', () => {
  it('POSTs /api/key-dates with the data, returns success with the created row', async () => {
    const created = { id: 'k1', category: 'holidays', name: 'Navidad', startDay: 22, startMonth: 12, endDay: 7, endMonth: 1, type: null };
    const calls = stubFetch(new Response(JSON.stringify(created), { status: 201 }));
    const service = new HttpKeyDateApiService();
    const data = { category: 'holidays', name: 'Navidad', startDay: 22, startMonth: 12, endDay: 7, endMonth: 1 };

    const result = await service.create(data);

    expect(result).toEqual({ outcome: 'success', value: created });
    expect(calls[0]!.url).toBe('/api/key-dates');
    expect(calls[0]!.init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual(data);
  });

  it('returns duplicate-name on a 409 DUPLICATE_NAME response', async () => {
    stubFetch(new Response(JSON.stringify({ message: 'dup', code: 'DUPLICATE_NAME' }), { status: 409 }));
    const service = new HttpKeyDateApiService();

    const result = await service.create({ category: 'holidays', name: 'Navidad', startDay: 22, startMonth: 12, endDay: 7, endMonth: 1 });

    expect(result).toEqual({ outcome: 'duplicate-name' });
  });
});

describe('HttpKeyDateApiService.update', () => {
  it('PATCHes /api/key-dates/:id with the changes', async () => {
    const updated = { id: 'k1', category: 'holidays', name: 'Navidad', startDay: 23, startMonth: 12, endDay: 7, endMonth: 1, type: null };
    const calls = stubFetch(new Response(JSON.stringify(updated), { status: 200 }));
    const service = new HttpKeyDateApiService();

    const result = await service.update('k1', { startDay: 23 });

    expect(result).toEqual({ outcome: 'success', value: updated });
    expect(calls[0]!.url).toBe('/api/key-dates/k1');
    expect(calls[0]!.init).toMatchObject({ method: 'PATCH' });
  });
});

describe('HttpKeyDateApiService.remove', () => {
  it('DELETEs /api/key-dates/:id and returns success on a 204', async () => {
    const calls = stubFetch(new Response(null, { status: 204 }));
    const service = new HttpKeyDateApiService();

    const result = await service.remove('k1');

    expect(result).toEqual({ outcome: 'success' });
    expect(calls[0]!.url).toBe('/api/key-dates/k1');
    expect(calls[0]!.init).toMatchObject({ method: 'DELETE' });
  });
});
