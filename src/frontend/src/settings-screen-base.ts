import { attachSharedStyles } from './styles/shadow-styles';
import { handleSettingsNavClick } from './settings-nav';

/**
 * Shared `connectedCallback`/`disconnectedCallback` wiring for every Configuración screen —
 * shadow attach, shared styles, click/change event delegation with the settings-nav
 * short-circuit applied once here instead of at the top of every subclass's click handler,
 * and disposables cleanup. Per CLAUDE.md's "no nested Shadow DOM" allowance for sharing
 * behavior via an abstract base class extending `HTMLElement`: each subclass is still its
 * own single top-level custom element with its own single, non-nested Shadow DOM — this
 * class is never itself registered with `customElements.define`.
 */
export abstract class SettingsScreenBase extends HTMLElement {
  protected _disposables: Array<() => void> = [];

  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    attachSharedStyles(this.shadowRoot!);
    this._render();

    const onClick = (event: Event): void => this._dispatchClick(event);
    this.shadowRoot!.addEventListener('click', onClick);
    this._disposables.push(() => this.shadowRoot!.removeEventListener('click', onClick));

    const onChange = (event: Event): void => this._dispatchChange(event);
    this.shadowRoot!.addEventListener('change', onChange);
    this._disposables.push(() => this.shadowRoot!.removeEventListener('change', onChange));

    void this._onConnected();
  }

  disconnectedCallback(): void {
    this._disposables.forEach((dispose) => dispose());
    this._disposables = [];
  }

  protected _query<T extends Element>(elementId: string): T {
    return this.shadowRoot!.querySelector<T>(`[data-element-id="${elementId}"]`)!;
  }

  private _dispatchClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;
    if (handleSettingsNavClick(elementId)) return;
    this._onElementClick(elementId, target, event);
  }

  private _dispatchChange(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]');
    if (!target) return;
    const elementId = target.dataset.elementId!;
    this._onElementChange(elementId, target, event);
  }

  protected abstract _render(): void;

  /** Runs once, right after the first render — session/auth check and initial data load. */
  protected abstract _onConnected(): void | Promise<void>;

  protected abstract _onElementClick(elementId: string, target: HTMLElement, event: Event): void;

  /** No-op by default — only screens with checkbox columns (e.g. `academic-year-settings-view.ts`) override it. */
  protected _onElementChange(_elementId: string, _target: HTMLElement, _event: Event): void {}
}
