# Pattern — CRUD table (frontend)

When it applies: a view lists an entity's rows with inline editing and deletion (project
rule: "inline editing in tables, never a modal" — see `CLAUDE.md`).

## Component skeleton

```ts
// <entity>-table.ts
import { html, render } from 'lit-html';
import { classesFor } from '../styles/classes-for';
import { attachSharedStyles } from '../styles/shadow-styles';

interface Row {
  id: string;
  // ...the view's real fields
}

export class EntityTable extends HTMLElement {
  private _disposables: Array<() => void> = [];
  private _rows: Row[] = [];
  private _editingId: string | null = null;

  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    attachSharedStyles(this.shadowRoot!);
    this._render();
  }

  disconnectedCallback(): void {
    this._disposables.forEach((fn) => fn());
    this._disposables = [];
  }

  setRows(rows: Row[]): void {
    this._rows = rows;
    this._render();
  }

  private _startEdit(id: string): void {
    this._editingId = id;
    this._render();
  }

  private async _saveEdit(id: string, data: Partial<Row>): Promise<void> {
    this.dispatchEvent(new CustomEvent('app:row-saved', {
      bubbles: true, composed: true, detail: { id, data },
    }));
    this._editingId = null;
    this._render();
  }

  private _requestDelete(id: string): void {
    // the component REQUESTS the deletion, it doesn't decide whether it's allowed — the
    // service checks dependencies (see "Dependency-blocked deletion" below) and responds
    // with success or a reason
    this.dispatchEvent(new CustomEvent('app:row-delete-requested', {
      bubbles: true, composed: true, detail: { id },
    }));
  }

  private _render(): void {
    render(html`
      <table class="${classesFor('table', 'default', 'md')}">
        <tbody>
          ${this._rows.map((row) => this._editingId === row.id
            ? this._renderEditRow(row)
            : this._renderReadRow(row))}
        </tbody>
      </table>
    `, this.shadowRoot!);
  }

  private _renderReadRow(row: Row) {
    return html`
      <tr data-element-id="${this.getAttribute('data-element-id')}-row-${row.id}">
        <td>${/* read-only fields */ ''}</td>
        <td>
          <button class="${classesFor('button', 'ghost', 'sm')}"
                  @click=${(): void => this._startEdit(row.id)}>Edit</button>
          <button class="${classesFor('button', 'danger', 'sm')}"
                  @click=${(): void => this._requestDelete(row.id)}>Delete</button>
        </td>
      </tr>
    `;
  }

  private _renderEditRow(row: Row) {
    // inline inputs bound to the view's real fields, no modal
    return html`<tr>${/* ... */''}</tr>`;
  }
}
customElements.define('entity-table', EntityTable);
```

## Dependency-blocked deletion pattern

The component **requests** the deletion (`app:row-delete-requested` event); the backend
`service` decides whether it's allowed, not the frontend:

```ts
// services/<entity>.service.ts
async delete(id: string): Promise<void> {
  const dependents = await this.dependentsRepo.countFor(id);
  if (dependents > 0) {
    throw new DomainError('HAS_DEPENDENTS', `Cannot delete: ${dependents} dependent records`);
  }
  await this.repo.delete(id);
}
```

The event listener in the parent view translates the `HAS_DEPENDENTS` error into the
message shown to the user — the `entity-table` itself doesn't know the business rule for
why a deletion might fail.

## Rules

- Always inline editing, never a modal, for tables that follow this pattern.
- The component never decides "can I delete this" — that judgment lives in the service.
- `data-element-id` on every interactive row/control, derived from the `elementId` in
  `ui-spec.json` + the row's real `id`, so Cypress can target specific rows without relying
  on order.
