import { html, render } from 'lit-html';
import { attachSharedStyles } from './styles/shadow-styles';
import { classesFor } from './styles/classes-for';
import { redirectTo } from './navigation';
import { handleSettingsNavClick, renderSettingsNav } from './settings-nav';
import type { SessionApiService } from './session-api-service';
import type { TeacherSettingsApiService } from './teacher-settings-api-service';

const NAME_REQUIRED_MESSAGE = 'El nombre es obligatorio';
const CURRENT_PASSWORD_REQUIRED_MESSAGE = 'Introduce tu contraseña actual';
const NEW_PASSWORD_REQUIRED_MESSAGE = 'Introduce la nueva contraseña';
const REPEAT_PASSWORD_REQUIRED_MESSAGE = 'Repite la nueva contraseña';
const REPEAT_PASSWORD_MISMATCH_MESSAGE = 'Las contraseñas no coinciden';
const NAME_SAVED_MESSAGE = 'Nombre actualizado';
const PASSWORD_SAVED_MESSAGE = 'Contraseña actualizada';

interface SaveMessage {
  kind: 'success' | 'error';
  text: string;
}

/**
 * Configuración — Profesor screen. Own top-level custom element, single Shadow DOM, not
 * nested inside anything — CLAUDE.md's "no nested Shadow DOM" rule. See
 * views/configuracion/ui-spec.json (`teacher-settings-screen`) for element design and
 * views/configuracion/use-cases.md UC-01/UC-02/UC-03 for the business rules implemented
 * here. `teacher-nav-link`/`academic-year-nav-link` are shared with
 * `academic-year-settings-view.ts` via the plain `renderSettingsNav` function.
 */
export class TeacherSettingsView extends HTMLElement {
  private _sessionService: SessionApiService | null = null;
  private _settingsService: TeacherSettingsApiService | null = null;

  private _authenticated = false;
  private _fullName: string | null = null;

  private _nameError: string | null = null;
  private _nameSaving = false;
  private _nameMessage: SaveMessage | null = null;

  private _currentPasswordError: string | null = null;
  private _newPasswordError: string | null = null;
  private _repeatPasswordError: string | null = null;
  private _passwordSaving = false;
  private _passwordMessage: SaveMessage | null = null;

  private _disposables: Array<() => void> = [];

  set sessionService(value: SessionApiService) {
    this._sessionService = value;
  }

  get sessionService(): SessionApiService {
    if (this._sessionService === null) {
      throw new Error('TeacherSettingsView.sessionService must be set before use');
    }
    return this._sessionService;
  }

  set settingsService(value: TeacherSettingsApiService) {
    this._settingsService = value;
  }

  get settingsService(): TeacherSettingsApiService {
    if (this._settingsService === null) {
      throw new Error('TeacherSettingsView.settingsService must be set before use');
    }
    return this._settingsService;
  }

  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    attachSharedStyles(this.shadowRoot!);
    this._render();

    const onClick = (event: Event): void => this._handleClick(event);
    this.shadowRoot!.addEventListener('click', onClick);
    this._disposables.push(() => this.shadowRoot!.removeEventListener('click', onClick));

    void this._loadSession();
  }

  disconnectedCallback(): void {
    this._disposables.forEach((dispose) => dispose());
    this._disposables = [];
  }

  private async _loadSession(): Promise<void> {
    const outcome = await this.sessionService.getSession();

    if (!outcome.authenticated) {
      redirectTo('/login');
      return;
    }

    this._authenticated = true;
    this._fullName = outcome.fullName;
    this._render();
  }

  private _query<T extends Element>(elementId: string): T {
    return this.shadowRoot!.querySelector<T>(`[data-element-id="${elementId}"]`)!;
  }

  private _handleClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;

    if (handleSettingsNavClick(elementId)) return;

    if (elementId === 'teacher-save-name-button') {
      void this._handleSaveName();
      return;
    }
    if (elementId === 'teacher-save-password-button') {
      void this._handleSavePassword();
    }
  }

  private async _handleSaveName(): Promise<void> {
    const fullName = this._query<HTMLInputElement>('teacher-full-name-input').value.trim();

    this._nameError = fullName.length === 0 ? NAME_REQUIRED_MESSAGE : null;
    if (this._nameError !== null) {
      this._render();
      return;
    }

    this._nameMessage = null;
    this._nameSaving = true;
    this._render();

    const outcome = await this.settingsService.updateFullName(fullName);

    this._nameSaving = false;
    if (outcome.success) {
      this._fullName = fullName;
      this._nameMessage = { kind: 'success', text: NAME_SAVED_MESSAGE };
    } else {
      this._nameMessage = { kind: 'error', text: outcome.message };
    }
    this._render();
  }

  private async _handleSavePassword(): Promise<void> {
    const current = this._query<HTMLInputElement>('teacher-current-password-input').value;
    const next = this._query<HTMLInputElement>('teacher-new-password-input').value;
    const repeat = this._query<HTMLInputElement>('teacher-repeat-password-input').value;

    this._currentPasswordError = current.length === 0 ? CURRENT_PASSWORD_REQUIRED_MESSAGE : null;
    this._newPasswordError = next.length === 0 ? NEW_PASSWORD_REQUIRED_MESSAGE : null;
    this._repeatPasswordError =
      repeat.length === 0
        ? REPEAT_PASSWORD_REQUIRED_MESSAGE
        : repeat !== next
          ? REPEAT_PASSWORD_MISMATCH_MESSAGE
          : null;

    if (this._currentPasswordError !== null || this._newPasswordError !== null || this._repeatPasswordError !== null) {
      this._render();
      return;
    }

    this._passwordMessage = null;
    this._passwordSaving = true;
    this._render();

    const outcome = await this.settingsService.changePassword(current, next);

    this._passwordSaving = false;
    if (outcome.success) {
      this._passwordMessage = { kind: 'success', text: PASSWORD_SAVED_MESSAGE };
      this._clearPasswordFields();
    } else {
      this._passwordMessage = { kind: 'error', text: outcome.message };
    }
    this._render();
  }

  private _clearPasswordFields(): void {
    this._query<HTMLInputElement>('teacher-current-password-input').value = '';
    this._query<HTMLInputElement>('teacher-new-password-input').value = '';
    this._query<HTMLInputElement>('teacher-repeat-password-input').value = '';
  }

  private _render(): void {
    if (!this._authenticated) {
      render(html``, this.shadowRoot!);
      return;
    }

    render(
      html`
        <div class="mx-auto flex max-w-2xl flex-col gap-8 p-4">
          ${renderSettingsNav('profesor')}

          <section class="${classesFor('card', undefined, undefined)} flex flex-col gap-4 p-6">
            <h2 class="${classesFor('heading')}">Datos del profesor</h2>

            <div>
              <input
                class="${classesFor('text-input', undefined, 'md')}"
                data-element-id="teacher-full-name-input"
                type="text"
                placeholder="Nombre completo"
                aria-label="Nombre"
                .value=${this._fullName ?? ''}
              />
              ${this._nameError !== null
                ? html`<p class="${classesFor('paragraph', 'danger', 'sm')}">${this._nameError}</p>`
                : ''}
            </div>

            <button
              type="button"
              class="${classesFor('submit-button', 'primary', 'md')}"
              data-element-id="teacher-save-name-button"
              ?disabled=${this._nameSaving}
            >
              ${this._nameSaving ? 'Guardando…' : 'Guardar nombre'}
            </button>

            ${this._nameMessage !== null
              ? html`<p
                  class="${classesFor('paragraph', this._nameMessage.kind === 'error' ? 'danger' : undefined, 'sm')} ${this
                    ._nameMessage.kind === 'success'
                    ? 'text-green-700'
                    : ''}"
                  data-element-id="teacher-name-save-message"
                  aria-live="polite"
                >
                  ${this._nameMessage.text}
                </p>`
              : ''}
          </section>

          <section class="${classesFor('card', undefined, undefined)} flex flex-col gap-4 p-6">
            <h2 class="${classesFor('heading')}">Cambiar contraseña</h2>

            <div>
              <input
                class="${classesFor('password-input', undefined, 'md')}"
                data-element-id="teacher-current-password-input"
                type="password"
                placeholder="Contraseña actual"
                aria-label="Contraseña actual"
              />
              ${this._currentPasswordError !== null
                ? html`<p class="${classesFor('paragraph', 'danger', 'sm')}">${this._currentPasswordError}</p>`
                : ''}
            </div>

            <div>
              <input
                class="${classesFor('password-input', undefined, 'md')}"
                data-element-id="teacher-new-password-input"
                type="password"
                placeholder="Nueva contraseña"
                aria-label="Nueva contraseña"
              />
              ${this._newPasswordError !== null
                ? html`<p class="${classesFor('paragraph', 'danger', 'sm')}">${this._newPasswordError}</p>`
                : ''}
            </div>

            <div>
              <input
                class="${classesFor('password-input', undefined, 'md')}"
                data-element-id="teacher-repeat-password-input"
                type="password"
                placeholder="Repite la nueva contraseña"
                aria-label="Repite la nueva contraseña"
              />
              ${this._repeatPasswordError !== null
                ? html`<p class="${classesFor('paragraph', 'danger', 'sm')}">${this._repeatPasswordError}</p>`
                : ''}
            </div>

            <button
              type="button"
              class="${classesFor('submit-button', 'primary', 'md')}"
              data-element-id="teacher-save-password-button"
              ?disabled=${this._passwordSaving}
            >
              ${this._passwordSaving ? 'Guardando…' : 'Cambiar contraseña'}
            </button>

            ${this._passwordMessage !== null
              ? html`<p
                  class="${classesFor(
                    'paragraph',
                    this._passwordMessage.kind === 'error' ? 'danger' : undefined,
                    'sm',
                  )} ${this._passwordMessage.kind === 'success' ? 'text-green-700' : ''}"
                  data-element-id="teacher-password-save-message"
                  aria-live="polite"
                >
                  ${this._passwordMessage.text}
                </p>`
              : ''}
          </section>
        </div>
      `,
      this.shadowRoot!,
    );
  }
}

customElements.define('app-teacher-settings-view', TeacherSettingsView);
