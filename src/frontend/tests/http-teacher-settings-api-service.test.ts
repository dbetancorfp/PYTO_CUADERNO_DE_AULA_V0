import { describe, it, expect, afterEach } from 'bun:test';
import { HttpTeacherSettingsApiService } from '../src/http-teacher-settings-api-service';

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

describe('HttpTeacherSettingsApiService.updateFullName', () => {
  it('PATCHes /api/teacher/name and returns success on an OK response', async () => {
    const calls = stubFetch(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const service = new HttpTeacherSettingsApiService();

    const outcome = await service.updateFullName('Ana García');

    expect(outcome).toEqual({ success: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('/api/teacher/name');
    expect(calls[0]!.init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ fullName: 'Ana García' });
  });

  it('returns the error message on a non-OK response', async () => {
    stubFetch(new Response(JSON.stringify({ message: 'El nombre es obligatorio' }), { status: 400 }));
    const service = new HttpTeacherSettingsApiService();

    const outcome = await service.updateFullName('');

    expect(outcome).toEqual({ success: false, message: 'El nombre es obligatorio' });
  });
});

describe('HttpTeacherSettingsApiService.changePassword', () => {
  it('PATCHes /api/teacher/password and returns success on an OK response', async () => {
    const calls = stubFetch(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const service = new HttpTeacherSettingsApiService();

    const outcome = await service.changePassword('current', 'next');

    expect(outcome).toEqual({ success: true });
    expect(calls[0]!.url).toBe('/api/teacher/password');
    expect(calls[0]!.init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ currentPassword: 'current', newPassword: 'next' });
  });

  it('returns the error message on a non-OK response', async () => {
    stubFetch(new Response(JSON.stringify({ message: 'Contraseña actual incorrecta' }), { status: 400 }));
    const service = new HttpTeacherSettingsApiService();

    const outcome = await service.changePassword('wrong', 'next');

    expect(outcome).toEqual({ success: false, message: 'Contraseña actual incorrecta' });
  });
});
