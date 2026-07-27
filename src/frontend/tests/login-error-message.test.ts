// elementId: login-error-message
import { describe, it, expect } from 'bun:test';
import '../src/login-view';
import type { LoginView } from '../src/login-view';

type LoginOutcome = { success: true } | { success: false; message: string };
interface AuthApiService {
  login(email: string, password: string): Promise<LoginOutcome>;
}

describe('elementId: login-error-message', () => {
  it('is not visible on first load', () => {
    const el = document.createElement('app-login-view') as LoginView;
    el.service = { login: async () => ({ success: true }) } satisfies AuthApiService;
    document.body.appendChild(el);

    const error = el.shadowRoot!.querySelector('[data-element-id="login-error-message"]');

    expect(error).toBeNull();

    el.remove();
  });

  it("becomes visible showing 'Incorrect email or password' after a wrong-credentials response", async () => {
    const el = document.createElement('app-login-view') as LoginView;
    el.service = {
      login: async () => ({ success: false, message: 'Incorrect email or password' }),
    } satisfies AuthApiService;
    document.body.appendChild(el);
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!.value = 'ana@example.com';
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!.value =
      'TheWrongPassword1';

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const error = el.shadowRoot!.querySelector('[data-element-id="login-error-message"]');
    expect(error).not.toBeNull();
    expect(error!.textContent).toContain('Incorrect email or password');

    el.remove();
  });

  it("becomes visible showing the locked-account message after a locked-account response", async () => {
    const el = document.createElement('app-login-view') as LoginView;
    el.service = {
      login: async () => ({
        success: false,
        message: 'This account has been locked due to too many failed attempts. Contact support.',
      }),
    } satisfies AuthApiService;
    document.body.appendChild(el);
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!.value = 'ana@example.com';
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!.value =
      'CorrectHorseBattery1';

    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const error = el.shadowRoot!.querySelector('[data-element-id="login-error-message"]');
    expect(error).not.toBeNull();
    expect(error!.textContent).toContain(
      'This account has been locked due to too many failed attempts. Contact support.',
    );

    el.remove();
  });
});
