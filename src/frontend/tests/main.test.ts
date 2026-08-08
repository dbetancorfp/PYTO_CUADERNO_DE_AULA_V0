// Bootstrap entry point — routes window.location.pathname to the right view and wires it
// to real Http*ApiService clients (see src/frontend/src/main.ts). `fetch` is stubbed to an
// immediate 401 for the whole file so every view's session check settles fast without a
// real backend, instead of asserting on each view's own post-session-check rendering
// (already covered by that view's own test file) — this file only verifies bootstrap()
// picks the right custom element and injects the right service instances per route.
import { describe, it, expect, afterEach } from 'bun:test';
import { bootstrap } from '../src/main';
import { HttpSessionApiService } from '../src/http-session-api-service';
import { HttpAuthApiService } from '../src/http-auth-api-service';
import { HttpTeacherSettingsApiService } from '../src/http-teacher-settings-api-service';
import { HttpCatalogTrainingCycleApiService } from '../src/http-catalog-training-cycle-api-service';
import { HttpCatalogModuleApiService } from '../src/http-catalog-module-api-service';
import { HttpAcademicYearApiService } from '../src/http-academic-year-api-service';
import { HttpCalendarioModuloApiService } from '../src/http-calendario-modulo-api-service';
import { HttpKeyDateApiService } from '../src/http-key-date-api-service';
import type { DashboardView } from '../src/dashboard-view';
import type { TeacherSettingsView } from '../src/teacher-settings-view';
import type { TrainingCatalogSettingsView } from '../src/training-catalog-settings-view';
import type { AcademicYearSettingsView } from '../src/academic-year-settings-view';
import type { CalendarioView } from '../src/calendario-view';
import type { KeyDateSettingsView } from '../src/key-date-settings-view';
import type { LoginView } from '../src/login-view';

const originalFetch = globalThis.fetch;

// `history.pushState` doesn't update `window.location.pathname` from happy-dom's opaque
// `about:blank` starting document (see navigation.ts's own comment on this) — a direct
// `location.href` assignment, resolved against a real origin first, does.
function setPath(path: string): void {
  window.location.href = new URL(path, 'http://localhost').href;
}

async function mountAt(path: string): Promise<void> {
  document.body.innerHTML = '';
  setPath(path);
  await bootstrap();
  // Lets each view's fire-and-forget session check (and any resulting redirect) settle
  // before the next test changes window.location.pathname out from under it.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.innerHTML = '';
  setPath('/');
});

describe('bootstrap', () => {
  it('mounts app-dashboard-view with a real session service on /dashboard', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    await mountAt('/dashboard');

    const el = document.body.querySelector('app-dashboard-view') as DashboardView | null;
    expect(el).not.toBeNull();
    expect(el!.service).toBeInstanceOf(HttpSessionApiService);
  });

  it('mounts app-teacher-settings-view with real session/settings services on /configuracion/profesor', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    await mountAt('/configuracion/profesor');

    const el = document.body.querySelector('app-teacher-settings-view') as TeacherSettingsView | null;
    expect(el).not.toBeNull();
    expect(el!.sessionService).toBeInstanceOf(HttpSessionApiService);
    expect(el!.settingsService).toBeInstanceOf(HttpTeacherSettingsApiService);
  });

  it('mounts app-training-catalog-settings-view with real services on /configuracion/ciclos-modulos', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    await mountAt('/configuracion/ciclos-modulos');

    const el = document.body.querySelector('app-training-catalog-settings-view') as TrainingCatalogSettingsView | null;
    expect(el).not.toBeNull();
    expect(el!.sessionService).toBeInstanceOf(HttpSessionApiService);
    expect(el!.trainingCycleService).toBeInstanceOf(HttpCatalogTrainingCycleApiService);
    expect(el!.moduleService).toBeInstanceOf(HttpCatalogModuleApiService);
  });

  it('mounts app-academic-year-settings-view with real services on /configuracion/ano-academico', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    await mountAt('/configuracion/ano-academico');

    const el = document.body.querySelector('app-academic-year-settings-view') as AcademicYearSettingsView | null;
    expect(el).not.toBeNull();
    expect(el!.sessionService).toBeInstanceOf(HttpSessionApiService);
    expect(el!.academicYearService).toBeInstanceOf(HttpAcademicYearApiService);
    expect(el!.catalogCycleService).toBeInstanceOf(HttpCatalogTrainingCycleApiService);
    expect(el!.catalogModuleService).toBeInstanceOf(HttpCatalogModuleApiService);
  });

  it('mounts app-calendario-view with real services on /calendario', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    await mountAt('/calendario');

    const el = document.body.querySelector('app-calendario-view') as CalendarioView | null;
    expect(el).not.toBeNull();
    expect(el!.sessionService).toBeInstanceOf(HttpSessionApiService);
    expect(el!.academicYearService).toBeInstanceOf(HttpAcademicYearApiService);
    expect(el!.calendarioModuloService).toBeInstanceOf(HttpCalendarioModuloApiService);
  });

  it('mounts app-key-date-settings-view with real services on /configuracion/fechas-senaladas', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    await mountAt('/configuracion/fechas-senaladas');

    const el = document.body.querySelector('app-key-date-settings-view') as KeyDateSettingsView | null;
    expect(el).not.toBeNull();
    expect(el!.sessionService).toBeInstanceOf(HttpSessionApiService);
    expect(el!.keyDateService).toBeInstanceOf(HttpKeyDateApiService);
  });

  it('falls back to app-login-view with a real auth service for any other path', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;

    await mountAt('/anything-else');

    const el = document.body.querySelector('app-login-view') as LoginView | null;
    expect(el).not.toBeNull();
    expect(el!.service).toBeInstanceOf(HttpAuthApiService);
  });
});
