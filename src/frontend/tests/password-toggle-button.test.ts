// elementId: password-toggle-button
import { describe, it, expect } from 'bun:test';
import '../src/login-view';
import type { LoginView } from '../src/login-view';

type LoginOutcome = { success: true } | { success: false; message: string };
interface AuthApiService {
  login(email: string, password: string): Promise<LoginOutcome>;
}

function mountLoginView(): LoginView {
  const el = document.createElement('app-login-view') as LoginView;
  el.service = { login: async () => ({ success: true }) } satisfies AuthApiService;
  document.body.appendChild(el);
  return el;
}

describe('elementId: password-toggle-button', () => {
  it('reveals password-input as plain text after clicking password-toggle-button once', () => {
    const el = mountLoginView();
    const passwordInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="password-toggle-button"]')!;

    toggle.click();

    expect(passwordInput.type).toBe('text');

    el.remove();
  });

  it('masks password-input again after clicking password-toggle-button a second time', () => {
    const el = mountLoginView();
    const passwordInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="password-toggle-button"]')!;

    toggle.click();
    toggle.click();

    expect(passwordInput.type).toBe('password');

    el.remove();
  });
});
