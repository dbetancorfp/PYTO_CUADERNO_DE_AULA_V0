// elementId: academic-year-toast
// Shared, reusable transient notification — plain state class (ToastController) + plain
// render function (renderToast), mirroring `settings-nav.ts`'s `renderSettingsNav` pattern.
// Deliberately NOT a separate custom element: a second Shadow DOM nested inside whichever
// view uses it is forbidden by CLAUDE.md's "no nested Shadow DOM" rule — `data-element-id`
// must sit on a native element inside the *view's own* single shadow root for Cypress'
// `.click()`/`.type()` and `shadowRoot.querySelector()` to reach it. Any top-level view
// component instantiates `ToastController` directly and folds `renderToast(...)` into its
// own render tree. First user: `academic-year-settings-view.ts` (see
// views/configuracion/functional-spec.json's `academic-year-toast` elementSpec).
import { html, type TemplateResult } from 'lit-html';
import { classesFor } from './styles/classes-for';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastState {
  message: string;
  variant: ToastVariant;
}

const DEFAULT_AUTO_DISMISS_MS = 5000;

/** Accent classes per `ToastVariant`, layered on top of `classesFor('card')`'s shell — see classes-for.ts's Record-based mapping pattern (never an inline `if (variant === ...)`). */
const VARIANT_ACCENT_CLASSES: Record<ToastVariant, string> = {
  error: 'border-l-4 border-red-600 text-red-700',
  success: 'border-l-4 border-emerald-600 text-emerald-700',
  info: 'border-l-4 border-slate-400 text-slate-700',
};

/**
 * Holds the single currently-showing toast (if any) for one view component, with
 * auto-dismiss and manual dismiss. `onChange` is called after every state change so the
 * owning component can re-render — this class never touches the DOM itself.
 */
export class ToastController {
  private _current: ToastState | null = null;
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly _onChange: () => void,
    private readonly _autoDismissMs: number = DEFAULT_AUTO_DISMISS_MS,
  ) {}

  get current(): ToastState | null {
    return this._current;
  }

  show(message: string, variant: ToastVariant = 'error'): void {
    this._clearTimer();
    this._current = { message, variant };
    this._timeoutId = setTimeout(() => this.dismiss(), this._autoDismissMs);
    this._onChange();
  }

  dismiss(): void {
    this._clearTimer();
    this._current = null;
    this._onChange();
  }

  private _clearTimer(): void {
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }
}

/**
 * Renders `state` tagged with `elementId` (and a dismiss control tagged
 * `<elementId>-dismiss`), or nothing when `state` is `null`.
 */
export function renderToast(elementId: string, state: ToastState | null, onDismiss: () => void): TemplateResult {
  if (state === null) {
    return html``;
  }

  return html`
    <div
      class="${classesFor('card')} ${VARIANT_ACCENT_CLASSES[state.variant]} fixed bottom-4 right-4 z-20 flex items-center gap-3 p-4"
      data-element-id="${elementId}"
      role="status"
      aria-live="assertive"
    >
      <p class="${classesFor('paragraph')} whitespace-pre-line">${state.message}</p>
      <button
        type="button"
        class="${classesFor('icon-button')}"
        data-element-id="${elementId}-dismiss"
        @click=${onDismiss}
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  `;
}
