// elementId: password-input
import { describe, it, expect } from 'bun:test';
import '../src/login-view';
import type { LoginView } from '../src/login-view';

type LoginOutcome = { success: true } | { success: false; message: string };
interface AuthApiService {
  login(email: string, password: string): Promise<LoginOutcome>;
}

function neverCalledService(): AuthApiService {
  return {
    login: async () => {
      throw new Error('service.login should not be called when client-side validation fails');
    },
  };
}

function mountLoginView(): LoginView {
  const el = document.createElement('app-login-view') as LoginView;
  el.service = neverCalledService();
  document.body.appendChild(el);
  return el;
}

describe('elementId: password-input', () => {
  it('renders as masked characters by default', () => {
    const el = mountLoginView();
    const password = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!;

    expect(password.type).toBe('password');

    el.remove();
  });

  it('shows an inline error and does not submit if left empty', async () => {
    const el = mountLoginView();
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!.value = 'ana@example.com';
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const password = el.shadowRoot!.querySelector('[data-element-id="password-input"]')!;
    expect(password.parentElement!.textContent).toMatch(/required/i);

    el.remove();
  });

  it('clears its inline error once corrected to a non-empty value', async () => {
    const el = mountLoginView();
    const passwordInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!;
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!.value = 'ana@example.com';
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    passwordInput.value = 'CorrectHorseBattery1';
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(passwordInput.parentElement!.textContent).not.toMatch(/required/i);

    el.remove();
  });
});
