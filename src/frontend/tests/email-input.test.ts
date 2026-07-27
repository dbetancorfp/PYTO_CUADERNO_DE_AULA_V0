// elementId: email-input
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

describe('elementId: email-input', () => {
  it('shows an inline error and does not submit if left empty', async () => {
    const el = mountLoginView();
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!.value =
      'CorrectHorseBattery1';
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const email = el.shadowRoot!.querySelector('[data-element-id="email-input"]')!;
    expect(email.parentElement!.textContent).toMatch(/required/i);

    el.remove();
  });

  it("shows an inline error and does not submit if the value has no '@' or nothing after the '@'", async () => {
    const el = mountLoginView();
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!.value = 'not-an-email';
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!.value =
      'CorrectHorseBattery1';
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const email = el.shadowRoot!.querySelector('[data-element-id="email-input"]')!;
    expect(email.parentElement!.textContent).toMatch(/valid email/i);

    el.remove();
  });

  it('clears its inline error once corrected to a non-empty, email-shaped value', async () => {
    const el = mountLoginView();
    const emailInput = el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!;
    el.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!.value =
      'CorrectHorseBattery1';
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-element-id="login-button"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    emailInput.value = 'ana@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(emailInput.parentElement!.textContent).not.toMatch(/required|valid email/i);

    el.remove();
  });
});
