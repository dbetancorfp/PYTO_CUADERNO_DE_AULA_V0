import { html, render } from 'lit-html';
import { attachSharedStyles } from './styles/shadow-styles';
import { classesFor } from './styles/classes-for';
import type { AuthApiService } from './auth-api-service';

const EMAIL_REQUIRED_MESSAGE = 'Email is required';
const EMAIL_INVALID_MESSAGE = 'Enter a valid email address';
const PASSWORD_REQUIRED_MESSAGE = 'Password is required';

function isEmailShaped(value: string): boolean {
  const at = value.indexOf('@');
  return at !== -1 && at < value.length - 1;
}

/**
 * Resolves `path` against the current page's URL before navigating. A plain relative
 * assignment (`window.location.href = path`) is enough in a real browser, but degrades
 * silently (no-op, no thrown error — see happy-dom's `BrowserFrameURL.getRelativeURL`)
 * when the current document has an opaque URL such as `about:blank`, which is the default
 * starting page in this project's unit-test environment. Resolving explicitly first keeps
 * the redirect deterministic in both cases.
 */
function redirectTo(path: string): void {
  try {
    window.location.href = new URL(path, window.location.href).href;
  } catch {
    window.location.href = new URL(path, 'http://localhost').href;
  }
}

/**
 * Login screen — single Shadow DOM, every element (`login-heading`, `email-input`,
 * `password-input`, `password-toggle-button`, `login-button`, `forgot-password-link`,
 * `login-error-message`) is a plain element inside it, per CLAUDE.md's
 * "no nested Shadow DOM" rule. See `views/login/ui-spec.json` for element design and
 * `views/login/functional-spec.json` for the business rules implemented here.
 */
export class LoginView extends HTMLElement {
  private _service: AuthApiService | null = null;
  private _emailError: string | null = null;
  private _passwordError: string | null = null;
  private _loginError: string | null = null;
  private _passwordVisible = false;
  private _loading = false;
  private _disposables: Array<() => void> = [];

  set service(value: AuthApiService) {
    this._service = value;
  }

  get service(): AuthApiService {
    if (this._service === null) {
      throw new Error('LoginView.service must be set before use');
    }
    return this._service;
  }

  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    attachSharedStyles(this.shadowRoot!);
    this._render();

    const onInput = (event: Event): void => this._handleInput(event);
    const onClick = (event: Event): void => this._handleClick(event);
    this.shadowRoot!.addEventListener('input', onInput);
    this.shadowRoot!.addEventListener('click', onClick);
    this._disposables.push(() => this.shadowRoot!.removeEventListener('input', onInput));
    this._disposables.push(() => this.shadowRoot!.removeEventListener('click', onClick));
  }

  disconnectedCallback(): void {
    this._disposables.forEach((dispose) => dispose());
    this._disposables = [];
  }

  private _handleInput(event: Event): void {
    const target = event.target as HTMLElement;
    const elementId = target.dataset.elementId;

    if (elementId === 'email-input') {
      const value = (target as HTMLInputElement).value;
      if (isEmailShaped(value)) {
        this._emailError = null;
      }
    } else if (elementId === 'password-input') {
      const value = (target as HTMLInputElement).value;
      if (value.length > 0) {
        this._passwordError = null;
      }
    } else {
      return;
    }

    this._render();
  }

  private _handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;

    switch (target.dataset.elementId) {
      case 'login-button':
        void this._handleLoginSubmit();
        break;
      case 'password-toggle-button':
        this._togglePasswordVisibility();
        break;
      case 'forgot-password-link':
        event.preventDefault();
        this.dispatchEvent(
          new CustomEvent('app:forgot-password-clicked', { bubbles: true, composed: true, detail: {} }),
        );
        break;
      default:
        break;
    }
  }

  private _togglePasswordVisibility(): void {
    this._passwordVisible = !this._passwordVisible;
    this.dispatchEvent(
      new CustomEvent('app:password-visibility-toggled', {
        bubbles: true,
        composed: true,
        detail: { visible: this._passwordVisible },
      }),
    );
    this._render();
  }

  private async _handleLoginSubmit(): Promise<void> {
    const emailInput = this.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="email-input"]')!;
    const passwordInput = this.shadowRoot!.querySelector<HTMLInputElement>('[data-element-id="password-input"]')!;
    const email = emailInput.value;
    const password = passwordInput.value;

    const emailValid = isEmailShaped(email);
    const passwordValid = password.length > 0;

    this._emailError = emailValid ? null : email.length === 0 ? EMAIL_REQUIRED_MESSAGE : EMAIL_INVALID_MESSAGE;
    this._passwordError = passwordValid ? null : PASSWORD_REQUIRED_MESSAGE;

    if (!emailValid || !passwordValid) {
      this._render();
      return;
    }

    this.dispatchEvent(new CustomEvent('app:login-submitted', { bubbles: true, composed: true, detail: {} }));

    this._loginError = null;
    this._loading = true;
    this._render();

    const outcome = await this.service.login(email, password);

    this._loading = false;

    if (outcome.success) {
      redirectTo('/dashboard');
      return;
    }

    this._loginError = outcome.message;
    this.dispatchEvent(
      new CustomEvent('app:login-error-shown', { bubbles: true, composed: true, detail: { message: outcome.message } }),
    );
    this._render();
  }

  private _render(): void {
    render(
      html`
        <div class="${classesFor('card', undefined, undefined)} mx-auto flex max-w-sm flex-col gap-4 p-6">
          <h1 class="${classesFor('heading')}" data-element-id="login-heading">App</h1>

          <div>
            <input
              class="${classesFor('text-input', undefined, 'md')}"
              data-element-id="email-input"
              type="email"
              placeholder="Email"
              aria-label="Email"
            />
            ${this._emailError !== null
              ? html`<p class="${classesFor('paragraph', 'danger', 'sm')}">${this._emailError}</p>`
              : ''}
          </div>

          <div class="flex items-center gap-2">
            <div>
              <input
                class="${classesFor('password-input', undefined, 'md')}"
                data-element-id="password-input"
                .type=${this._passwordVisible ? 'text' : 'password'}
                placeholder="Password"
                aria-label="Password"
              />
              ${this._passwordError !== null
                ? html`<p class="${classesFor('paragraph', 'danger', 'sm')}">${this._passwordError}</p>`
                : ''}
            </div>
            <button
              type="button"
              class="${classesFor('icon-button', 'ghost', 'sm')}"
              data-element-id="password-toggle-button"
              aria-label="Show password"
            >
              ${this._passwordVisible ? 'Hide' : 'Show'}
            </button>
          </div>

          <button
            type="button"
            class="${classesFor('submit-button', 'primary', 'md')}"
            data-element-id="login-button"
            ?disabled=${this._loading}
          >
            ${this._loading ? 'Signing in…' : 'Sign in'}
          </button>

          <a
            class="${classesFor('link', 'link')}"
            data-element-id="forgot-password-link"
            tabindex="0"
            role="link"
          >
            Forgot your password?
          </a>

          ${this._loginError !== null
            ? html`<p
                class="${classesFor('paragraph', 'danger', 'sm')}"
                data-element-id="login-error-message"
                aria-live="assertive"
              >
                ${this._loginError}
              </p>`
            : ''}
        </div>
      `,
      this.shadowRoot!,
    );
  }
}

customElements.define('app-login-view', LoginView);
