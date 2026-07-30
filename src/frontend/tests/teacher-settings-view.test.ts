// elementId: teacher-nav-link, academic-year-nav-link, teacher-full-name-input,
// teacher-save-name-button, teacher-name-save-message, teacher-current-password-input,
// teacher-new-password-input, teacher-repeat-password-input, teacher-save-password-button,
// teacher-password-save-message (see views/configuracion/use-cases.md UC-01/UC-02/UC-03).
// New component, doesn't exist yet.
//
// Reuses SessionApiService (already defined for Dashboard, src/frontend/src/session-api-service.ts)
// for the auth gate + name pre-fill, via a `sessionService` property — same DIP shape as
// DashboardView. A new `settingsService: TeacherSettingsApiService` property covers the
// write actions this screen owns.
import { describe, it, expect } from 'bun:test';
import '../src/teacher-settings-view';
import type { TeacherSettingsView } from '../src/teacher-settings-view';

type SessionOutcome = { authenticated: true; fullName: string } | { authenticated: false };
interface SessionApiService {
  getSession(): Promise<SessionOutcome>;
  logout(): Promise<void>;
}

type WriteOutcome = { success: true } | { success: false; message: string };
interface TeacherSettingsApiService {
  updateFullName(fullName: string): Promise<WriteOutcome>;
  changePassword(currentPassword: string, newPassword: string): Promise<WriteOutcome>;
}

function fakeSessionService(fullName = 'Ana García'): SessionApiService {
  return {
    getSession: async () => ({ authenticated: true, fullName }),
    logout: async () => {},
  };
}

function fakeSettingsService(overrides: Partial<TeacherSettingsApiService> = {}): TeacherSettingsApiService {
  return {
    updateFullName: async () => ({ success: true }),
    changePassword: async () => ({ success: true }),
    ...overrides,
  };
}

async function mountView(
  sessionService: SessionApiService = fakeSessionService(),
  settingsService: TeacherSettingsApiService = fakeSettingsService(),
): Promise<TeacherSettingsView> {
  const el = document.createElement('app-teacher-settings-view') as TeacherSettingsView;
  el.sessionService = sessionService;
  el.settingsService = settingsService;
  document.body.appendChild(el);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return el;
}

describe('elementId: teacher-full-name-input', () => {
  it('redirects to /login when the session check responds unauthenticated', async () => {
    const el = await mountView({ getSession: async () => ({ authenticated: false }), logout: async () => {} });

    expect(window.location.pathname).toBe('/login');

    window.history.pushState({}, '', '/configuracion/profesor');
    el.remove();
  });

  it('pre-fills with the current full name once authenticated', async () => {
    const el = await mountView(fakeSessionService('Ana García'));

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="teacher-full-name-input"]')!;

    expect(input.value).toBe('Ana García');

    el.remove();
  });
});

describe('elementId: teacher-save-name-button', () => {
  it('does not call updateFullName if the field is left empty', async () => {
    let called = false;
    const el = await mountView(
      fakeSessionService(),
      fakeSettingsService({ updateFullName: async () => { called = true; return { success: true }; } }),
    );
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="teacher-full-name-input"]')!.value = '';

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="teacher-save-name-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(called).toBe(false);
    el.remove();
  });

  it('calls updateFullName with the new value and shows success', async () => {
    const calls: { updatedFullName: string | null } = { updatedFullName: null };
    const el = await mountView(
      fakeSessionService(),
      fakeSettingsService({
        updateFullName: async (fullName) => {
          calls.updatedFullName = fullName;
          return { success: true };
        },
      }),
    );
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="teacher-full-name-input"]')!;
    input.value = 'Nuevo Nombre';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="teacher-save-name-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.updatedFullName).toBe('Nuevo Nombre');
    expect(el.shadowRoot!.querySelector('[data-element-id="teacher-name-save-message"]')!.textContent).not.toBe('');
    el.remove();
  });

  it('shows an error message when the save fails', async () => {
    const el = await mountView(
      fakeSessionService(),
      fakeSettingsService({ updateFullName: async () => ({ success: false, message: 'Something went wrong' }) }),
    );
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="teacher-full-name-input"]')!;
    input.value = 'Nuevo Nombre';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="teacher-save-name-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="teacher-name-save-message"]')!.textContent).toContain(
      'Something went wrong',
    );
    el.remove();
  });
});

describe('elementId: teacher-save-password-button', () => {
  function fillPasswordForm(el: TeacherSettingsView, current: string, next: string, repeat: string): void {
    const setValue = (elementId: string, value: string): void => {
      const input = el.shadowRoot!.querySelector<HTMLInputElement>(`[data-element-id="${elementId}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setValue('teacher-current-password-input', current);
    setValue('teacher-new-password-input', next);
    setValue('teacher-repeat-password-input', repeat);
  }

  it('does not call changePassword if the repeat does not match the new password', async () => {
    let called = false;
    const el = await mountView(
      fakeSessionService(),
      fakeSettingsService({ changePassword: async () => { called = true; return { success: true }; } }),
    );
    fillPasswordForm(el, 'CorrectHorseBattery1', 'NewPassword2', 'DoesNotMatch3');

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="teacher-save-password-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(called).toBe(false);
    el.remove();
  });

  it('calls changePassword and shows success, clearing all three fields', async () => {
    const calls: { changedWith: [string, string] | null } = { changedWith: null };
    const el = await mountView(
      fakeSessionService(),
      fakeSettingsService({
        changePassword: async (current, next) => {
          calls.changedWith = [current, next];
          return { success: true };
        },
      }),
    );
    fillPasswordForm(el, 'CorrectHorseBattery1', 'NewPassword2', 'NewPassword2');

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="teacher-save-password-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.changedWith).toEqual(['CorrectHorseBattery1', 'NewPassword2']);
    expect(
      el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="teacher-current-password-input"]')!.value,
    ).toBe('');
    el.remove();
  });

  it('shows an error and does not clear the fields when the current password is wrong', async () => {
    const el = await mountView(
      fakeSessionService(),
      fakeSettingsService({ changePassword: async () => ({ success: false, message: 'Incorrect current password' }) }),
    );
    fillPasswordForm(el, 'TheWrongPassword1', 'NewPassword2', 'NewPassword2');

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="teacher-save-password-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="teacher-password-save-message"]')!.textContent).toContain(
      'Incorrect current password',
    );
    expect(
      el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="teacher-current-password-input"]')!.value,
    ).toBe('TheWrongPassword1');
    el.remove();
  });
});

describe('elementId: back-to-dashboard-link', () => {
  it('clicking back-to-dashboard-link navigates to /dashboard', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="back-to-dashboard-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/dashboard');

    window.history.pushState({}, '', '/configuracion/profesor');
    el.remove();
  });
});

describe('elementId: teacher-nav-link, academic-year-nav-link', () => {
  it('teacher-nav-link is active and academic-year-nav-link is inactive on this screen', async () => {
    const el = await mountView();

    const teacherLink = el.shadowRoot!.querySelector('[data-element-id="teacher-nav-link"]')!;
    const yearLink = el.shadowRoot!.querySelector('[data-element-id="academic-year-nav-link"]')!;

    expect(teacherLink.getAttribute('aria-current')).toBe('page');
    expect(yearLink.getAttribute('aria-current')).toBeNull();

    el.remove();
  });

  it('clicking academic-year-nav-link navigates to /configuracion/ano-academico', async () => {
    const el = await mountView();

    el.shadowRoot!.querySelector<HTMLElement>('[data-element-id="academic-year-nav-link"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/configuracion/ano-academico');

    window.history.pushState({}, '', '/configuracion/profesor');
    el.remove();
  });
});
