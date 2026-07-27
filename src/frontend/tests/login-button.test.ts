// elementId: login-button
import { describe, it, expect } from 'bun:test';
import '../src/login-view';
import type { LoginView } from '../src/login-view';

type LoginOutcome = { success: true } | { success: false; message: string };
interface AuthApiService {
  login(email: string, password: string): Promise<LoginOutcome>;
}

function mountLoginView(service: AuthApiService): LoginView {
  const el = document.createElement('app-login-view') as LoginView;
  el.service = service;
  document.body.appendChild(el);
  return el;
}

function fillCredentials(el: LoginView, email: string, password: string): void {
  el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!.value = email;
  el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!.value = password;
}

describe('elementId: login-button', () => {
  it('does not send a request if either field fails client-side validation', async () => {
    let called = false;
    const el = mountLoginView({
      login: async () => {
        called = true;
        return { success: true };
      },
    });
    fillCredentials(el, '', '');

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(called).toBe(false);

    el.remove();
  });

  it('shows a loading state and is disabled from click until the response arrives', async () => {
    let resolveLogin!: (outcome: LoginOutcome) => void;
    const el = mountLoginView({
      login: () => new Promise((resolve) => { resolveLogin = resolve; }),
    });
    fillCredentials(el, 'ana@example.com', 'CorrectHorseBattery1');
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!;

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(button.disabled).toBe(true);

    resolveLogin({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.remove();
  });

  it('redirects to /dashboard after a response indicating valid, non-locked credentials', async () => {
    const el = mountLoginView({ login: async () => ({ success: true }) });
    fillCredentials(el, 'ana@example.com', 'CorrectHorseBattery1');

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/dashboard');

    window.history.pushState({}, '', '/login');
    el.remove();
  });

  it('shows "Incorrect email or password" and resets login-button after a wrong-credentials response', async () => {
    const el = mountLoginView({
      login: async () => ({ success: false, message: 'Incorrect email or password' }),
    });
    fillCredentials(el, 'ana@example.com', 'TheWrongPassword1');
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!;

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="login-error-message"]')!.textContent).toContain(
      'Incorrect email or password',
    );
    expect(button.disabled).toBe(false);

    el.remove();
  });

  it('shows the account-locked message and resets login-button after a locked-account response', async () => {
    const el = mountLoginView({
      login: async () => ({
        success: false,
        message: 'This account has been locked due to too many failed attempts. Contact support.',
      }),
    });
    fillCredentials(el, 'ana@example.com', 'CorrectHorseBattery1');
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!;

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot!.querySelector('[data-element-id="login-error-message"]')!.textContent).toContain(
      'This account has been locked due to too many failed attempts. Contact support.',
    );
    expect(button.disabled).toBe(false);

    el.remove();
  });
});
