// elementId: forgot-password-link
import { describe, it, expect } from 'bun:test';
import '../src/login-view';
import type { LoginView } from '../src/login-view';

type LoginOutcome = { success: true } | { success: false; message: string };
interface AuthApiService {
  login(email: string, password: string): Promise<LoginOutcome>;
}

describe('elementId: forgot-password-link', () => {
  it('is present and visible below login-button on first load', () => {
    const el = document.createElement('app-login-view') as LoginView;
    el.service = { login: async () => ({ success: true }) } satisfies AuthApiService;
    document.body.appendChild(el);

    const link = el.shadowRoot!.querySelector('[data-element-id="forgot-password-link"]');
    const button = el.shadowRoot!.querySelector('[data-element-id="login-button"]');

    expect(link).not.toBeNull();
    expect(link!.compareDocumentPosition(button!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    el.remove();
  });

  it('does not navigate and sends no request when clicked', () => {
    let serviceCalled = false;
    const el = document.createElement('app-login-view') as LoginView;
    el.service = {
      login: async () => {
        serviceCalled = true;
        return { success: true };
      },
    } satisfies AuthApiService;
    document.body.appendChild(el);
    const originalHref = window.location.href;

    el.shadowRoot!.querySelector<HTMLAnchorElement>('[data-element-id="forgot-password-link"]')!.click();

    expect(serviceCalled).toBe(false);
    expect(window.location.href).toBe(originalHref);

    el.remove();
  });
});
